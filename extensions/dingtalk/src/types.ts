export interface DingtalkChannelConfig {
  enabled?: boolean;
  appKey?: string;
  appSecret?: string;
  robotCode?: string;
  webhookPath?: string;
  dmPolicy?: "open" | "allowlist" | "disabled";
  allowedUserIds?: string | string[];
  rateLimitPerMinute?: number;
  botName?: string;
  accounts?: Record<string, DingtalkAccountRaw>;
}

export interface DingtalkAccountRaw {
  enabled?: boolean;
  appKey?: string;
  appSecret?: string;
  robotCode?: string;
  webhookPath?: string;
  dmPolicy?: "open" | "allowlist" | "disabled";
  allowedUserIds?: string | string[];
  rateLimitPerMinute?: number;
  botName?: string;
}

export interface ResolvedDingtalkAccount {
  accountId: string;
  enabled: boolean;
  appKey: string;
  appSecret: string;
  robotCode: string;
  webhookPath: string;
  dmPolicy: "open" | "allowlist" | "disabled";
  allowedUserIds: string[];
  rateLimitPerMinute: number;
  botName: string;
}

/** DingTalk robot callback payload (Stream or HTTP) */
export interface DingtalkCallbackPayload {
  msgtype: string;
  text?: { content: string };
  msgId: string;
  createAt: string;
  conversationType: string; // "1" = private, "2" = group
  conversationId: string;
  conversationTitle?: string;
  senderId: string;
  senderNick: string;
  senderCorpId?: string;
  senderStaffId?: string;
  chatbotCorpId?: string;
  chatbotUserId?: string;
  isAdmin?: boolean;
  sessionWebhook?: string;
  sessionWebhookExpiredTime?: number;
}
