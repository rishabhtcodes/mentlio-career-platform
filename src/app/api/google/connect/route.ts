import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.redirect(new URL("/auth", req.url));
  }

  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");

  if (!userId || userId !== String(session.userId)) {
    return NextResponse.json(
      { error: "user_id must match the signed-in user." },
      { status: 403 }
    );
  }

  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    process.env.GOOGLE_CLIENT_ID.includes("dummy")
  ) {
    return NextResponse.json(
      { error: "Google Calendar integration is not configured on this server." },
      { status: 503 }
    );
  }

  const googleParams = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri:
      process.env.GOOGLE_REDIRECT_URI ||
      `${url.origin}/api/google/callback`,
    response_type: "code",
    access_type: "offline",
    prompt: "consent select_account",
    scope: "https://www.googleapis.com/auth/calendar",
    state: userId,
  });

  return NextResponse.redirect(
    "https://accounts.google.com/o/oauth2/v2/auth?" + googleParams.toString()
  );
}
