import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, setServerSessionCookie } from "@/lib/auth/session";
import { getTable, mutateTable } from "@/lib/auth/db";
import crypto from "crypto";

export const OAUTH_STATE_COOKIE = "mentlio_oauth_state";

export function createOAuthState(role: string): string {
  const nonce = crypto.randomBytes(16).toString("base64url");
  return `${nonce}.${role === "mentor" ? "mentor" : "user"}`;
}

export const oauthStateCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 10 * 60,
};

interface OAuthProfile {
  email: string;
  name: string;
  avatar: string | null;
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OAuth HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function exchangeCode(
  provider: "google" | "discord" | "slack",
  code: string,
  redirectUri: string
): Promise<OAuthProfile> {
  if (provider === "google") {
    const token = await fetchJson("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    const info = await fetchJson("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    return { email: info.email, name: info.name || info.email, avatar: info.picture || null };
  }

  if (provider === "discord") {
    const token = await fetchJson("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_SECRET || process.env.DISCORD_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    const info = await fetchJson("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const email = info.email;
    if (!email) throw new Error("Discord account has no verified email.");
    const avatar = info.avatar
      ? `https://cdn.discordapp.com/avatars/${info.id}/${info.avatar}.png`
      : null;
    return { email, name: info.global_name || info.username || email, avatar };
  }

  // slack
  const token = await fetchJson("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!token.ok) throw new Error(`Slack OAuth error: ${token.error}`);
  const info = token.authed_user;
  const userInfo = await fetchJson("https://slack.com/api/openid.connect.userInfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const email = userInfo.email || info?.email;
  if (!email) throw new Error("Slack account has no email.");
  return { email, name: userInfo.name || email, avatar: userInfo.picture || null };
}

function providerConfig(provider: string) {
  if (provider === "google") {
    const id = process.env.GOOGLE_CLIENT_ID;
    const secret = process.env.GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET;
    return id && secret && !id.includes("dummy") && !secret.includes("dummy");
  }
  if (provider === "discord") {
    const id = process.env.DISCORD_CLIENT_ID;
    const secret = process.env.DISCORD_SECRET || process.env.DISCORD_CLIENT_SECRET;
    return id && secret && !id.includes("dummy") && !secret.includes("dummy");
  }
  if (provider === "slack") {
    const id = process.env.SLACK_CLIENT_ID;
    const secret = process.env.SLACK_CLIENT_SECRET;
    return id && secret && !id.includes("dummy") && !secret.includes("dummy");
  }
  return false;
}

export async function handleOAuthCallback(req: NextRequest, provider: "google" | "discord" | "slack") {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const fail = (message: string) =>
    NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent(message)}`, url.origin));

  if (errorParam) return fail(`OAuth provider error: ${errorParam}`);
  if (!code || !state) return fail("Missing OAuth code or state.");

  // Verify CSRF state against the httpOnly cookie set when the flow was initiated.
  const stateCookie = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!stateCookie || stateCookie !== state) {
    return fail("OAuth state mismatch. Please try signing in again.");
  }
  const role = state.endsWith(".mentor") ? "mentor" : "user";

  if (!providerConfig(provider)) {
    return fail(`${provider} OAuth is not configured on this server.`);
  }

  try {
    const redirectUri = `${url.origin}/api/auth/oauth/${provider}/callback`;
    const profile = await exchangeCode(provider, code, redirectUri);
    const normalizedEmail = profile.email.trim().toLowerCase();

    const tableName = role === "mentor" ? "mentors" : "users";
    const emailField = role === "mentor" ? "email" : "userEmail";
    const rows = getTable(tableName);
    let account = rows.find((r) => String(r[emailField] || "").toLowerCase() === normalizedEmail);

    if (!account) {
      const id = Date.now();
      account =
        role === "mentor"
          ? {
              id: `mentor-${id}`,
              full_name: profile.name,
              email: normalizedEmail,
              passwordHash: null,
              phone: null,
              linkedin: null,
              bio: null,
              expertise: [],
              current_position: "",
              availability: true,
              rating: 0,
              avatar: profile.avatar || `/user${Math.ceil(Math.random() * 5)}.png`,
              created_at: new Date().toISOString(),
              is_verified: false,
              video_url: null,
            }
          : {
              id,
              userName: profile.name,
              userEmail: normalizedEmail,
              passwordHash: null,
              avatar: profile.avatar || `/user${Math.ceil(Math.random() * 5)}.png`,
              created_at: new Date().toISOString(),
              totalCredits: 10,
              remainingCredits: 10,
              invite_link: crypto.randomUUID(),
              current_status: "",
              userPhone: "",
              institutionName: "",
              mainFocus: "",
              is_verified: false,
              isQuizDone: false,
              latitude: 0,
              longitude: 0,
              isPro: false,
              google_refresh_token: "",
            };
      mutateTable(tableName, (current) => [...current, account!]);
    }

    const token = createSessionToken({ userId: String(account.id), email: normalizedEmail, role });
    await setServerSessionCookie(token);

    const res = NextResponse.redirect(new URL("/auth/callback", url.origin));
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  } catch (err: any) {
    console.error(`${provider} OAuth callback error:`, err);
    return fail("OAuth sign-in failed. Please try again.");
  }
}
