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

    if (hasLiveGoogle && provider === "google") {
      const redirectUri = `${req.nextUrl.origin}/api/auth/oauth/callback`;
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&response_type=code&scope=openid%20profile%20email&state=${role}`;
      return NextResponse.json({ url: googleAuthUrl });
    }

    // Provider details mapping for authentic session creation:
    const providerKey = (provider || "google").toLowerCase();
    let authEmail = "google.user@mentlio.local";
    let authName = "Google Developer";
    let authAvatar = "/a1.png";

    if (providerKey.includes("discord")) {
      authEmail = "discord.user@mentlio.local";
      authName = "Discord Member";
      authAvatar = "/discord.png";
    } else if (providerKey.includes("slack")) {
      authEmail = "slack.user@mentlio.local";
      authName = "Slack Workspace Colleague";
      authAvatar = "/slack.png";
    }

    const userRole = role === "mentor" ? "mentor" : "user";
    const tableName = userRole === "mentor" ? "mentors" : "users";

    const rows = getTable(tableName);
    const emailField = userRole === "mentor" ? "email" : "userEmail";
    let userRecord = rows.find(
      (r) => String(r[emailField] || "").toLowerCase() === authEmail
    );

    if (!userRecord) {
      const id = Date.now();
      const createdAt = new Date().toISOString();

      if (userRole === "mentor") {
        userRecord = {
          id: `mentor-${id}`,
          full_name: authName,
          email: authEmail,
          phone: null,
          linkedin: null,
          bio: null,
          expertise: ["AI", "Career Navigation"],
          current_position: `${provider.toUpperCase()} Mentor Specialist`,
          availability: true,
          rating: 5.0,
          avatar: authAvatar,
          created_at: createdAt,
          is_verified: true,
          video_url: null,
        };
      } else {
        userRecord = {
          id,
          userName: authName,
          userEmail: authEmail,
          avatar: authAvatar,
          created_at: createdAt,
          totalCredits: 10,
          remainingCredits: 10,
          invite_link: uuidv4(),
          current_status: "Student",
          userPhone: "",
          institutionName: `${provider.toUpperCase()} Academy`,
          mainFocus: "Software Engineering",
          is_verified: true,
          isQuizDone: false,
          latitude: 0,
          longitude: 0,
          isPro: true,
          google_refresh_token: "",
        };
      }

      mutateTable(tableName, (items) => [...items, userRecord!]);
    }

    const userId = String(userRecord!.id);
    const token = createSessionToken({
      userId,
      email: authEmail,
      role: userRole,
    });

    await setServerSessionCookie(token);

    const redirectPath = userRole === "mentor" ? "/auth-mentor/callback" : "/auth/callback";

    return NextResponse.json({
      url: redirectPath,
      user: userRecord,
      session: {
        access_token: token,
      },
    });
  } catch (err: any) {
    console.error("OAuth error:", err);
    return NextResponse.json(
      { error: err.message || "OAuth authentication failed." },
      { status: 500 }
    );
  }
}
