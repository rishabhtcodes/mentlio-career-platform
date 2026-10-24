import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, setServerSessionCookie } from "@/lib/auth/session";
import { getTable, mutateTable } from "@/lib/auth/db";
import { v4 as uuidv4 } from "uuid";

// public/ ships a single placeholder avatar. The previous `/user{n}.png`
// randomisation produced paths that 404 for every new account.
const DEFAULT_AVATAR = "/user.png";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, role = "user", fullName, avatar } = body;

    // 1. Validation
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }
    if (password.length > 128) {
      return NextResponse.json(
        { error: "Password must be at most 128 characters long." },
        { status: 400 }
      );
    }
    if (fullName !== undefined && (typeof fullName !== "string" || fullName.length > 120)) {
      return NextResponse.json(
        { error: "Full name must be a string of at most 120 characters." },
        { status: 400 }
      );
    }
    if (avatar !== undefined && typeof avatar !== "string") {
      return NextResponse.json({ error: "Invalid avatar value." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const userRole = role === "mentor" ? "mentor" : "user";
    const tableName = userRole === "mentor" ? "mentors" : "users";

    // 2. Uniqueness check
    const existingRows = getTable(tableName);
    const emailField = userRole === "mentor" ? "email" : "userEmail";
    const exists = existingRows.find(
      (r) => String(r[emailField] || "").toLowerCase() === normalizedEmail
    );

    if (exists) {
      return NextResponse.json(
        { error: "An account with this email address already exists. Please sign in." },
        { status: 409 }
      );
    }

    // 3. Password hashing
    const passwordHash = await hashPassword(password);
    const id = Date.now();
    const createdAt = new Date().toISOString();

    let createdRecord: Record<string, any>;

    if (userRole === "mentor") {
      createdRecord = {
        id: `mentor-${id}`,
        full_name: fullName || normalizedEmail.split("@")[0],
        email: normalizedEmail,
        passwordHash,
        phone: null,
        linkedin: null,
        bio: null,
        expertise: [],
        current_position: "",
        availability: true,
        rating: 0,
        avatar: avatar || DEFAULT_AVATAR,
        created_at: createdAt,
        is_verified: false,
        video_url: null,
      };
    } else {
      createdRecord = {
        id,
        userName: fullName || normalizedEmail.split("@")[0],
        userEmail: normalizedEmail,
        passwordHash,
        avatar: avatar || DEFAULT_AVATAR,
        created_at: createdAt,
        totalCredits: 10,
        remainingCredits: 10,
        invite_link: uuidv4(),
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
    }

    // 4. Save to database
    mutateTable(tableName, (rows) => [...rows, createdRecord]);

    // 5. Establish session
    const userId = String(createdRecord.id);
    const token = createSessionToken({
      userId,
      email: normalizedEmail,
      role: userRole,
    });

    await setServerSessionCookie(token);

    // Sanitize record to not expose passwordHash
    const { passwordHash: _, ...safeUser } = createdRecord;

    return NextResponse.json({
      user: {
        id: userId,
        email: normalizedEmail,
        role: userRole,
        user_metadata: {
          full_name: safeUser.userName || safeUser.full_name,
          role: userRole,
          avatar_url: safeUser.avatar,
        },
        profile: safeUser,
      },
      session: {
        access_token: token,
        token_type: "bearer",
        expires_in: 72 * 3600,
        user: safeUser,
      },
    });
  } catch (err: any) {
    console.error("Signup error:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred during registration." },
      { status: 500 }
    );
  }
}
