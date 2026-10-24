/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { jsonrepair } from "jsonrepair";
import { groqComplete, llmErrorResponse } from "@/lib/ai/groq";

// schema non-strict
const RoadmapSchema = z.object({
  roadmapTitle: z.string().optional(),
  description: z.string().optional(),
  duration: z.string().optional(),
  initialNodes: z
    .array(
      z.object({
        id: z.string().optional(),
        type: z.string().optional(),
        position: z
          .object({
            x: z.number().optional(),
            y: z.number().optional(),
          })
          .optional(),
        data: z
          .object({
            title: z.string().optional(),
            description: z.string().optional(),
            link: z.string().optional(), // any string allowed
          })
          .optional(),
      })
    )
    .optional(),
  initialEdges: z
    .array(
      z.object({
        id: z.string().optional(),
        source: z.string().optional(),
        target: z.string().optional(),
      })
    )
    .optional(),
});

const parser = StructuredOutputParser.fromZodSchema(RoadmapSchema as any);

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "The language model is not configured on this server.", code: "LLM_UNCONFIGURED" },
        { status: 503 }
      );
    }

    const body = await req.json();
    const field = body.field || "Software Developer";
    const timeline = body.timeline || "3 months";
    const mode = body.mode || "Beginner";
    const formatInstructions = parser.getFormatInstructions();

    const firstPrompt = `
You are an expert roadmap generator.

Task: Create a concise learning roadmap for a "${field}".

Requirements:
1. Roadmap must include:
   - roadmapTitle (short title of the roadmap)
   - description (1-2 lines summary)
   -  duration: "${timeline}"

2. initialNodes (5-8 topics):
    - Divide topics aligned to "${mode}" difficulty
    - Split into: Basics (2-3), Intermediate (2-3), Advanced (1-2)
    - Each node must have:
     • id: unique string (e.g. "node-1")
     • type: "default"
     • position: { x, y } → numeric values
     • data:
       - title: short name of the topic
       - description: 1-2 line explanation
       - link: a relevant reference link (e.g. free resource)

3. initialEdges:
   - Each edge must connect nodes logically from Basics → Intermediate → Advanced.
   - Each edge must have:
     • id: unique string (e.g. "edge-1")
     • source: source node id
     • target: target node id

Additional Rules:
- No extra commentary — only return valid JSON.
- JSON must strictly follow the schema.

${formatInstructions}
`;

    const firstText = await groqComplete({
      prompt: firstPrompt,
      model: "qwen/qwen3.8-27b",
      temperature: 0.3,
      maxTokens: 1000,
    });
    let repairedJSON: string;
    try {
      repairedJSON = jsonrepair(firstText);
    } catch {
      repairedJSON = firstText;
    }

    let finalParsed: any;
    try {
      finalParsed = await parser.parse(repairedJSON);
    } catch (parseErr) {
      console.warn("First parser attempt failed, trying fallback extraction...", parseErr);
      const jsonMatch = repairedJSON.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        finalParsed = JSON.parse(jsonMatch[0]);
      } else {
        throw parseErr;
      }
    }

    return NextResponse.json(finalParsed);
  } catch (error) {
    return llmErrorResponse(error);
  }
}
