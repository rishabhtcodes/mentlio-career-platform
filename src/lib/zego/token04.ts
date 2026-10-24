import { randomBytes, createCipheriv } from "crypto";

// Zego's server secret must never reach the browser bundle, so the prebuilt
// token is assembled on the server and only the opaque token is sent to the
// client. The SDK's own `generateKitTokenForTest` cannot run server-side: it
// touches `window`/`document` while the module is still loading. This produces
// the same Token04 layout (AES-CBC payload + big-endian header + base64
// metadata) using Node crypto.
export function buildKitToken(options: {
  appID: number;
  serverSecret: string;
  roomID: string;
  userID: string;
  userName: string;
  expireSeconds: number;
}): string {
  const { appID, serverSecret, roomID, userID, userName, expireSeconds } = options;
  const key = Buffer.from(serverSecret, "utf8");
  if (![16, 24, 32].includes(key.length)) {
    throw new Error("ZEGO_SERVER_SECRET must be 16, 24 or 32 characters long.");
  }

  const now = Math.floor(Date.now() / 1000);
  const expire = now + expireSeconds;
  const payload = JSON.stringify({
    app_id: appID,
    user_id: userID,
    nonce: Math.floor(2147483647 * Math.random()) | 0,
    ctime: now,
    expire,
  });

  // The IV is a 16-character ASCII string that is also written into the header,
  // which is how Zego's servers locate it.
  const ivText = randomBytes(8).toString("hex").slice(0, 16);
  const cipher = createCipheriv(`aes-${key.length * 8}-cbc`, key, Buffer.from(ivText, "utf8"));
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);

  const body = Buffer.alloc(28 + encrypted.length);
  body.writeUInt32BE(expire >>> 0, 4);
  body.writeUInt16BE(ivText.length, 8);
  body.write(ivText, 10, "utf8");
  body.writeUInt16BE(encrypted.length, 26);
  encrypted.copy(body, 28);

  const meta = Buffer.from(
    JSON.stringify({ userID, roomID, userName: encodeURIComponent(userName), appID }),
    "utf8"
  ).toString("base64");

  return `04${body.toString("base64")}#${meta}`;
}
