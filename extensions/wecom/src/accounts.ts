import type { WecomChannelConfig, ResolvedWecomAccount } from "./types.js";

function getChannelConfig(cfg: any): WecomChannelConfig | undefined {
  return cfg?.channels?.wecom;
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
  const hasBaseCorpId = channelCfg.corpId || process.env.WECOM_CORP_ID;
  if (hasBaseCorpId) {
    ids.add("default");
  }
  if (channelCfg.accounts) {
    for (const id of Object.keys(channelCfg.accounts)) {
      ids.add(id);
    }
  }
  return Array.from(ids);
}

export function resolveAccount(cfg: any, accountId?: string | null): ResolvedWecomAccount {
  const channelCfg = getChannelConfig(cfg) ?? {};
  const id = accountId || "default";
  const accountOverride = channelCfg.accounts?.[id] ?? {};

  return {
    accountId: id,
    enabled: accountOverride.enabled ?? channelCfg.enabled ?? true,
    corpId: accountOverride.corpId ?? channelCfg.corpId ?? process.env.WECOM_CORP_ID ?? "",
    agentId: accountOverride.agentId ?? channelCfg.agentId ?? process.env.WECOM_AGENT_ID ?? "",
    secret: accountOverride.secret ?? channelCfg.secret ?? process.env.WECOM_SECRET ?? "",
    token: accountOverride.token ?? channelCfg.token ?? process.env.WECOM_TOKEN ?? "",
    encodingAESKey:
      accountOverride.encodingAESKey ??
      channelCfg.encodingAESKey ??
      process.env.WECOM_ENCODING_AES_KEY ??
      "",
    webhookPath: accountOverride.webhookPath ?? channelCfg.webhookPath ?? "/webhook/wecom",
    dmPolicy: accountOverride.dmPolicy ?? channelCfg.dmPolicy ?? "allowlist",
    allowedUserIds: parseAllowedUserIds(
      accountOverride.allowedUserIds ?? channelCfg.allowedUserIds ?? "",
    ),
    rateLimitPerMinute: accountOverride.rateLimitPerMinute ?? channelCfg.rateLimitPerMinute ?? 30,
    botName: accountOverride.botName ?? channelCfg.botName ?? process.env.OPENCLAW_BOT_NAME ?? "OpenClaw",
  };
}
