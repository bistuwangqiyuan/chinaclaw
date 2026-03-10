import type { ResolvedWechatAccount } from "./types.js";

/**
 * Send a text message via the WeChat bridge's HTTP API.
 *
 * The bridge is expected to expose a POST endpoint that accepts:
 * { to: string, content: string, type?: "text" }
 */
export async function sendTextMessage(
  account: ResolvedWechatAccount,
  to: string,
  text: string,
): Promise<boolean> {
  if (!account.bridgeSendUrl) {
    throw new Error("WeChat bridge send URL not configured");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (account.webhookSecret) {
    headers["X-Webhook-Secret"] = account.webhookSecret;
  }

  const resp = await fetch(account.bridgeSendUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      to,
      content: text,
      type: "text",
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`WeChat bridge send failed: ${resp.status} ${errText}`);
  }
  return true;
}
