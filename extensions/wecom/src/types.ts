export interface WecomChannelConfig {
  enabled?: boolean;
  corpId?: string;
  agentId?: string;
  secret?: string;
  token?: string;
  encodingAESKey?: string;
  webhookPath?: string;
  dmPolicy?: "open" | "allowlist" | "disabled";
  allowedUserIds?: string | string[];
  rateLimitPerMinute?: number;
  botName?: string;
  accounts?: Record<string, WecomAccountRaw>;
}

export interface WecomAccountRaw {
  enabled?: boolean;
  corpId?: string;
  agentId?: string;
  secret?: string;
  token?: string;
  encodingAESKey?: string;
  webhookPath?: string;
  dmPolicy?: "open" | "allowlist" | "disabled";
  allowedUserIds?: string | string[];
  rateLimitPerMinute?: number;
  botName?: string;
}

export interface ResolvedWecomAccount {
  accountId: string;
  enabled: boolean;
  corpId: string;
  agentId: string;
  secret: string;
  token: string;
  encodingAESKey: string;
  webhookPath: string;
  dmPolicy: "open" | "allowlist" | "disabled";
  allowedUserIds: string[];
  rateLimitPerMinute: number;
  botName: string;
}

/** WeCom callback XML payload (parsed to object) */
export interface WecomCallbackPayload {
  ToUserName: string;
  FromUserName: string;
  CreateTime: string;
  MsgType: string;
  Content?: string;
  MsgId?: string;
  AgentID?: string;
  PicUrl?: string;
  MediaId?: string;
}
