import type { IncomingMessage, ServerResponse } from "node:http";
import type { ResolvedDingtalkAccount, DingtalkCallbackPayload } from "./types.js";

export interface DingtalkDeliverPayload {
  body: string;
  from: string;
  senderName: string;
  sessionKey: string;
  chatType: "direct" | "group";
  commandAuthorized: boolean;
  sessionWebhook?: string;
}

interface WebhookHandlerOptions {
  account: ResolvedDingtalkAccount;
  deliver: (msg: DingtalkDeliverPayload) => Promise<unknown>;
  log?: { info?: (...args: any[]) => void; warn?: (...args: any[]) => void };
}

function hmacSha256Hex(secret: string, data: string): Promise<string> {
  // Dynamic import to keep top-level clean
  return import("node:crypto").then(({ createHmac }) =>
    createHmac("sha256", secret).update(data).digest("hex"),
  );
}

async function verifySignature(
  account: ResolvedDingtalkAccount,
  timestamp: string | undefined,
  sign: string | undefined,
): Promise<boolean> {
  if (!account.appSecret || !timestamp || !sign) return false;
  const stringToSign = `${timestamp}\n${account.appSecret}`;
  const { createHmac } = await import("node:crypto");
  const hmac = createHmac("sha256", account.appSecret).update(stringToSign).digest("base64");
  return hmac === sign;
}

/**
 * Create an HTTP request handler for DingTalk robot callbacks.
 *
 * DingTalk sends POST requests with JSON body containing message data.
 * The handler verifies the signature, extracts message content, and
 * dispatches to the OpenClaw message pipeline.
 */
export function createWebhookHandler(opts: WebhookHandlerOptions) {
  const { account, deliver, log } = opts;

  return async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== "POST") {
      res.writeHead(405);
      res.end("Method Not Allowed");
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const rawBody = Buffer.concat(chunks).toString("utf8");

    let payload: DingtalkCallbackPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      res.writeHead(400);
      res.end("Invalid JSON");
      return;
    }

    // Signature verification
    const timestamp = req.headers["timestamp"] as string | undefined;
    const sign = req.headers["sign"] as string | undefined;
    if (account.appSecret && timestamp && sign) {
      const valid = await verifySignature(account, timestamp, sign);
      if (!valid) {
        log?.warn?.("DingTalk webhook signature verification failed");
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
    }

    // Extract text content
    let text = "";
    if (payload.msgtype === "text" && payload.text?.content) {
      text = payload.text.content.trim();
    } else {
      text = `[${payload.msgtype ?? "unknown"} message]`;
    }

    if (!text) {
      res.writeHead(200);
      res.end("OK");
      return;
    }

    const chatType = payload.conversationType === "2" ? "group" : "direct";
    const senderId = payload.senderStaffId || payload.senderId;

    log?.info?.(
      `DingTalk message from ${payload.senderNick} (${senderId}): ${text.slice(0, 60)}`,
    );

    try {
      await deliver({
        body: text,
        from: senderId,
        senderName: payload.senderNick,
        sessionKey: `dingtalk:${senderId}`,
        chatType,
        commandAuthorized: false,
        sessionWebhook: payload.sessionWebhook,
      });
    } catch (err) {
      log?.warn?.(`DingTalk deliver error: ${err}`);
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end("{}");
  };
}
