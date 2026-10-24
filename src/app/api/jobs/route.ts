/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getJson } from "serpapi";

interface Job {
  title: string;
  company_name: string;
  location: string;
  via: string;
  description: string;
  apply_options: { title: string; link: string }[];
}

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session || !session.userId) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("q") || "software developer").slice(0, 120);

  if (!process.env.SERPAPI_KEY || process.env.SERPAPI_KEY.includes("dummy")) {
    return NextResponse.json(
      { error: "Job search is not configured on this server.", code: "SEARCH_PROVIDER_UNCONFIGURED" },
      { status: 503 }
    );
  }

  try {
    const response = await getJson({
      api_key: process.env.SERPAPI_KEY,
      engine: "google_jobs",
      google_domain: "google.co.in",
      q: query,
      hl: "en",
      gl: "in",
      location: "India",
    });

    //  console.log("SerpAPI Jobs Response:", response);

    const jobs: Job[] = Array.isArray(response.jobs_results)
      ? response.jobs_results.map((job: any) => ({
          title: job.title,
          company_name: job.company_name,
          location: job.location,
          via: job.via,
          description: job.description,
          apply_options: job.apply_options,
        }))
      : [];

     

    return NextResponse.json(jobs);
  } catch (error) {
    console.error(error);
    return NextResponse.json([], { status: 500 });
  }
}
