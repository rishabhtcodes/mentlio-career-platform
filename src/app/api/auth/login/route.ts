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

    // One message for every failure path: distinguishing "user not found" from
    // "incorrect password" let anyone enumerate which emails have accounts.
    const invalidCredentials = () =>
      NextResponse.json({ error: "Invalid email or password." }, { status: 401 });

    // Burn the same scrypt work when the account does not exist, so response
    // timing does not reveal whether an email is registered.
    if (!foundUser) {
      await verifyPassword(password, `${"0".repeat(32)}:${"0".repeat(128)}`);
      return invalidCredentials();
    }

    // Accounts without a password hash (e.g. directory-seeded mentors) can never
    // be logged in — there is no credential to verify against. This closes the
    // "any password logs in" hole for password-less rows.
    if (!foundUser.passwordHash || typeof foundUser.passwordHash !== "string") {
      return invalidCredentials();
    }

    const isValid = await verifyPassword(password, foundUser.passwordHash);
    if (!isValid) {
      return invalidCredentials();
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
      { error: "An unexpected error occurred during login." },
      { status: 500 }
    );
  }
}
