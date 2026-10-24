/**
 * Server-side Groq client used by every AI feature.
 *
 * `@langchain/groq` 0.2.4 fails against Groq in this runtime (the response body
 * closes early and the SDK then retries for 80-115s before surfacing a 500), so
 * the routes call the OpenAI-compatible endpoint directly with a hard wall-clock
 * timeout and a bounded number of attempts. Prompts and output parsers stay
 * unchanged — this only replaces the transport.
 */
import { NextResponse } from "next/server";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_ATTEMPTS = 2;

export class LlmError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, code: string, status = 503) {
    super(message);
    this.name = "LlmError";
    this.code = code;
    this.status = status;
  }
}

export function groqModel(defaultModel = "qwen/qwen3.8-27b") {
  return process.env.GROQ_MODEL || defaultModel;
}

export async function groqComplete(options: {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  maxAttempts?: number;
}): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new LlmError("GROQ_API_KEY is not configured.", "LLM_UNCONFIGURED", 503);
  }

  const {
    prompt,
    system,
    model = groqModel(),
    temperature = 0.3,
    maxTokens = 1000,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
  } = options;

  const messages = system
    ? [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ]
    : [{ role: "user", content: prompt }];

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
        signal: controller.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        const retryable = res.status === 429 || res.status >= 500;
        const code =
          res.status === 401 || res.status === 403
            ? "LLM_KEY_INVALID"
            : res.status === 429
              ? "LLM_RATE_LIMITED"
              : retryable
                ? "LLM_UPSTREAM_ERROR"
                : "LLM_BAD_REQUEST";
        const status = res.status === 429 ? 429 : retryable ? 503 : 502;
        const retryAfter = Number(res.headers.get("retry-after") || 0);
        throw Object.assign(
          new LlmError(
            retryable
              ? `Groq is busy (${res.status}); the request was retried and failed again.`
              : `Groq rejected the request (${res.status}): ${text.slice(0, 300)}`,
            code,
            status
          ),
          { retryable, retryAfterMs: retryAfter * 1000 }
        );
      }
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        throw new LlmError("Groq returned a malformed response.", "LLM_MALFORMED", 502);
      }
      const content = json?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || content.length === 0) {
        throw new LlmError("Groq returned an empty completion.", "LLM_EMPTY_RESPONSE", 502);
      }
      return content;
    } catch (err) {
      lastError = err;
      const aborted = (err as Error)?.name === "AbortError";
      if (aborted) {
        lastError = new LlmError(
          `Groq did not respond within ${Math.round(timeoutMs / 1000)}s.`,
          "LLM_TIMEOUT",
          504
        );
      }
      const retryable = aborted || (err instanceof LlmError && (err as LlmError & { retryable?: boolean }).retryable === true);
      if (!retryable) throw err instanceof LlmError ? err : lastError;
      if (attempt < maxAttempts) {
        const backoff = Math.min(
          5000,
          (err as LlmError & { retryAfterMs?: number }).retryAfterMs || 500 * attempt
        );
        await new Promise((r) => setTimeout(r, backoff));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  if (lastError instanceof LlmError) throw lastError;
  throw new LlmError(
    `Could not reach the language model: ${(lastError as Error)?.message || "unknown error"}`,
    "LLM_UNAVAILABLE",
    503
  );
}

/** Uniform, honest error shape for AI routes — never a bare 500 with a stack. */
export function llmErrorResponse(error: unknown) {
  if (error instanceof LlmError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error("Unexpected AI route failure:", error);
  return NextResponse.json(
    { error: "The AI feature failed unexpectedly.", code: "LLM_UNEXPECTED" },
    { status: 500 }
  );
}
