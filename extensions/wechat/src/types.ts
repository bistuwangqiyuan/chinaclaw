/**
 * WeChat channel uses an external webhook bridge approach.
 *
 * Supported bridges:
 * - wechaty (https://github.com/wechaty/wechaty) with webhook plugin
 * - itchat-uos (Python) with custom webhook forwarding
 * - WeChatFerry (https://github.com/lich0821/WeChatFerry) with HTTP API
 *
 * The bridge runs separately and forwards messages to OpenClaw via HTTP webhook,
 * and OpenClaw replies by calling the bridge's send API.
 */

export interface WechatChannelConfig {
  enabled?: boolean;
  /** URL of the webhook bridge's send endpoint (e.g. http://localhost:8080/send) */
  bridgeSendUrl?: string;
  /** Secret token for verifying incoming webhooks */
  webhookSecret?: string;
  webhookPath?: string;
  dmPolicy?: "open" | "allowlist" | "disabled";
  allowedUserIds?: string | string[];
  rateLimitPerMinute?: number;
  botName?: string;
  accounts?: Record<string, WechatAccountRaw>;
}

export interface WechatAccountRaw {
  enabled?: boolean;
  bridgeSendUrl?: string;
  webhookSecret?: string;
  webhookPath?: string;
  dmPolicy?: "open" | "allowlist" | "disabled";
  allowedUserIds?: string | string[];
  rateLimitPerMinute?: number;
  botName?: string;
}

export interface ResolvedWechatAccount {
  accountId: string;
  enabled: boolean;
  bridgeSendUrl: string;
  webhookSecret: string;
  webhookPath: string;
  dmPolicy: "open" | "allowlist" | "disabled";
  allowedUserIds: string[];
  rateLimitPerMinute: number;
  botName: string;
}

/**
 * Generic webhook payload from the bridge.
 * Bridges should forward messages in this format.
 */
export interface WechatWebhookPayload {
  /** Unique message ID */
  msgId: string;
  /** Sender's WeChat ID (wxid_xxx) */
  from: string;
  /** Sender's display name */
  fromName?: string;
  /** Chat room ID (for group messages) or empty for DMs */
  roomId?: string;
  /** Message type: text, image, file, etc. */
  type: string;
  /** Text content (for text messages) */
  content?: string;
  /** Timestamp in milliseconds */
  timestamp?: number;
}
