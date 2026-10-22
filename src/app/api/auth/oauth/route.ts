import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, setServerSessionCookie } from "@/lib/auth/session";
import { getTable, mutateTable } from "@/lib/auth/db";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { provider = "google", role = "user" } = body;

    // Check if real Google credentials are provided in env (and not dummy)
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleSecret = process.env.GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET;
    const hasLiveGoogle =
      googleClientId &&
      googleSecret &&
      !googleClientId.includes("dummy") &&
      !googleSecret.includes("dummy");

    if (provider === "google") {
      if (hasLiveGoogle) {
        const redirectUri = `${req.nextUrl.origin}/api/auth/oauth/callback`;
        const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${encodeURIComponent(
          redirectUri
        )}&response_type=code&scope=openid%20profile%20email&state=${role}`;
        return NextResponse.json({ url: googleAuthUrl });
      }

      return NextResponse.json(
        {
          error:
            "Google OAuth is not configured on this environment. Missing GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
          code: "OAUTH_PROVIDER_UNCONFIGURED",
          provider: "google",
        },
        { status: 501 }
      );
    }

    if (provider === "discord") {
      const discordClientId = process.env.DISCORD_CLIENT_ID;
      const discordSecret = process.env.DISCORD_SECRET || process.env.DISCORD_CLIENT_SECRET;
      const hasLiveDiscord =
        discordClientId &&
        discordSecret &&
        !discordClientId.includes("dummy") &&
        !discordSecret.includes("dummy");

      if (hasLiveDiscord) {
        const redirectUri = `${req.nextUrl.origin}/api/auth/oauth/discord/callback`;
        const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${discordClientId}&redirect_uri=${encodeURIComponent(
          redirectUri
        )}&response_type=code&scope=identify%20email&state=${role}`;
        return NextResponse.json({ url: discordAuthUrl });
      }

      return NextResponse.json(
        {
          error:
            "Discord OAuth is not configured on this environment. Missing DISCORD_CLIENT_ID and DISCORD_SECRET.",
          code: "OAUTH_PROVIDER_UNCONFIGURED",
          provider: "discord",
        },
        { status: 501 }
      );
    }

    if (provider === "slack_oidc" || provider === "slack") {
      const slackClientId = process.env.SLACK_CLIENT_ID;
      const slackSecret = process.env.SLACK_CLIENT_SECRET;
      const hasLiveSlack =
        slackClientId &&
        slackSecret &&
        !slackClientId.includes("dummy") &&
        !slackSecret.includes("dummy");

      if (hasLiveSlack) {
        const redirectUri = `${req.nextUrl.origin}/api/auth/oauth/slack/callback`;
        const slackAuthUrl = `https://slack.com/openid/connect/authorize?client_id=${slackClientId}&redirect_uri=${encodeURIComponent(
          redirectUri
        )}&response_type=code&scope=openid%20profile%20email&state=${role}`;
        return NextResponse.json({ url: slackAuthUrl });
      }

      return NextResponse.json(
        {
          error:
            "Slack OAuth is not configured on this environment. Missing SLACK_CLIENT_ID and SLACK_CLIENT_SECRET.",
          code: "OAUTH_PROVIDER_UNCONFIGURED",
          provider: "slack",
        },
        { status: 501 }
      );
    }

    return NextResponse.json(
      {
        error: `Unsupported authentication provider: ${provider}`,
        code: "INVALID_PROVIDER",
      },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("OAuth error:", err);
    return NextResponse.json(
      { error: err.message || "OAuth authentication failed." },
      { status: 500 }
    );
  }
}
