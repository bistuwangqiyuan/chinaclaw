import type { WechatChannelConfig, ResolvedWechatAccount } from "./types.js";

function getChannelConfig(cfg: any): WechatChannelConfig | undefined {
  return cfg?.channels?.wechat;
}

function parseAllowedUserIds(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function listAccountIds(cfg: any): string[] {
  const channelCfg = getChannelConfig(cfg);
  if (!channelCfg) return [];

  const ids = new Set<string>();
  const hasBaseBridge = channelCfg.bridgeSendUrl || process.env.WECHAT_BRIDGE_SEND_URL;
  if (hasBaseBridge) {
    ids.add("default");
  }
  if (channelCfg.accounts) {
    for (const id of Object.keys(channelCfg.accounts)) {
      ids.add(id);
    }
  }
  return Array.from(ids);
}

export function resolveAccount(cfg: any, accountId?: string | null): ResolvedWechatAccount {
  const channelCfg = getChannelConfig(cfg) ?? {};
  const id = accountId || "default";
  const accountOverride = channelCfg.accounts?.[id] ?? {};

  return {
    accountId: id,
    enabled: accountOverride.enabled ?? channelCfg.enabled ?? true,
    bridgeSendUrl:
      accountOverride.bridgeSendUrl ??
      channelCfg.bridgeSendUrl ??
      process.env.WECHAT_BRIDGE_SEND_URL ??
      "",
    webhookSecret:
      accountOverride.webhookSecret ??
      channelCfg.webhookSecret ??
      process.env.WECHAT_WEBHOOK_SECRET ??
      "",
    webhookPath: accountOverride.webhookPath ?? channelCfg.webhookPath ?? "/webhook/wechat",
    dmPolicy: accountOverride.dmPolicy ?? channelCfg.dmPolicy ?? "allowlist",
    allowedUserIds: parseAllowedUserIds(
      accountOverride.allowedUserIds ?? channelCfg.allowedUserIds ?? "",
    ),
    rateLimitPerMinute: accountOverride.rateLimitPerMinute ?? channelCfg.rateLimitPerMinute ?? 30,
    botName: accountOverride.botName ?? channelCfg.botName ?? process.env.OPENCLAW_BOT_NAME ?? "OpenClaw",
  };
}
