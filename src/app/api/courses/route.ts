/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getJson } from "serpapi";

interface Course {
  title: string;
  link?: string;
  source?: string;
  redirect_link?: string;
  displayed_link?: string;
  favicon?: string;
  snippet?: string;
  [key: string]: any;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "software developer";

  if (!process.env.SERPAPI_KEY || process.env.SERPAPI_KEY.includes("dummy")) {
    return NextResponse.json([
      {
        title: "Full-Stack Web Development Bootcamp",
        link: "https://example.com/course-1",
        source: "Coursera",
        snippet: "Master React, Next.js, Node.js, and cloud deployments with interactive projects.",
      },
      {
        title: "Modern TypeScript and Next.js Masterclass",
        link: "https://example.com/course-2",
        source: "edX",
        snippet: "A deep dive into production web applications, server components, and enterprise architecture.",
      },
    ]);
  }

  try {
    const response: any = await getJson({
      api_key: process.env.SERPAPI_KEY,
      q: query,
      hl: "en",
      gl: "us",
      device: "desktop",
      engine: "google",
    });

    // console.log("🔍 Raw SerpAPI response:", JSON.stringify(response, null, 2));

    const courses: Course[] = Array.isArray(response.organic_results)
      ? response.organic_results.map((course: any) => ({
          title: course.title || "Untitled",
          link: course.link,
          source: course.source,
          redirect_link: course.redirect_link,
          displayed_link: course.displayed_link,
          favicon: course.favicon,
          snippet: course.snippet,
        }))
      : [];

    // console.log("📦 Processed Courses (sending to frontend):", courses);

    return NextResponse.json(courses);
  } catch (error) {
    console.error("❌ Courses API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch courses" },
      { status: 500 }
    );
  }
}
