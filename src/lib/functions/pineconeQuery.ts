// server/pinecone.ts
"use server";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

export async function retrivalServer(userQuery: string): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const pineconeKey = process.env.PINECONE_API_KEY || process.env.PINECONE_KEY;
  const indexName = process.env.PINECONE_INDEX_NAME;

  if (!geminiKey || geminiKey.includes("dummy") || !pineconeKey || pineconeKey.includes("dummy") || !indexName) {
    console.warn("Pinecone retrieval skipped: GEMINI_API_KEY or PINECONE_API_KEY is not configured.");
    return "";
  }

  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: geminiKey,
    model: "text-embedding-004",
  });

  const queryVector = await embeddings.embedQuery(userQuery);

  const pinecone = new Pinecone({ apiKey: pineconeKey });
  const pineconeIndex = pinecone.Index(indexName);

  const searchResults = await pineconeIndex.query({
    topK: 10,
    vector: queryVector,
    includeMetadata: true,
  });

  console.log("PINECONE SEARCH RESULTS-------------->", searchResults);

  return searchResults.matches.map((m) => m?.metadata?.text).filter(Boolean).join("\n\n---\n\n");
}
