import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getTable } from "@/lib/auth/db";

export async function GET() {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json({ user: null, session: null });
    }

    const tableName = session.role === "mentor" ? "mentors" : "users";
    const rows = getTable(tableName);

    let profile = rows.find((r) => String(r.id) === String(session.userId));
    if (!profile) {
      const emailField = session.role === "mentor" ? "email" : "userEmail";
      profile = rows.find((r) => String(r[emailField] || "").toLowerCase() === session.email.toLowerCase());
    }

    if (!profile) {
      return NextResponse.json({ user: null, session: null });
    }

    const { passwordHash: _, ...safeProfile } = profile;

    const userObj = {
      id: String(safeProfile.id),
      email: session.email,
      role: session.role,
      user_metadata: {
        full_name: safeProfile.userName || safeProfile.full_name,
        role: session.role,
        avatar_url: safeProfile.avatar,
      },
      ...safeProfile,
    };

    return NextResponse.json({
      user: userObj,
      session: {
        access_token: "active-session",
        user: userObj,
        expires_at: session.expiresAt,
      },
    });
  } catch (err: any) {
    console.error("Session retrieval error:", err);
    return NextResponse.json({ user: null, session: null });
  }
}
