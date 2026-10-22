import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { retrivalServer } from "@/lib/functions/pineconeQuery";
import { tavily } from "@tavily/core";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.includes("dummy") || apiKey.startsWith("AIzaSyBw-xO7zJgJzKkSj4jE6s8r6nC2tZ8w8")) {
      return NextResponse.json(
        {
          error:
            "Gemini API key is not configured or the current key has been revoked/is invalid. Please configure a valid GEMINI_API_KEY in environment variables.",
          code: "GEMINI_KEY_INVALID",
        },
        { status: 503 }
      );
    }

    const body = await req.json();
    const {
      question,
      userName = "Student",
      user_current_status = "learner",
      stream = "Engineering",
      careerOptions = "",
      summary = "",
    } = body;

    if (!question) {
      return NextResponse.json(
        { error: "A message/question is required." },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Optional Pinecone context
    let contextDocs = "";
    if (process.env.PINECONE_API_KEY && !process.env.PINECONE_API_KEY.includes("dummy")) {
      try {
        contextDocs = await retrivalServer(question);
      } catch (err) {
        console.warn("Pinecone retrieval skipped/failed:", err);
      }
    }

    // Optional Tavily grounding
    let webGrounding = "";
    const tavilyKey = process.env.TAVILY_API_KEY || process.env.NEXT_PUBLIC_TAVILY_API_KEY;
    if (tavilyKey && !tavilyKey.includes("dummy")) {
      try {
        const tvly = tavily({ apiKey: tavilyKey });
        const res = await tvly.search(question, { search_depth: "basic", max_results: 3 });
        webGrounding = (res.results || [])
          .map((r: any, i: number) => `#${i + 1} ${r.title}\n${r.content?.slice(0, 200)}`)
          .join("\n\n");
      } catch (err) {
        console.warn("Tavily search skipped/failed:", err);
      }
    }

    const systemPrompt = `You are a highly professional, encouraging, and empathetic AI Career Coach named Mentlio Coach.
You are counseling ${userName}, currently a ${user_current_status} in ${stream}.
Suggested options: ${careerOptions}
Summary: ${summary}
${contextDocs ? `\nDomain Knowledge Context:\n${contextDocs}` : ""}
${webGrounding ? `\nReal-time Web Search Grounding:\n${webGrounding}` : ""}

Provide concise, actionable, and structured guidance. Use bullet points and clear steps.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: question }],
        },
      ],
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 600,
      },
    });

    const reply = response.text || "I am here to guide your career path. Could you please specify your career goals or key interests?";

    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error("Career Coach API error:", err);
    if (err.status === 400 || err.message?.includes("API key not valid")) {
      return NextResponse.json(
        {
          error:
            "Gemini API key is invalid or unauthorized. Please verify the API key in Google AI Studio and configure GEMINI_API_KEY.",
          code: "GEMINI_KEY_INVALID",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: err.message || "Career coach encountered an unexpected issue." },
      { status: 500 }
    );
  }
}
