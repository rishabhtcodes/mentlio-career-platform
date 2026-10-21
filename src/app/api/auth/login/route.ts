import { NextRequest, NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, setServerSessionCookie } from "@/lib/auth/session";
import { getTable } from "@/lib/auth/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, role } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Please enter both email and password." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Look in users table and mentors table
    const users = getTable("users");
    const mentors = getTable("mentors");

    let foundUser: Record<string, any> | undefined;
    let userRole: "user" | "mentor" = "user";

    if (role === "mentor") {
      foundUser = mentors.find(
        (m) => String(m.email || "").toLowerCase() === normalizedEmail
      );
      userRole = "mentor";
    } else {
      // First check users
      foundUser = users.find(
        (u) => String(u.userEmail || "").toLowerCase() === normalizedEmail
      );
      if (!foundUser) {
        // Fallback check mentors if not specified
        foundUser = mentors.find(
          (m) => String(m.email || "").toLowerCase() === normalizedEmail
        );
        if (foundUser) userRole = "mentor";
      }
    }

    if (!foundUser) {
      return NextResponse.json(
        { error: "Invalid login credentials. User not found." },
        { status: 401 }
      );
    }

    // Verify password if user has passwordHash
    if (foundUser.passwordHash) {
      const isValid = await verifyPassword(password, foundUser.passwordHash);
      if (!isValid) {
        return NextResponse.json(
          { error: "Invalid login credentials. Incorrect password." },
          { status: 401 }
        );
      }
    }

    // Establish session
    const userId = String(foundUser.id);
    const token = createSessionToken({
      userId,
      email: normalizedEmail,
      role: userRole,
    });

    await setServerSessionCookie(token);

    const { passwordHash: _, ...safeUser } = foundUser;

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
    console.error("Login error:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred during login." },
      { status: 500 }
    );
  }
}
