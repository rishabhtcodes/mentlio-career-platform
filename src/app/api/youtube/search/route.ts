import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";

const YT_BASE = "https://www.googleapis.com/youtube/v3";

// The YouTube Data API key is quota-bound and must never reach a browser bundle.
// Clients used to read NEXT_PUBLIC_YOUTUBE_API_KEY and call Google directly; this
// proxy keeps the server-side key in one place.
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const apiKey = process.env.YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
    if (!apiKey || apiKey.includes("dummy")) {
      return NextResponse.json(
        { error: "YouTube search is not configured.", code: "YOUTUBE_UNCONFIGURED" },
        { status: 503 }
      );
    }

    const url = new URL(req.url);
    const q = url.searchParams.get("q");
    if (!q || typeof q !== "string" || q.length > 200) {
      return NextResponse.json({ error: "Invalid or missing query." }, { status: 400 });
    }

    const maxResults = Math.min(Math.max(parseInt(url.searchParams.get("maxResults") ?? "10", 10) || 10, 1), 50);
    const withDetails = url.searchParams.get("details") === "true";
    const videoDuration = url.searchParams.get("videoDuration");

    const searchParams = new URLSearchParams({
      part: withDetails ? "id" : "snippet",
      q,
      type: "video",
      maxResults: String(maxResults),
      key: apiKey,
    });
    if (url.searchParams.get("order") === "viewCount") searchParams.set("order", "viewCount");
    if (videoDuration) searchParams.set("videoDuration", videoDuration);

    const searchRes = await fetch(`${YT_BASE}/search?${searchParams.toString()}`);
    const searchData = await searchRes.json().catch(() => ({}));
    if (!searchRes.ok) {
      return NextResponse.json(
        { error: searchData?.error?.message || "YouTube search failed.", code: "YOUTUBE_ERROR" },
        { status: 502 }
      );
    }

    const items = searchData.items || [];
    if (!withDetails) return NextResponse.json({ items });

    const videoIds = items.map((v: any) => v.id?.videoId).filter(Boolean).join(",");
    if (!videoIds) return NextResponse.json({ items: [] });

    const detailsRes = await fetch(
      `${YT_BASE}/videos?${new URLSearchParams({
        part: "snippet,contentDetails,statistics",
        id: videoIds,
        key: apiKey,
      }).toString()}`
    );
    const detailsData = await detailsRes.json().catch(() => ({}));
    if (!detailsRes.ok) {
      return NextResponse.json(
        { error: detailsData?.error?.message || "YouTube video lookup failed.", code: "YOUTUBE_ERROR" },
        { status: 502 }
      );
    }

    return NextResponse.json({ items: detailsData.items || [] });
  } catch (err: any) {
    console.error("YouTube proxy error:", err);
    return NextResponse.json({ error: "Failed to search YouTube." }, { status: 500 });
  }
}
