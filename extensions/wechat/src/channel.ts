import {
  DEFAULT_ACCOUNT_ID,
  setAccountEnabledInConfigSection,
  registerPluginHttpRoute,
  buildChannelConfigSchema,
} from "openclaw/plugin-sdk/wechat";
import { z } from "zod";
import { listAccountIds, resolveAccount } from "./accounts.js";
import { sendTextMessage } from "./client.js";
import { getWechatRuntime } from "./runtime.js";
import type { ResolvedWechatAccount } from "./types.js";
import { createWebhookHandler } from "./webhook-handler.js";

const CHANNEL_ID = "wechat";
const WechatConfigSchema = buildChannelConfigSchema(z.object({}).passthrough());

const activeRouteUnregisters = new Map<string, () => void>();

function waitUntilAbort(signal?: AbortSignal, onAbort?: () => void): Promise<void> {
  return new Promise((resolve) => {
    const complete = () => {
      onAbort?.();
      resolve();
    };
    if (!signal) return;
    if (signal.aborted) {
      complete();
      return;
    }
    signal.addEventListener("abort", complete, { once: true });
  });
}

export const wechatPlugin = {
  id: CHANNEL_ID,

  meta: {
    id: CHANNEL_ID,
    label: "WeChat",
    selectionLabel: "WeChat (微信)",
    detailLabel: "WeChat",
    docsPath: "/channels/wechat",
    blurb: "微信消息机器人（需要外部 webhook bridge）。",
    order: 38,
  },

  capabilities: {
    chatTypes: ["direct" as const, "group" as const],
    media: false,
    threads: false,
    reactions: false,
    edit: false,
    unsend: false,
    reply: false,
    effects: false,
    blockStreaming: true,
  },

  reload: { configPrefixes: [`channels.${CHANNEL_ID}`] },

  configSchema: WechatConfigSchema,

  config: {
    listAccountIds: (cfg: any) => listAccountIds(cfg),
    resolveAccount: (cfg: any, accountId?: string | null) => resolveAccount(cfg, accountId),
    defaultAccountId: (_cfg: any) => DEFAULT_ACCOUNT_ID,
    setAccountEnabled: ({ cfg, accountId, enabled }: any) => {
      const channelConfig = cfg?.channels?.[CHANNEL_ID] ?? {};
      if (accountId === DEFAULT_ACCOUNT_ID) {
        return {
          ...cfg,
          channels: { ...cfg.channels, [CHANNEL_ID]: { ...channelConfig, enabled } },
        };
      }
      return setAccountEnabledInConfigSection({
        cfg,
        sectionKey: `channels.${CHANNEL_ID}`,
        accountId,
        enabled,
      });
    },
  },

  pairing: {
    idLabel: "wechatId",
    normalizeAllowEntry: (entry: string) => entry.toLowerCase().trim(),
    notifyApproval: async ({ cfg, id }: { cfg: any; id: string }) => {
      const account = resolveAccount(cfg);
      if (!account.bridgeSendUrl) return;
      try {
        await sendTextMessage(account, id, "OpenClaw: 你的访问已获批准。");
      } catch {
        // best-effort
      }
    },
  },

  security: {
    resolveDmPolicy: ({
      cfg,
      accountId,
      account,
    }: {
      cfg: any;
      accountId?: string | null;
      account: ResolvedWechatAccount;
    }) => {
      const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID;
      const channelCfg = (cfg as any).channels?.wechat;
      const useAccountPath = Boolean(channelCfg?.accounts?.[resolvedAccountId]);
      const basePath = useAccountPath
        ? `channels.wechat.accounts.${resolvedAccountId}.`
        : "channels.wechat.";
      return {
        policy: account.dmPolicy ?? "allowlist",
        allowFrom: account.allowedUserIds ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: basePath,
        approveHint: "openclaw pairing approve wechat <code>",
        normalizeEntry: (raw: string) => raw.toLowerCase().trim(),
      };
    },
    collectWarnings: ({ account }: { account: ResolvedWechatAccount }) => {
      const warnings: string[] = [];
      if (!account.bridgeSendUrl) {
        warnings.push("- WeChat: bridgeSendUrl 未配置，无法发送回复消息。需要运行 WeChat bridge 服务。");
      }
      if (!account.webhookSecret) {
        warnings.push("- WeChat: webhookSecret 未配置，webhook 端点未受保护。");
      }
      if (account.dmPolicy === "open") {
        warnings.push('- WeChat: dmPolicy="open" 允许所有用户发送消息，建议使用 "allowlist"。');
      }
      return warnings;
    },
  },

  messaging: {
    normalizeTarget: (target: string) => {
      const trimmed = target.trim();
      if (!trimmed) return undefined;
      return trimmed.replace(/^(wechat|weixin|wx):/i, "").trim();
    },
    targetResolver: {
      looksLikeId: (id: string) => {
        const trimmed = id?.trim();
        if (!trimmed) return false;
        // WeChat IDs: wxid_xxx or custom usernames
        return /^wxid_/i.test(trimmed) || /^wechat:/i.test(trimmed) || /^[a-zA-Z][\w-]{2,}$/.test(trimmed);
      },
      hint: "<wxid>",
    },
  },

  directory: {
    self: async () => null,
    listPeers: async () => [],
    listGroups: async () => [],
  },

  outbound: {
    deliveryMode: "gateway" as const,
    textChunkLimit: 4096,

    sendText: async ({ to, text, accountId, cfg }: any) => {
      const account: ResolvedWechatAccount = resolveAccount(cfg ?? {}, accountId);
      if (!account.bridgeSendUrl) {
        throw new Error("WeChat bridge send URL 未配置");
      }
      const ok = await sendTextMessage(account, to, text);
      if (!ok) {
        throw new Error("发送微信消息失败");
      }
      return { channel: CHANNEL_ID, messageId: `wx-${Date.now()}`, chatId: to };
    },
  },

  gateway: {
    startAccount: async (ctx: any) => {
      const { cfg, accountId, log } = ctx;
      const account = resolveAccount(cfg, accountId);

      if (!account.enabled) {
        log?.info?.(`WeChat account ${accountId} is disabled, skipping`);
        return waitUntilAbort(ctx.abortSignal);
      }

      if (!account.bridgeSendUrl) {
        log?.warn?.(`WeChat account ${accountId} not configured (missing bridgeSendUrl)`);
        return waitUntilAbort(ctx.abortSignal);
      }

      log?.info?.(`Starting WeChat channel (account: ${accountId}, path: ${account.webhookPath})`);

      const handler = createWebhookHandler({
        account,
        deliver: async (msg) => {
          const rt = getWechatRuntime();
          const currentCfg = await rt.config.loadConfig();

          const msgCtx = rt.channel.reply.finalizeInboundContext({
            Body: msg.body,
            RawBody: msg.body,
            CommandBody: msg.body,
            From: `wechat:${msg.from}`,
            To: `wechat:${msg.from}`,
            SessionKey: msg.sessionKey,
            AccountId: account.accountId,
            OriginatingChannel: CHANNEL_ID,
            OriginatingTo: `wechat:${msg.from}`,
            ChatType: msg.chatType,
            SenderName: msg.senderName,
            SenderId: msg.from,
            Provider: CHANNEL_ID,
            Surface: CHANNEL_ID,
            ConversationLabel: msg.senderName || msg.from,
            Timestamp: Date.now(),
            CommandAuthorized: msg.commandAuthorized,
          });

          await rt.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
            ctx: msgCtx,
            cfg: currentCfg,
            dispatcherOptions: {
              deliver: async (payload: { text?: string; body?: string }) => {
                const text = payload?.text ?? payload?.body;
                if (text) {
                  await sendTextMessage(account, msg.from, text);
                }
              },
              onReplyStart: () => {
                log?.info?.(`Agent reply started for ${msg.from}`);
              },
            },
          });

          return null;
        },
        log,
      });

      const routeKey = `${accountId}:${account.webhookPath}`;
      const prevUnregister = activeRouteUnregisters.get(routeKey);
      if (prevUnregister) {
        log?.info?.(`Deregistering stale route before re-registering: ${account.webhookPath}`);
        prevUnregister();
        activeRouteUnregisters.delete(routeKey);
      }

      const unregister = registerPluginHttpRoute({
        path: account.webhookPath,
        auth: "plugin",
        replaceExisting: true,
        pluginId: CHANNEL_ID,
        accountId: account.accountId,
        log: (msg: string) => log?.info?.(msg),
        handler,
      });
      activeRouteUnregisters.set(routeKey, unregister);

      log?.info?.(`Registered HTTP route: ${account.webhookPath} for WeChat`);

      return waitUntilAbort(ctx.abortSignal, () => {
        log?.info?.(`Stopping WeChat channel (account: ${accountId})`);
        if (typeof unregister === "function") unregister();
        activeRouteUnregisters.delete(routeKey);
      });
    },

    stopAccount: async (ctx: any) => {
      ctx.log?.info?.(`WeChat account ${ctx.accountId} stopped`);
    },
  },

  agentPrompt: {
    messageToolHints: () => [
      "",
      "### 微信消息格式",
      "微信仅支持纯文本消息（通过 bridge 转发）。",
      "",
      "**注意事项**:",
      "- 纯文本消息，不支持 Markdown",
      "- 消息长度建议不超过 4096 字符",
      "- 群聊中需要 @机器人 才能触发回复",
      "",
      "**最佳实践**:",
      "- 保持回复简洁明了",
      "- 使用换行和编号列表提高可读性",
      "- 避免过长的回复（微信会折叠长消息）",
    ],
  },
};
