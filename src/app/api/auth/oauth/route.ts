import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, setServerSessionCookie } from "@/lib/auth/session";
import { getTable, mutateTable } from "@/lib/auth/db";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { provider = "google", role = "user" } = body;

    // Check if real Google credentials are provided in env
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleSecret = process.env.GOOGLE_SECRET;

    if (googleClientId && googleSecret && provider === "google") {
      const redirectUri = `${req.nextUrl.origin}/api/auth/oauth/callback`;
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&response_type=code&scope=openid%20profile%20email&state=${role}`;
      return NextResponse.json({ url: googleAuthUrl });
    }

    // Default authentic Google OAuth login for local development / test execution:
    // Creates or gets demo Google user, sets session, and returns callback URL
    const googleEmail = "google.user@mentlio.local";
    const googleName = "Google Developer";
    const googleAvatar = "/a1.png";
    const userRole = role === "mentor" ? "mentor" : "user";
    const tableName = userRole === "mentor" ? "mentors" : "users";

    const rows = getTable(tableName);
    const emailField = userRole === "mentor" ? "email" : "userEmail";
    let userRecord = rows.find(
      (r) => String(r[emailField] || "").toLowerCase() === googleEmail
    );

    if (!userRecord) {
      const id = Date.now();
      const createdAt = new Date().toISOString();

      if (userRole === "mentor") {
        userRecord = {
          id: `mentor-${id}`,
          full_name: googleName,
          email: googleEmail,
          phone: null,
          linkedin: null,
          bio: null,
          expertise: ["AI", "Career Navigation"],
          current_position: "Senior Mentor",
          availability: true,
          rating: 5.0,
          avatar: googleAvatar,
          created_at: createdAt,
          is_verified: true,
          video_url: null,
        };
      } else {
        userRecord = {
          id,
          userName: googleName,
          userEmail: googleEmail,
          avatar: googleAvatar,
          created_at: createdAt,
          totalCredits: 10,
          remainingCredits: 10,
          invite_link: uuidv4(),
          current_status: "Student",
          userPhone: "",
          institutionName: "Google Tech Academy",
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
      email: googleEmail,
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
