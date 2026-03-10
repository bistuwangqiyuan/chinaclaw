import type { IncomingMessage, ServerResponse } from "node:http";
import type { ResolvedWecomAccount, WecomCallbackPayload } from "./types.js";
import { decryptMessage, verifySignature } from "./crypto.js";

export interface WecomDeliverPayload {
  body: string;
  from: string;
  senderName: string;
  sessionKey: string;
  chatType: "direct";
  commandAuthorized: boolean;
}

interface WebhookHandlerOptions {
  account: ResolvedWecomAccount;
  deliver: (msg: WecomDeliverPayload) => Promise<unknown>;
  log?: { info?: (...args: any[]) => void; warn?: (...args: any[]) => void };
}

/**
 * Parse a simple XML string into a key-value object.
 * Only handles flat WeCom callback XML (no nested elements).
 */
function parseSimpleXml(xml: string): Record<string, string> {
  const result: Record<string, string> = {};
  const regex = /<(\w+)><!\[CDATA\[(.*?)\]\]><\/\1>|<(\w+)>(.*?)<\/\3>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    const key = match[1] || match[3];
    const value = match[2] || match[4];
    if (key && value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Create an HTTP request handler for WeCom callback events.
 *
 * WeCom sends:
 * - GET requests for URL verification (echostr challenge)
 * - POST requests with encrypted XML for message events
 */
export function createWebhookHandler(opts: WebhookHandlerOptions) {
  const { account, deliver, log } = opts;

  return async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const msgSignature = url.searchParams.get("msg_signature") ?? "";
    const timestamp = url.searchParams.get("timestamp") ?? "";
    const nonce = url.searchParams.get("nonce") ?? "";

    // GET: URL verification
    if (req.method === "GET") {
      const echostr = url.searchParams.get("echostr") ?? "";
      if (!echostr) {
        res.writeHead(400);
        res.end("Missing echostr");
        return;
      }

      const expectedSig = verifySignature(account.token, timestamp, nonce, echostr);
      if (expectedSig !== msgSignature) {
        log?.warn?.("WeCom URL verification signature mismatch");
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      // Decrypt echostr and return plaintext
      try {
        const decrypted = decryptMessage(account.encodingAESKey, echostr);
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end(decrypted);
      } catch (err) {
        log?.warn?.(`WeCom echostr decrypt error: ${err}`);
        res.writeHead(500);
        res.end("Decrypt error");
      }
      return;
    }

    // POST: message callback
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

    // Parse outer XML to get encrypted content
    const outerXml = parseSimpleXml(rawBody);
    const encryptedMsg = outerXml.Encrypt;
    if (!encryptedMsg) {
      res.writeHead(400);
      res.end("Missing Encrypt");
      return;
    }

    // Verify signature
    const expectedSig = verifySignature(account.token, timestamp, nonce, encryptedMsg);
    if (expectedSig !== msgSignature) {
      log?.warn?.("WeCom message signature verification failed");
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    // Decrypt message
    let decryptedXml: string;
    try {
      decryptedXml = decryptMessage(account.encodingAESKey, encryptedMsg);
    } catch (err) {
      log?.warn?.(`WeCom decrypt error: ${err}`);
      res.writeHead(500);
      res.end("Decrypt error");
      return;
    }

    const payload = parseSimpleXml(decryptedXml) as unknown as WecomCallbackPayload;

    // Only handle text messages for now
    if (payload.MsgType !== "text" || !payload.Content) {
      res.writeHead(200);
      res.end("success");
      return;
    }

    const text = payload.Content.trim();
    if (!text) {
      res.writeHead(200);
      res.end("success");
      return;
    }

    const senderId = payload.FromUserName;
    log?.info?.(`WeCom message from ${senderId}: ${text.slice(0, 60)}`);

    try {
      await deliver({
        body: text,
        from: senderId,
        senderName: senderId,
        sessionKey: `wecom:${senderId}`,
        chatType: "direct",
        commandAuthorized: false,
      });
    } catch (err) {
      log?.warn?.(`WeCom deliver error: ${err}`);
    }

    // WeCom requires "success" response to acknowledge
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("success");
  };
}
