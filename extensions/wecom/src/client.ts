import type { ResolvedWecomAccount } from "./types.js";

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get access token from WeCom API.
 * Tokens are valid for 7200 seconds; cache with 5-minute buffer.
 */
export async function getAccessToken(account: ResolvedWecomAccount): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(account.corpId)}&corpsecret=${encodeURIComponent(account.secret)}`;
  const resp = await fetch(url);

  if (!resp.ok) {
    throw new Error(`WeCom gettoken failed: ${resp.status} ${await resp.text()}`);
  }

  const data = (await resp.json()) as { errcode: number; errmsg: string; access_token: string; expires_in: number };
  if (data.errcode !== 0) {
    throw new Error(`WeCom gettoken error: ${data.errcode} ${data.errmsg}`);
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };
  return data.access_token;
}

/**
 * Send a text message to a WeCom user via Application Message API.
 */
export async function sendTextMessage(
  account: ResolvedWecomAccount,
  userId: string,
  text: string,
): Promise<boolean> {
  const token = await getAccessToken(account);

  const resp = await fetch(
    `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        touser: userId,
        msgtype: "text",
        agentid: Number(account.agentId),
        text: { content: text },
      }),
    },
  );

  if (!resp.ok) {
    throw new Error(`WeCom message send failed: ${resp.status} ${await resp.text()}`);
  }

  const data = (await resp.json()) as { errcode: number; errmsg: string };
  if (data.errcode !== 0) {
    throw new Error(`WeCom message send error: ${data.errcode} ${data.errmsg}`);
  }
  return true;
}

/**
 * Send a markdown message to a WeCom user.
 */
export async function sendMarkdownMessage(
  account: ResolvedWecomAccount,
  userId: string,
  content: string,
): Promise<boolean> {
  const token = await getAccessToken(account);

  const resp = await fetch(
    `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        touser: userId,
        msgtype: "markdown",
        agentid: Number(account.agentId),
        markdown: { content },
      }),
    },
  );

  if (!resp.ok) {
    throw new Error(`WeCom markdown send failed: ${resp.status}`);
  }

  const data = (await resp.json()) as { errcode: number; errmsg: string };
  if (data.errcode !== 0) {
    throw new Error(`WeCom markdown send error: ${data.errcode} ${data.errmsg}`);
  }
  return true;
}
