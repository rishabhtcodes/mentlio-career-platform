import { GoogleGenerativeAI } from "@google/generative-ai";

export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY || "dummy-gemini-key";
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

  const result = await model.embedContent(text);
  return result.embedding.values; // 768 dim
}
