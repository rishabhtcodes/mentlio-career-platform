import { NextResponse } from "next/server";
import { clearServerSessionCookie } from "@/lib/auth/session";

export async function POST() {
  try {
    await clearServerSessionCookie();
    return NextResponse.json({ success: true, message: "Logged out successfully" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to logout" }, { status: 500 });
  }
}
