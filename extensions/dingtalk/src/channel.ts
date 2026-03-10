import {
  DEFAULT_ACCOUNT_ID,
  setAccountEnabledInConfigSection,
  registerPluginHttpRoute,
  buildChannelConfigSchema,
} from "openclaw/plugin-sdk/dingtalk";
import { z } from "zod";
import { listAccountIds, resolveAccount } from "./accounts.js";
import { sendTextMessage } from "./client.js";
import { getDingtalkRuntime } from "./runtime.js";
import { startStreamClient } from "./stream-client.js";
import type { ResolvedDingtalkAccount } from "./types.js";
import { createWebhookHandler } from "./webhook-handler.js";

const CHANNEL_ID = "dingtalk";
const DingtalkConfigSchema = buildChannelConfigSchema(z.object({}).passthrough());

const activeRouteUnregisters = new Map<string, () => void>();

// Stash the latest sessionWebhook for each user so outbound sends can use it
const sessionWebhookCache = new Map<string, { url: string; expiresAt: number }>();

function cacheSessionWebhook(userId: string, url: string, expiresMs: number) {
  sessionWebhookCache.set(userId, { url, expiresAt: expiresMs });
}

function getCachedSessionWebhook(userId: string): string | undefined {
  const cached = sessionWebhookCache.get(userId);
  if (!cached || Date.now() > cached.expiresAt) {
    sessionWebhookCache.delete(userId);
    return undefined;
  }
  return cached.url;
}

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

