import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getTable, mutateTable } from "@/lib/auth/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession();

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const userId = url.searchParams.get("state");

  if (!code || !userId) {
    return NextResponse.json(
      { error: "Missing code or user ID" },
      { status: 400 }
    );
  }

  // The state must correspond to the currently signed-in user (CSRF defense).
  if (!session || String(session.userId) !== String(userId)) {
    return NextResponse.json(
      { error: "Session mismatch. Please connect your calendar again." },
      { status: 403 }
    );
  }

  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    process.env.GOOGLE_CLIENT_ID.includes("dummy")
  ) {
    return NextResponse.json(
      { error: "Google OAuth credentials are not configured." },
      { status: 503 }
    );
  }

  const oauthClient = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ||
      `${url.origin}/api/google/callback`
  );

  let tokens;
  try {
    const result = await oauthClient.getToken(code);
    tokens = result.tokens;
  } catch (err) {
    console.error("Google token exchange failed:", err);
    return NextResponse.json(
      { error: "Token exchange failed" },
      { status: 500 }
    );
  }

  if (tokens.refresh_token) {
    mutateTable("users", (users) =>
      users.map((u) =>
        String(u.id) === String(userId)
          ? { ...u, google_refresh_token: tokens.refresh_token }
          : u
      )
    );
  }

  return NextResponse.redirect(new URL("/home/calendar", req.url));
}
