/**
 * WeCom message encryption/decryption utilities.
 *
 * WeCom uses AES-256-CBC with a custom padding (PKCS#7 variant) and
 * base64-encoded EncodingAESKey for callback message encryption.
 */

import { createDecipheriv, createHash } from "node:crypto";

/**
 * Decode the EncodingAESKey to get the actual AES key and IV.
 * EncodingAESKey is base64-encoded, 43 chars, decoded to 32 bytes (key) + the first 16 bytes as IV.
 */
export function decodeAESKey(encodingAESKey: string): { key: Buffer; iv: Buffer } {
  const buf = Buffer.from(encodingAESKey + "=", "base64");
  return {
    key: buf,
    iv: buf.subarray(0, 16),
  };
}

/**
 * Decrypt a WeCom encrypted message.
 * Returns the plaintext XML string.
 */
export function decryptMessage(encodingAESKey: string, encryptedMsg: string): string {
  const { key, iv } = decodeAESKey(encodingAESKey);
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  decipher.setAutoPadding(false);

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedMsg, "base64")),
    decipher.final(),
  ]);

  // Remove PKCS#7 padding
  const padLen = decrypted[decrypted.length - 1]!;
  const content = decrypted.subarray(0, decrypted.length - padLen);

  // Format: random(16) + msgLength(4, network byte order) + msg + corpId
  const msgLength = content.readUInt32BE(16);
  const msgBuf = content.subarray(20, 20 + msgLength);
  return msgBuf.toString("utf8");
}

/**
 * Verify the callback URL signature.
 */
export function verifySignature(
  token: string,
  timestamp: string,
  nonce: string,
  encrypt: string,
): string {
  const parts = [token, timestamp, nonce, encrypt].sort();
  return createHash("sha1").update(parts.join("")).digest("hex");
}
