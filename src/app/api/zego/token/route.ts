import { NextRequest, NextResponse } from "next/server";
import { buildKitToken } from "@/lib/zego/token04";
import { getServerSession } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const appIDRaw = process.env.ZEGO_APP_ID || process.env.NEXT_PUBLIC_ZEGO_APP_ID;
    const serverSecret = process.env.ZEGO_SERVER_SECRET;

    const appID = parseInt(appIDRaw || "", 10);
    if (!appID || Number.isNaN(appID)) {
      return NextResponse.json(
        { error: "Video calling is not configured on this server.", code: "ZEGO_APP_ID_MISSING" },
        { status: 503 }
      );
    }
    if (!serverSecret || serverSecret.includes("dummy")) {
      return NextResponse.json(
        {
          error:
            "Video calling is not configured on this server. Set the server-only ZEGO_SERVER_SECRET environment variable.",
          code: "ZEGO_SECRET_MISSING",
        },
        { status: 503 }
      );
    }

    const { roomID, userName } = await req.json().catch(() => ({ roomID: "", userName: "" }));
    if (!roomID || typeof roomID !== "string") {
      return NextResponse.json({ error: "Missing room ID." }, { status: 400 });
    }

    const kitToken = buildKitToken({
      appID,
      serverSecret,
      roomID: roomID.slice(0, 120),
      userID: session.userId,
      userName: String(userName || session.email).slice(0, 60),
      expireSeconds: 7200,
    });

    return NextResponse.json({ kitToken });
  } catch (error: any) {
    console.error("Zego token error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create call token", code: "ZEGO_TOKEN_FAILED" },
      { status: 503 }
    );
  }
}
