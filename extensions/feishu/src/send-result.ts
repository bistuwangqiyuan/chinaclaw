export type FeishuMessageApiResponse = {
  code?: number;
  msg?: string;
  data?: {
    message_id?: string;
  };
};

const FEISHU_AUTH_ERROR_CODE = 99991401;

function feishuAuthHint(code?: number, msg?: string): string {
  if (code === FEISHU_AUTH_ERROR_CODE || /invalid|auth|api key|401/i.test(msg ?? "")) {
    return " Use open.feishu.cn (China) or open.larksuite.com + domain: 'lark' (international); verify App ID and App Secret.";
  }
  return "";
}

export function assertFeishuMessageApiSuccess(
  response: FeishuMessageApiResponse,
  errorPrefix: string,
) {
  if (response.code !== 0) {
    const hint = feishuAuthHint(response.code, response.msg);
    throw new Error(
      `${errorPrefix}: ${response.msg || `code ${response.code}`}${hint}`,
    );
  }
}

export function toFeishuSendResult(
  response: FeishuMessageApiResponse,
  chatId: string,
): {
  messageId: string;
  chatId: string;
} {
  return {
    messageId: response.data?.message_id ?? "unknown",
    chatId,
  };
}
