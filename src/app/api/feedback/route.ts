/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/session";
import { groqComplete, llmErrorResponse } from "@/lib/ai/groq";

interface FeedbackRequest {
  conversation: { type: "user" | "assistant"; content: string }[];
}

const feedbackSchema = z.object({
  feedback: z.object({
    rating: z.object({
      technicalSkills: z.number().min(0).max(10).optional(),
      communication: z.number().min(0).max(10).optional(),
      problemSolving: z.number().min(0).max(10).optional(),
      experience: z.number().min(0).max(10).optional(),
    }),
    summary: z
      .string()
      .describe("4-5-line summary of the conversation")
      .optional(),
  }),
});

const parser = StructuredOutputParser.fromZodSchema(feedbackSchema as any);

const promptTemplate = PromptTemplate.fromTemplate(`
You are an expert interview evaluator. Below is a full interview conversation between a User (candidate) and an Assistant (interviewer):

{conversation}

Your task:
- Carefully analyze the conversation to assess the User's overall performance.
- Rate the following (0-10 scale):
  • technicalSkills — depth, correctness, and relevance of technical answers  
  • communication — clarity, confidence, and articulation  
  • problemSolving — logical reasoning, approach to challenges, and adaptability  
  • experience — practical knowledge, domain familiarity, and application of past learning
- Then, write a short **4-5 line summary** giving:
  • Key strengths you observed  
  • Weak areas or gaps  
  • Actionable advice on how the User can improve before the next round  

Output ONLY JSON in this exact format:
{format_instructions}
`);


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

    const modelName = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

    const body: FeedbackRequest = await request.json();
    const { conversation } = body;

    if (!conversation || conversation.length === 0) {
      return NextResponse.json(
        { isError: true, error: "Missing conversation data" },
        { status: 400 }
      );
    }

    const conversationString = conversation
      .map((m) => `${m.type === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");

    const promptText = await promptTemplate.format({
      conversation: conversationString,
      format_instructions: parser.getFormatInstructions(),
    });

    const rawText = await groqComplete({
      prompt: promptText,
      model: modelName,
      temperature: 0.3,
      maxTokens: 2000,
    });

    let result: any;
    try {
      result = await parser.parse(rawText);
    } catch {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("The model did not return usable JSON.");
      result = JSON.parse(jsonMatch[0]);
    }

    const finalResult = {
      feedback: {
        rating: {
          technicalSkills: result?.feedback?.rating?.technicalSkills ?? 0,
          communication: result?.feedback?.rating?.communication ?? 0,
          problemSolving: result?.feedback?.rating?.problemSolving ?? 0,
          experience: result?.feedback?.rating?.experience ?? 0,
        },
        summary: result?.feedback?.summary ?? "",
      },
    };

    return NextResponse.json({ data: finalResult });
  } catch (error) {
    return llmErrorResponse(error);
  }
}
