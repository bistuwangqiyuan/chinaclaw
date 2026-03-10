import type { DingtalkChannelConfig, ResolvedDingtalkAccount } from "./types.js";

function getChannelConfig(cfg: any): DingtalkChannelConfig | undefined {
  return cfg?.channels?.dingtalk;
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
  const hasBaseKey = channelCfg.appKey || process.env.DINGTALK_APP_KEY;
  if (hasBaseKey) {
    ids.add("default");
  }
  if (channelCfg.accounts) {
    for (const id of Object.keys(channelCfg.accounts)) {
      ids.add(id);
    }
  }
  return Array.from(ids);
}

export function resolveAccount(cfg: any, accountId?: string | null): ResolvedDingtalkAccount {
  const channelCfg = getChannelConfig(cfg) ?? {};
  const id = accountId || "default";
  const accountOverride = channelCfg.accounts?.[id] ?? {};

  return {
    accountId: id,
    enabled: accountOverride.enabled ?? channelCfg.enabled ?? true,
    appKey: accountOverride.appKey ?? channelCfg.appKey ?? process.env.DINGTALK_APP_KEY ?? "",
    appSecret:
      accountOverride.appSecret ??
      channelCfg.appSecret ??
      process.env.DINGTALK_APP_SECRET ??
      "",
    robotCode:
      accountOverride.robotCode ??
      channelCfg.robotCode ??
      process.env.DINGTALK_ROBOT_CODE ??
      "",
    webhookPath:
      accountOverride.webhookPath ?? channelCfg.webhookPath ?? "/webhook/dingtalk",
    dmPolicy: accountOverride.dmPolicy ?? channelCfg.dmPolicy ?? "allowlist",
    allowedUserIds: parseAllowedUserIds(
      accountOverride.allowedUserIds ?? channelCfg.allowedUserIds ?? "",
    ),
    rateLimitPerMinute: accountOverride.rateLimitPerMinute ?? channelCfg.rateLimitPerMinute ?? 30,
    botName: accountOverride.botName ?? channelCfg.botName ?? process.env.OPENCLAW_BOT_NAME ?? "OpenClaw",
  };
}
