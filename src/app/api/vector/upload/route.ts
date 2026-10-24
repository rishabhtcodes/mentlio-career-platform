import { NextResponse } from "next/server";
import { Storage } from "@google-cloud/storage";
import { getServerSession } from "@/lib/auth/session";
import { getTable } from "@/lib/auth/db";
import { embedText } from "@/lib/functions/embedding";

export const dynamic = "force-dynamic";

// Generates mentor embeddings and uploads them as JSONL to Google Cloud Storage.
// Side-effecting operation: POST + authenticated + admin (mentor) role only.
export async function POST() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (session.role !== "mentor") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  if (!process.env.GCP_SERVICE_ACCOUNT_KEY || !process.env.GCS_BUCKET) {
    return NextResponse.json(
      { error: "GCP credentials or GCS_BUCKET not configured" },
      { status: 503 }
    );
  }

  try {
    const storage = new Storage({
      projectId: process.env.GCP_PROJECT_ID,
      credentials: JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY),
    });

    const BUCKET = process.env.GCS_BUCKET;
    const mentors = getTable("mentors");

    let ndjson = "";

    for (const m of mentors) {
      const text = `
      Mentor Name: ${m.full_name}
      Current Position: ${m.current_position}
      Bio: ${m.bio ?? ""}
    `;

      const vector = await embedText(text);

      ndjson +=
        JSON.stringify({
          id: String(m.id),
          embedding: vector,
          payload: {
            full_name: m.full_name,
            current_position: m.current_position,
            bio: m.bio ?? "",
          },
        }) + "\n";
    }

    const filename = `mentors-${Date.now()}.jsonl`;
    const bucket = storage.bucket(BUCKET);
    const file = bucket.file(`vector/${filename}`);

    await file.save(ndjson, {
      resumable: false,
      contentType: "application/jsonl",
    });

    return NextResponse.json({
      message: "Uploaded!",
      gcsUri: `gs://${BUCKET}/vector/${filename}`,
    });
  } catch (err: any) {
    console.error("Vector upload error:", err);
    return NextResponse.json(
      { error: "Failed to upload mentor vectors." },
      { status: 500 }
    );
  }
}
