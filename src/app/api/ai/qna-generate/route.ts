/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/session";
import { groqComplete, llmErrorResponse } from "@/lib/ai/groq";

interface InterviewRequest {
  jobTitle: string;
  jobDescription: string;
}

const questionSchema = z.array(
  z.object({
    interviewQuestions: z.array(
      z.object({
        question: z.string().describe("The interview question"),
      })
    ),
  })
);

const parser = StructuredOutputParser.fromZodSchema(questionSchema as any);

const promptTemplate = PromptTemplate.fromTemplate(`
Based on the following inputs, generate 6-7 high-quality interview questions:
Job Title: {jobTitle}
Job Description: {jobDescription}

Your task:
- Analyze the job description to identify the key skills, technologies, and experience needed.
- Generate:
  - 2 easy-level questions (to test basic understanding),
  - 2-3 moderate-level questions (to test applied skills),
  - 1-2 advanced-level questions (to test deep expertise or problem-solving ability).
  - Each question should be short to medium length, clear, and suitable for an oral conversation enough to understand the candidate's skills.
- Make sure the questions are realistic, relevant, and diverse in focus (e.g., theory, application, reasoning).
- Return a JSON array containing a single object with the key 'interviewQuestions' containing an array of objects with 'question' field.
- Do not include markdown, explanations, or extra text.

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

    const body: InterviewRequest = await request.json();
    const { jobTitle, jobDescription } = body;

    if (!jobTitle || !jobDescription) {
      return NextResponse.json(
        { isError: true, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const promptText = await promptTemplate.format({
      jobTitle,
      jobDescription,
      format_instructions: parser.getFormatInstructions(),
    });

    const rawText = await groqComplete({
      prompt: promptText,
      model: modelName,
      temperature: 0.6,
      maxTokens: 2500,
    });

    let result: any;
    try {
      result = await parser.parse(rawText);
    } catch (parseErr) {
      console.warn("Strict parsing failed in qna-generate, trying fallback extraction...", parseErr);
      const jsonMatch = rawText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw parseErr;
      }
    }

    let questions: any[] = [];
    if (Array.isArray(result)) {
      questions = result[0]?.interviewQuestions || result;
    } else if (result?.interviewQuestions) {
      questions = result.interviewQuestions;
    }

    const finalResult = {
      interviewQuestions: questions.map((q: any) => ({
        question: typeof q === "string" ? q : q?.question || "",
      })),
    };

    return NextResponse.json({ data: finalResult });
  } catch (error) {
    return llmErrorResponse(error);
  }
}
