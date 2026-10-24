import { NextRequest, NextResponse } from "next/server";
import { getUploadAuthParams } from "@imagekit/next/server";
import { getServerSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  try {
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
    if (!privateKey || !publicKey) {
      return NextResponse.json({ error: "ImageKit not configured" }, { status: 503 });
    }
    // Signing upload params with the placeholder keys from .env.example only
    // produces a 403 from ImageKit later; say so up front instead.
    if (privateKey.includes("dummy") || publicKey.includes("dummy")) {
      return NextResponse.json(
        {
          error:
            "Media uploads are not configured on this server. Set real IMAGEKIT_PRIVATE_KEY and NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY values.",
          code: "IMAGEKIT_NOT_CONFIGURED",
        },
        { status: 503 }
      );
    }
    const { token, expire, signature } = getUploadAuthParams({
      privateKey, // Your private key from .env.local
      publicKey, // For completeness
    });

    return NextResponse.json({ token, expire, signature });
  } catch (error) {
    return NextResponse.json({ error: "Auth generation failed" }, { status: 500 });
  }
}