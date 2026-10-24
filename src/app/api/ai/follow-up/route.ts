import { NextResponse } from "next/server";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/session";
import { groqComplete, LlmError } from "@/lib/ai/groq";

// --- Zod Schema
const followUpSchema = z.object({
  followUps: z.array(z.string()).optional(),
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parser = StructuredOutputParser.fromZodSchema(followUpSchema as any);

// --- Prompt Template ---
const promptTemplate = PromptTemplate.fromTemplate(`
Conversation between Assistant and User:
{conversation}

Based on the above conversation, suggest 4 very short and natural follow-up questions
that a user might ask next. Focus on continuing the topic and being relevant. Dont make it too long.

Return ONLY JSON in this format, no other text or reponse is allowed:
{format_instructions}
`);

// --- Usage ---
export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { followUps: [], error: "The language model is not configured on this server.", code: "LLM_UNCONFIGURED" },
        { status: 503 }
      );
    }

    const body = await req.json();
    const conversationString: string = body.conversationString;

    if (!conversationString) {
      return NextResponse.json({ followUps: [] }, { status: 400 });
    }

    const promptText = await promptTemplate.format({
      conversation: conversationString,
      format_instructions: parser.getFormatInstructions(),
    });

    const rawText = await groqComplete({
      prompt: promptText,
      model: "qwen/qwen3.8-27b",
      temperature: 0.7,
      maxTokens: 300,
    });

    let parsed: { followUps?: string[] } = {};
    try {
      parsed = (await parser.parse(rawText)) as { followUps?: string[] };
    } catch {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    }
    const followUps = Array.isArray(parsed.followUps)
      ? parsed.followUps.slice(0, 4)
      : [];

    return NextResponse.json({ followUps });
  } catch (error) {
    // The coach UI reads `followUps`, so keep the key present while still
    // reporting the failure honestly instead of pretending the call succeeded.
    const payload: Record<string, unknown> = { followUps: [] };
    if (error instanceof LlmError) {
      payload.error = error.message;
      payload.code = error.code;
      return NextResponse.json(payload, { status: error.status });
    }
    console.error("Follow-up API error:", error);
    payload.error = "The follow-up generator failed unexpectedly.";
    payload.code = "LLM_UNEXPECTED";
    return NextResponse.json(payload, { status: 500 });
  }
}
