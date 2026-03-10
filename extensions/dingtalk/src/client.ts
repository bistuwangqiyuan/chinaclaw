import type { ResolvedDingtalkAccount } from "./types.js";

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get access token from DingTalk Open API.
 * Tokens are valid for 7200 seconds; cache with 5-minute buffer.
 */
export async function getAccessToken(account: ResolvedDingtalkAccount): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const resp = await fetch("https://api.dingtalk.com/v1.0/oauth2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appKey: account.appKey,
      appSecret: account.appSecret,
    }),
  });

  if (!resp.ok) {
    throw new Error(`DingTalk getAccessToken failed: ${resp.status} ${await resp.text()}`);
  }

  const data = (await resp.json()) as { accessToken: string; expireIn: number };
  cachedToken = {
    token: data.accessToken,
    expiresAt: Date.now() + (data.expireIn - 300) * 1000,
  };
  return data.accessToken;
}

/**
 * Send a text message to a user (1:1 DM) via DingTalk Robot API.
 * Uses the sessionWebhook if available (preferred for callback responses),
 * otherwise falls back to the batch-send API.
 */
export async function sendTextMessage(
  account: ResolvedDingtalkAccount,
  userId: string,
  text: string,
  sessionWebhook?: string,
): Promise<boolean> {
  if (sessionWebhook) {
    return sendViaSessionWebhook(sessionWebhook, text);
  }
  return sendViaBatchApi(account, userId, text);
}

async function sendViaSessionWebhook(webhookUrl: string, text: string): Promise<boolean> {
  const resp = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      msgtype: "text",
      text: { content: text },
    }),
  });
  return resp.ok;
}

async function sendViaBatchApi(
  account: ResolvedDingtalkAccount,
  userId: string,
  text: string,
): Promise<boolean> {
  const token = await getAccessToken(account);

  const resp = await fetch(
    "https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-acs-dingtalk-access-token": token,
      },
      body: JSON.stringify({
        robotCode: account.robotCode,
        userIds: [userId],
        msgKey: "sampleText",
        msgParam: JSON.stringify({ content: text }),
      }),
    },
  );

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`DingTalk batchSend failed: ${resp.status} ${errText}`);
  }
  return true;
}

/**
 * Send a markdown message via session webhook (only available during callback).
 */
export async function sendMarkdownMessage(
  sessionWebhook: string,
  title: string,
  text: string,
): Promise<boolean> {
  const resp = await fetch(sessionWebhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      msgtype: "markdown",
      markdown: { title, text },
    }),
  });
  return resp.ok;
}
