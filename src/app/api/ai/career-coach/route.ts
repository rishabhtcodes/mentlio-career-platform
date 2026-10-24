import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { retrivalServer } from "@/lib/functions/pineconeQuery";
import { tavily } from "@tavily/core";
import { getServerSession } from "@/lib/auth/session";
import { groqComplete, groqModel } from "@/lib/ai/groq";

// Must be a model this account can actually reach — `llama-3.3-70b-versatile`
// returns 404 model_not_found here.
const GROQ_FALLBACK_MODEL = "openai/gpt-oss-120b";

async function askGroq(systemPrompt: string, question: string): Promise<string> {
  if (!process.env.GROQ_API_KEY) return "";
  try {
    return await groqComplete({
      prompt: question,
      system: systemPrompt,
      model: groqModel(GROQ_FALLBACK_MODEL),
      temperature: 0.6,
      maxTokens: 1200,
    });
  } catch (err) {
    console.warn("Groq fallback failed:", (err as Error).message);
    return "";
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const geminiUsable = !!apiKey && !apiKey.includes("dummy") && apiKey.length >= 20;

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

    if (geminiUsable) {
      try {
        const ai = new GoogleGenAI({ apiKey: apiKey! });
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

        if (response.text) {
          return NextResponse.json({ reply: response.text, provider: "gemini" });
        }
        console.warn("Gemini returned an empty response; trying Groq fallback");
      } catch (geminiErr: any) {
        console.warn("Gemini career coach failed, falling back to Groq:", geminiErr?.message);
      }
    }

    try {
      const groqReply = await askGroq(systemPrompt, question);
      if (groqReply) {
        return NextResponse.json({ reply: groqReply, provider: "groq" });
      }
    } catch (groqErr: any) {
      console.error("Groq career coach fallback failed:", groqErr?.message || groqErr);
    }

    return NextResponse.json(
      {
        error:
          "No usable AI provider is configured for the career coach. Set a valid GEMINI_API_KEY or GROQ_API_KEY.",
        code: "AI_PROVIDER_UNAVAILABLE",
      },
      { status: 503 }
    );
  } catch (err: any) {
    console.error("Career Coach API error:", err);
    return NextResponse.json(
      { error: err.message || "Career coach encountered an unexpected issue." },
      { status: 500 }
    );
  }
}
