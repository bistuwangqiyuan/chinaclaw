import type { IncomingMessage, ServerResponse } from "node:http";
import type { ResolvedWechatAccount, WechatWebhookPayload } from "./types.js";

export interface WechatDeliverPayload {
  body: string;
  from: string;
  senderName: string;
  sessionKey: string;
  chatType: "direct" | "group";
  commandAuthorized: boolean;
}

interface WebhookHandlerOptions {
  account: ResolvedWechatAccount;
  deliver: (msg: WechatDeliverPayload) => Promise<unknown>;
  log?: { info?: (...args: any[]) => void; warn?: (...args: any[]) => void };
}

/**
 * Create an HTTP request handler for WeChat bridge webhooks.
 *
 * The bridge forwards incoming WeChat messages as JSON POST requests.
 * Expected payload format: WechatWebhookPayload (see types.ts).
 */
export function createWebhookHandler(opts: WebhookHandlerOptions) {
  const { account, deliver, log } = opts;

  return async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== "POST") {
      res.writeHead(405);
      res.end("Method Not Allowed");
      return;
    }

    // Verify webhook secret if configured
    if (account.webhookSecret) {
      const providedSecret = req.headers["x-webhook-secret"] as string | undefined;
      if (providedSecret !== account.webhookSecret) {
        log?.warn?.("WeChat webhook secret mismatch");
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const rawBody = Buffer.concat(chunks).toString("utf8");

    let payload: WechatWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      res.writeHead(400);
      res.end("Invalid JSON");
      return;
    }

    // Only handle text messages
    if (payload.type !== "text" || !payload.content) {
      res.writeHead(200);
      res.end("OK");
      return;
    }

    const text = payload.content.trim();
    if (!text) {
      res.writeHead(200);
      res.end("OK");
      return;
    }

    const chatType = payload.roomId ? "group" : "direct";
    const senderId = payload.from;
    const senderName = payload.fromName || payload.from;

    log?.info?.(`WeChat message from ${senderName} (${senderId}): ${text.slice(0, 60)}`);

    try {
      await deliver({
        body: text,
        from: senderId,
        senderName,
        sessionKey: `wechat:${senderId}`,
        chatType,
        commandAuthorized: false,
      });
    } catch (err) {
      log?.warn?.(`WeChat deliver error: ${err}`);
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true }));
  };
}
