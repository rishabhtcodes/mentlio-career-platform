/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/session";
import { groqComplete, llmErrorResponse } from "@/lib/ai/groq";

// -----------------------------
// ZOD SCHEMA (NO YOUTUBE)
// -----------------------------
const subtopicSchema = z.object({
  subtopic_order: z.number(),
  title: z.string(),
  overview: z.string(),
  resources: z.array(z.string()), 
//   yt video excluded from here.
});

const outputSchema = z.object({
  skills: z.array(z.string()),
  topics_covered: z.array(z.string()), 
  subtopics: z.array(subtopicSchema), 
});

const parser = StructuredOutputParser.fromZodSchema(outputSchema as any);

// -----------------------------
// PROMPT TEMPLATE
// -----------------------------
const promptTemplate = PromptTemplate.fromTemplate(`
You are an experienced AI expert with strong mastery in generating structured learning content for roadmap checkpoints.

Generate the following for:

Checkpoint Title: {title}
Checkpoint Description: {description}

Rules:
- Provide exactly 3-4 skills overall learned in this checkpoint (Main Important skills only).
- Provide exactly 4 bullet points under topics_covered for this checkpoint.
- Provide exactly 2 subtopics.
- For each subtopic:
  - Add a concise title.
  - Add a 2-3 line overview.
  - Add 2 external learning resource links (blogs, docs, tutorials).
- No YouTube links.
- No markdown.
- No extra commentary.
- Return only clean JSON.

{format_instructions}

`);

// -----------------------------
// API ROUTE
// -----------------------------
export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { isError: true, error: "The language model is not configured on this server.", code: "LLM_UNCONFIGURED" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { title, description } = body;

    if (!title || !description) {
      return NextResponse.json(
        { isError: true, error: "Missing title or description" },
        { status: 400 }
      );
    }

    const promptText = await promptTemplate.format({
      title,
      description,
      format_instructions: parser.getFormatInstructions(),
    });

    const rawText = await groqComplete({
      prompt: promptText,
      model: "qwen/qwen3.8-27b",
      temperature: 0.6,
      maxTokens: 1200,
    });

    let result: unknown;
    try {
      result = await parser.parse(rawText);
    } catch {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("The model did not return usable JSON.");
      result = JSON.parse(jsonMatch[0]);
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    return llmErrorResponse(error);
  }
}