export const dingtalkPlugin = {
  id: CHANNEL_ID,

  meta: {
    id: CHANNEL_ID,
    label: "DingTalk",
    selectionLabel: "DingTalk (钉钉)",
    detailLabel: "DingTalk",
    docsPath: "/channels/dingtalk",
    blurb: "钉钉企业机器人，支持 HTTP 回调。",
    order: 36,
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

  configSchema: DingtalkConfigSchema,

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
    idLabel: "dingtalkUserId",
    normalizeAllowEntry: (entry: string) => entry.toLowerCase().trim(),
    notifyApproval: async ({ cfg, id }: { cfg: any; id: string }) => {
      const account = resolveAccount(cfg);
      const webhook = getCachedSessionWebhook(id);
      if (webhook) {
        await sendTextMessage(account, id, "OpenClaw: 你的访问已获批准。", webhook);
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
      account: ResolvedDingtalkAccount;
    }) => {
      const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID;
      const channelCfg = (cfg as any).channels?.dingtalk;
      const useAccountPath = Boolean(channelCfg?.accounts?.[resolvedAccountId]);
      const basePath = useAccountPath
        ? `channels.dingtalk.accounts.${resolvedAccountId}.`
        : "channels.dingtalk.";
      return {
        policy: account.dmPolicy ?? "allowlist",
        allowFrom: account.allowedUserIds ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: basePath,
        approveHint: "openclaw pairing approve dingtalk <code>",
        normalizeEntry: (raw: string) => raw.toLowerCase().trim(),
      };
    },
    collectWarnings: ({ account }: { account: ResolvedDingtalkAccount }) => {
      const warnings: string[] = [];
      if (!account.appKey) {
        warnings.push("- DingTalk: appKey 未配置，无法获取 access token。");
      }
      if (!account.appSecret) {
        warnings.push("- DingTalk: appSecret 未配置。");
      }
      if (account.dmPolicy === "open") {
        warnings.push('- DingTalk: dmPolicy="open" 允许所有用户发送消息，生产环境建议使用 "allowlist"。');
      }
      return warnings;
    },
  },

  messaging: {
    normalizeTarget: (target: string) => {
      const trimmed = target.trim();
      if (!trimmed) return undefined;
      return trimmed.replace(/^(dingtalk|dingding|ding):/i, "").trim();
    },
    targetResolver: {
      looksLikeId: (id: string) => {
        const trimmed = id?.trim();
        if (!trimmed) return false;
        return /^[a-zA-Z0-9_-]+$/.test(trimmed) || /^dingtalk:/i.test(trimmed);
      },
      hint: "<staffId>",
    },
  },

  directory: {
    self: async () => null,
    listPeers: async () => [],
    listGroups: async () => [],
  },

  outbound: {
    deliveryMode: "gateway" as const,
    textChunkLimit: 20000,

    sendText: async ({ to, text, accountId, cfg }: any) => {
      const account: ResolvedDingtalkAccount = resolveAccount(cfg ?? {}, accountId);
      if (!account.appKey) {
        throw new Error("DingTalk appKey 未配置");
      }
      const webhook = getCachedSessionWebhook(to);
      const ok = await sendTextMessage(account, to, text, webhook);
      if (!ok) {
        throw new Error("发送钉钉消息失败");
      }
      return { channel: CHANNEL_ID, messageId: `dt-${Date.now()}`, chatId: to };
    },
  },

  gateway: {
    startAccount: async (ctx: any) => {
      const { cfg, accountId, log } = ctx;
      const account = resolveAccount(cfg, accountId);

      if (!account.enabled) {
        log?.info?.(`DingTalk account ${accountId} is disabled, skipping`);
        return waitUntilAbort(ctx.abortSignal);
      }

      if (!account.appKey || !account.appSecret) {
        log?.warn?.(`DingTalk account ${accountId} not fully configured (missing appKey or appSecret)`);
        return waitUntilAbort(ctx.abortSignal);
      }

      // Shared message delivery handler for both Stream and webhook modes
      const deliverMessage = async (msg: {
        body: string;
        from: string;
        senderName: string;
        sessionKey: string;
        chatType: "direct" | "group";
        sessionWebhook?: string;
        commandAuthorized?: boolean;
      }) => {
        const rt = getDingtalkRuntime();
        const currentCfg = await rt.config.loadConfig();

        if (msg.sessionWebhook) {
          const ttl = 3600_000;
          cacheSessionWebhook(msg.from, msg.sessionWebhook, Date.now() + ttl);
        }

        const msgCtx = rt.channel.reply.finalizeInboundContext({
          Body: msg.body,
          RawBody: msg.body,
          CommandBody: msg.body,
          From: `dingtalk:${msg.from}`,
          To: `dingtalk:${msg.from}`,
          SessionKey: msg.sessionKey,
          AccountId: account.accountId,
          OriginatingChannel: CHANNEL_ID,
          OriginatingTo: `dingtalk:${msg.from}`,
          ChatType: msg.chatType,
          SenderName: msg.senderName,
          SenderId: msg.from,
          Provider: CHANNEL_ID,
          Surface: CHANNEL_ID,
          ConversationLabel: msg.senderName || msg.from,
          Timestamp: Date.now(),
          CommandAuthorized: msg.commandAuthorized ?? false,
        });

        await rt.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
          ctx: msgCtx,
          cfg: currentCfg,
          dispatcherOptions: {
            deliver: async (payload: { text?: string; body?: string }) => {
              const text = payload?.text ?? payload?.body;
              if (text) {
                const webhook = getCachedSessionWebhook(msg.from);
                await sendTextMessage(account, msg.from, text, webhook);
              }
            },
            onReplyStart: () => {
              log?.info?.(`Agent reply started for ${msg.from}`);
            },
          },
        });
      };

      // Default to Stream mode (no public IP needed); fall back to webhook
      const connectionMode = (cfg.channels?.dingtalk as any)?.connectionMode ?? "stream";

      if (connectionMode === "stream") {
        log?.info?.(`Starting DingTalk channel in Stream mode (account: ${accountId})`);

        return startStreamClient(
          {
            account,
            onMessage: async (msg) => {
              await deliverMessage({
                body: msg.body,
                from: msg.from,
                senderName: msg.senderName,
                sessionKey: msg.sessionKey,
                chatType: msg.chatType,
                sessionWebhook: msg.sessionWebhook,
              });
            },
            log,
          },
          ctx.abortSignal,
        );
      }

      // Webhook mode fallback
      log?.info?.(`Starting DingTalk channel in webhook mode (account: ${accountId}, path: ${account.webhookPath})`);

      const handler = createWebhookHandler({
        account,
        deliver: async (msg) => {
          await deliverMessage({
            body: msg.body,
            from: msg.from,
            senderName: msg.senderName,
            sessionKey: msg.sessionKey,
            chatType: msg.chatType,
            sessionWebhook: msg.sessionWebhook,
            commandAuthorized: msg.commandAuthorized,
          });
          return null;
        },
        log,
      });

      const routeKey = `${accountId}:${account.webhookPath}`;
      const prevUnregister = activeRouteUnregisters.get(routeKey);
      if (prevUnregister) {
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

      return waitUntilAbort(ctx.abortSignal, () => {
        log?.info?.(`Stopping DingTalk channel (account: ${accountId})`);
        if (typeof unregister === "function") unregister();
        activeRouteUnregisters.delete(routeKey);
      });
    },

    stopAccount: async (ctx: any) => {
      ctx.log?.info?.(`DingTalk account ${ctx.accountId} stopped`);
    },
  },

  agentPrompt: {
    messageToolHints: () => [
      "",
      "### 钉钉消息格式",
      "钉钉机器人支持以下消息格式：",
      "",
      "**文本消息**: 直接发送纯文本。",
      "**Markdown**: 使用标准 Markdown 语法（标题、加粗、列表、链接等）。",
      "",
      "**注意事项**:",
      "- 单条消息不超过 20000 字符",
      "- 群聊中机器人回复会 @提问者",
      "- 支持 Markdown 格式化输出",
      "",
      "**最佳实践**:",
      "- 使用简洁的回复风格",
      "- 用 Markdown 列表和标题组织长回复",
      "- 代码使用 ``` 代码块包裹",
    ],
  },
};
