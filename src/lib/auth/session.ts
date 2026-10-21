import crypto from "crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "mentlio_session";
const SESSION_SECRET = process.env.SESSION_SECRET || "mentlio-super-secure-local-session-secret-key-32chars";

export interface SessionPayload {
  userId: string;
  email: string;
  role: "user" | "mentor";
  expiresAt: number;
}

/**
 * Creates an HMAC-SHA256 signature for data.
 */
function signData(data: string): string {
  return crypto.createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
}

/**
 * Signs and serializes a session payload into a token.
 */
export function createSessionToken(payload: Omit<SessionPayload, "expiresAt">, durationHours = 72): string {
  const expiresAt = Date.now() + durationHours * 60 * 60 * 1000;
  const fullPayload: SessionPayload = { ...payload, expiresAt };
  const jsonStr = JSON.stringify(fullPayload);
  const encoded = Buffer.from(jsonStr).toString("base64url");
  const signature = signData(encoded);
  return `${encoded}.${signature}`;
}

/**
 * Verifies and decodes a session token.
 */
export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [encoded, signature] = token.split(".");
    if (!encoded || !signature) return null;

    const expectedSignature = signData(encoded);
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const jsonStr = Buffer.from(encoded, "base64url").toString("utf8");
    const payload: SessionPayload = JSON.parse(jsonStr);

    if (Date.now() > payload.expiresAt) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Server-side helper to read the current session from cookies.
 */
export async function getServerSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Server-side helper to set the session cookie.
 */
export async function setServerSessionCookie(token: string, maxAgeHours = 72) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeHours * 60 * 60,
  });
}

/**
 * Server-side helper to clear the session cookie.
 */
export async function clearServerSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export { SESSION_COOKIE_NAME };
