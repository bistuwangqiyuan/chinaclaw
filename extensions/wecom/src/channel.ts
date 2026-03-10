import {
  DEFAULT_ACCOUNT_ID,
  setAccountEnabledInConfigSection,
  registerPluginHttpRoute,
  buildChannelConfigSchema,
} from "openclaw/plugin-sdk/wecom";
import { z } from "zod";
import { listAccountIds, resolveAccount } from "./accounts.js";
import { sendTextMessage } from "./client.js";
import { getWecomRuntime } from "./runtime.js";
import type { ResolvedWecomAccount } from "./types.js";
import { createWebhookHandler } from "./webhook-handler.js";

const CHANNEL_ID = "wecom";
const WecomConfigSchema = buildChannelConfigSchema(z.object({}).passthrough());

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

export const wecomPlugin = {
  id: CHANNEL_ID,

  meta: {
    id: CHANNEL_ID,
    label: "WeCom",
    selectionLabel: "WeCom (企业微信)",
    detailLabel: "WeCom",
    docsPath: "/channels/wecom",
    blurb: "企业微信应用消息机器人。",
    order: 37,
  },

  capabilities: {
    chatTypes: ["direct" as const],
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

  configSchema: WecomConfigSchema,

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
    idLabel: "wecomUserId",
    normalizeAllowEntry: (entry: string) => entry.toLowerCase().trim(),
    notifyApproval: async ({ cfg, id }: { cfg: any; id: string }) => {
      const account = resolveAccount(cfg);
      if (!account.corpId) return;
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
      account: ResolvedWecomAccount;
    }) => {
      const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID;
      const channelCfg = (cfg as any).channels?.wecom;
      const useAccountPath = Boolean(channelCfg?.accounts?.[resolvedAccountId]);
      const basePath = useAccountPath
        ? `channels.wecom.accounts.${resolvedAccountId}.`
        : "channels.wecom.";
      return {
        policy: account.dmPolicy ?? "allowlist",
        allowFrom: account.allowedUserIds ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: basePath,
        approveHint: "openclaw pairing approve wecom <code>",
        normalizeEntry: (raw: string) => raw.toLowerCase().trim(),
      };
    },
    collectWarnings: ({ account }: { account: ResolvedWecomAccount }) => {
      const warnings: string[] = [];
      if (!account.corpId) {
        warnings.push("- WeCom: corpId 未配置。");
      }
      if (!account.secret) {
        warnings.push("- WeCom: secret 未配置，无法获取 access token。");
      }
      if (!account.token) {
        warnings.push("- WeCom: 回调 token 未配置，webhook 将拒绝所有请求。");
      }
      if (!account.encodingAESKey) {
        warnings.push("- WeCom: encodingAESKey 未配置，无法解密回调消息。");
      }
      if (account.dmPolicy === "open") {
        warnings.push('- WeCom: dmPolicy="open" 允许所有用户发送消息，生产环境建议使用 "allowlist"。');
      }
      return warnings;
    },
  },

  messaging: {
    normalizeTarget: (target: string) => {
      const trimmed = target.trim();
      if (!trimmed) return undefined;
      return trimmed.replace(/^(wecom|wxwork|wechat-work):/i, "").trim();
    },
    targetResolver: {
      looksLikeId: (id: string) => {
        const trimmed = id?.trim();
        if (!trimmed) return false;
        return /^[a-zA-Z0-9_-]+$/.test(trimmed) || /^wecom:/i.test(trimmed);
      },
      hint: "<userId>",
    },
  },

  directory: {
    self: async () => null,
    listPeers: async () => [],
    listGroups: async () => [],
  },

  outbound: {
    deliveryMode: "gateway" as const,
    textChunkLimit: 2048,

    sendText: async ({ to, text, accountId, cfg }: any) => {
      const account: ResolvedWecomAccount = resolveAccount(cfg ?? {}, accountId);
      if (!account.corpId || !account.secret) {
        throw new Error("WeCom corpId 或 secret 未配置");
      }
      const ok = await sendTextMessage(account, to, text);
      if (!ok) {
        throw new Error("发送企业微信消息失败");
      }
      return { channel: CHANNEL_ID, messageId: `wc-${Date.now()}`, chatId: to };
    },
  },

  gateway: {
    startAccount: async (ctx: any) => {
      const { cfg, accountId, log } = ctx;
      const account = resolveAccount(cfg, accountId);

      if (!account.enabled) {
        log?.info?.(`WeCom account ${accountId} is disabled, skipping`);
        return waitUntilAbort(ctx.abortSignal);
      }

      if (!account.corpId || !account.secret) {
        log?.warn?.(`WeCom account ${accountId} not fully configured (missing corpId or secret)`);
        return waitUntilAbort(ctx.abortSignal);
      }

      log?.info?.(`Starting WeCom channel (account: ${accountId}, path: ${account.webhookPath})`);

      const handler = createWebhookHandler({
        account,
        deliver: async (msg) => {
          const rt = getWecomRuntime();
          const currentCfg = await rt.config.loadConfig();

          const msgCtx = rt.channel.reply.finalizeInboundContext({
            Body: msg.body,
            RawBody: msg.body,
            CommandBody: msg.body,
            From: `wecom:${msg.from}`,
            To: `wecom:${msg.from}`,
            SessionKey: msg.sessionKey,
            AccountId: account.accountId,
            OriginatingChannel: CHANNEL_ID,
            OriginatingTo: `wecom:${msg.from}`,
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

      log?.info?.(`Registered HTTP route: ${account.webhookPath} for WeCom`);

      return waitUntilAbort(ctx.abortSignal, () => {
        log?.info?.(`Stopping WeCom channel (account: ${accountId})`);
        if (typeof unregister === "function") unregister();
        activeRouteUnregisters.delete(routeKey);
      });
    },

    stopAccount: async (ctx: any) => {
      ctx.log?.info?.(`WeCom account ${ctx.accountId} stopped`);
    },
  },

  agentPrompt: {
    messageToolHints: () => [
      "",
      "### 企业微信消息格式",
      "企业微信应用消息支持以下格式：",
      "",
      "**文本消息**: 直接发送纯文本，最大 2048 字节。",
      "**Markdown**: 支持有限的 Markdown（标题、加粗、链接、引用）。",
      "",
      "**注意事项**:",
      "- 文本消息最大 2048 字节",
      "- Markdown 消息最大 2048 字节",
      "- 不支持 @ 提及",
      "",
      "**最佳实践**:",
      "- 保持回复简洁",
      "- 使用 Markdown 格式化长回复",
      "- 链接使用 [文本](URL) 格式",
    ],
  },
};
