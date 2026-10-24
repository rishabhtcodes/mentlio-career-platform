import { NextRequest } from "next/server";
import { handleOAuthCallback } from "@/lib/auth/oauth-callback";

export async function GET(req: NextRequest) {
  return handleOAuthCallback(req, "discord");
}
