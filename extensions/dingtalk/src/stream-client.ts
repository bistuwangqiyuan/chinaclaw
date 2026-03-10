/**
 * DingTalk Stream mode client.
 *
 * Uses the official dingtalk-stream SDK to maintain a persistent
 * WebSocket connection to DingTalk servers (no public IP needed).
 */

import type { ResolvedDingtalkAccount } from "./types.js";

export interface StreamMessagePayload {
  body: string;
  from: string;
  senderName: string;
  sessionKey: string;
  chatType: "direct" | "group";
  conversationId: string;
  sessionWebhook?: string;
}

interface StreamClientOptions {
  account: ResolvedDingtalkAccount;
  onMessage: (msg: StreamMessagePayload) => Promise<void>;
  log?: { info?: (...args: any[]) => void; warn?: (...args: any[]) => void };
}

export async function startStreamClient(
  opts: StreamClientOptions,
  abortSignal?: AbortSignal,
): Promise<void> {
  const { account, onMessage, log } = opts;

  // Dynamic import: dingtalk-stream is a CJS package
  const { DWClient, TOPIC_ROBOT } = await import("dingtalk-stream");

  const client = new DWClient({
    clientId: account.appKey,
    clientSecret: account.appSecret,
  });

  client.registerCallbackListener(TOPIC_ROBOT, async (res: any) => {
    try {
      const data = JSON.parse(res.data);

      const text = data?.text?.content?.trim() ?? "";
      if (!text) {
        // Ack empty messages to avoid DingTalk retries
        client.socketCallBackResponse(res.headers, "");
        return;
      }

      const senderId = data.senderStaffId || data.senderId || "";
      const senderNick = data.senderNick || senderId;
      const chatType = data.conversationType === "2" ? "group" : "direct";
      const conversationId = data.conversationId || "";

      log?.info?.(`DingTalk Stream message from ${senderNick} (${senderId}): ${text.slice(0, 60)}`);

      await onMessage({
        body: text,
        from: senderId,
        senderName: senderNick,
        sessionKey: `dingtalk:${senderId}`,
        chatType,
        conversationId,
        sessionWebhook: data.sessionWebhook,
      });

      // Ack the message so DingTalk doesn't retry
      client.socketCallBackResponse(res.headers, "");
    } catch (err) {
      log?.warn?.(`DingTalk Stream message handling error: ${err}`);
      try {
        client.socketCallBackResponse(res.headers, "");
      } catch {
        // ignore ack errors
      }
    }
  });

  log?.info?.("DingTalk Stream: connecting...");
  await client.connect();
  log?.info?.("DingTalk Stream: connected successfully");

  // Keep alive until abort signal fires
  return new Promise<void>((resolve) => {
    if (!abortSignal) return;

    const cleanup = () => {
      log?.info?.("DingTalk Stream: disconnecting...");
      try {
        client.disconnect();
      } catch {
        // ignore
      }
      resolve();
    };

    if (abortSignal.aborted) {
      cleanup();
      return;
    }
    abortSignal.addEventListener("abort", cleanup, { once: true });
  });
}
