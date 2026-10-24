// Automated Test Suite for LLM Endpoints in Mentlio
// NOTE: AI endpoints require an authenticated session (regression guard for
// quota protection). This suite signs up a dedicated test user first.
import fs from "fs";
import dotenv from "dotenv";

if (fs.existsSync(".env.local")) {
  const env = dotenv.parse(fs.readFileSync(".env.local"));
  for (const k in env) {
    if (!process.env[k]) {
      process.env[k] = env[k];
    }
  }
}

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

let testPassCount = 0;
let testFailCount = 0;
let blockedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    testPassCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    testFailCount++;
  }
}

function blocked(message) {
  console.log(`  ⚠️  BLOCKED(ENV): ${message}`);
  blockedCount++;
}

let sessionCookie = "";

async function signupTestUser() {
  const email = `llm_test_${Date.now()}@mentlio.local`;
  const res = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "SecurePassword123!", fullName: "LLM Test User" }),
  });
  if (!res.ok) throw new Error(`Test user signup failed: ${res.status}`);
  const setCookie = res.headers.getSetCookie?.() || [];
  for (const c of setCookie) {
    if (c.startsWith("mentlio_session=")) {
      sessionCookie = c.split(";")[0];
    }
  }
  if (!sessionCookie) throw new Error("No session cookie issued at signup");
}

const authed = () => ({ "Content-Type": "application/json", cookie: sessionCookie });

async function runLlmTests() {
  console.log("=== STARTING MENTLIO LLM & AI ENDPOINTS TEST SUITE ===\n");

  await signupTestUser();
  console.log("Authenticated test user created.\n");

  // 0. Anonymous requests must be rejected (quota-protection regression guard)
  console.log("Test 0: Anonymous AI requests are rejected");
  const anonRes = await fetch(`${BASE_URL}/api/ai/follow-up`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationString: "User: hi" }),
  });
  assert(anonRes.status === 401, "Anonymous follow-up request returns 401");

  // 1. Groq Roadmap Generation
  console.log("\nTest 1: Roadmap Generation (/api/ai/roadmap-gen)");
  try {
    const res1 = await fetch(`${BASE_URL}/api/ai/roadmap-gen`, {
      method: "POST",
      headers: authed(),
      body: JSON.stringify({ field: "Cloud DevOps Engineer", timeline: "3 months", mode: "Beginner" }),
    });
    const data1 = await res1.json();
    if (res1.status === 429) {
      blocked("Groq rate-limited (429) — endpoint reachable but account quota exhausted");
    } else {
      assert(res1.status === 200, `Roadmap generation returns HTTP 200 (got ${res1.status})`);
      assert(Boolean(data1.roadmapTitle) || (data1.initialNodes || []).length > 0, "Roadmap response contains structured title or nodes");
    }
  } catch (err) {
    assert(false, `Roadmap generation exception: ${err.message}`);
  }

  // 2. Groq Q&A Generation
  console.log("\nTest 2: Interview Q&A Generation (/api/ai/qna-generate)");
  try {
    const res2 = await fetch(`${BASE_URL}/api/ai/qna-generate`, {
      method: "POST",
      headers: authed(),
      body: JSON.stringify({
        jobTitle: "Frontend Engineer",
        jobDescription: "React, Next.js, TypeScript developer",
      }),
    });
    const data2 = await res2.json();
    if (res2.status === 429) {
      blocked("Groq rate-limited (429) — endpoint reachable but account quota exhausted");
    } else {
      assert(res2.status === 200, `Q&A generation returns HTTP 200 (got ${res2.status})`);
      const questions = data2?.data?.interviewQuestions;
      assert(Array.isArray(questions) && questions.length > 0, "Q&A returns non-empty interview questions array");
    }
  } catch (err) {
    assert(false, `Q&A generation exception: ${err.message}`);
  }

  // 3. Groq Follow-up Generation
  console.log("\nTest 3: Follow-up Questions (/api/ai/follow-up)");
  try {
    const res3 = await fetch(`${BASE_URL}/api/ai/follow-up`, {
      method: "POST",
      headers: authed(),
      body: JSON.stringify({
        conversationString: "User: How do I become a systems architect?\nAI: Master distributed systems, high availability, and cloud design.",
      }),
    });
    const data3 = await res3.json();
    if (res3.status === 429) {
      blocked("Groq rate-limited (429) — endpoint reachable but account quota exhausted");
    } else {
      assert(res3.status === 200, `Follow-up returns HTTP 200 (got ${res3.status})`);
      assert(Array.isArray(data3.followUps), "Returns structured follow-up payload");
    }
  } catch (err) {
    assert(false, `Follow-up exception: ${err.message}`);
  }

  // 4. Gemini Career Coach - Error and Key Protection Handling
  console.log("\nTest 4: Gemini Career Coach (/api/ai/career-coach) - Key Validation");
  try {
    const res4 = await fetch(`${BASE_URL}/api/ai/career-coach`, {
      method: "POST",
      headers: authed(),
      body: JSON.stringify({ question: "What skills should I learn first?", userName: "TestUser" }),
    });
    const data4 = await res4.json();
    if (res4.status === 200) {
      assert(Boolean(data4.reply), "Returns valid coaching reply when key is live");
    } else {
      assert(res4.status === 503, `Gracefully returns 503 when Gemini key is invalid/revoked (got ${res4.status})`);
      assert(data4.code === "GEMINI_KEY_INVALID", "Returns explicit GEMINI_KEY_INVALID error code");
    }
  } catch (err) {
    assert(false, `Career Coach exception: ${err.message}`);
  }

  // 5. Embeddings Endpoint - Credential Validation
  console.log("\nTest 5: Vector Embeddings (/api/embed) - Credential Validation");
  try {
    const res5 = await fetch(`${BASE_URL}/api/embed`, { method: "POST", headers: { cookie: sessionCookie } });
    const data5 = await res5.json();
    if (res5.status === 200) {
      assert(data5.success === true, "Embeddings stored successfully when credentials present");
    } else {
      assert(res5.status === 503, `Gracefully returns 503 when Pinecone/Gemini credentials are dummy (got ${res5.status})`);
      assert(data5.code === "CREDENTIALS_MISSING", "Returns CREDENTIALS_MISSING code");
    }
  } catch (err) {
    assert(false, `Embed exception: ${err.message}`);
  }

  console.log("\n=== LLM TEST SUITE RESULTS ===");
  console.log(`Total Passed: ${testPassCount}`);
  console.log(`Total Failed: ${testFailCount}`);
  console.log(`Total Blocked(env): ${blockedCount}`);

  if (testFailCount > 0) {
    process.exit(1);
  } else {
    console.log("ALL LLM ENDPOINT TESTS PASSED AS EXPECTED!\n");
  }
}

runLlmTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
