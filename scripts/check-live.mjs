/**
 * Read-only smoke checks against a deployed Mentlio instance.
 * Verifies that security fixes are actually live; never writes data.
 *
 * Usage: node scripts/check-live.mjs [baseUrl]
 */
const BASE = (process.argv[2] || process.env.LIVE_BASE_URL || "https://mentlio-career-platform.vercel.app").replace(/\/$/, "");

let passed = 0;
let failed = 0;
let skipped = 0;

function pass(name, detail = "") {
  passed++;
  console.log(`  PASS: ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  failed++;
  console.log(`  FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
}
function skip(name, detail = "") {
  skipped++;
  console.log(`  SKIP: ${name}${detail ? ` — ${detail}` : ""}`);
}

async function get(path, headers = {}) {
  const res = await fetch(`${BASE}${path}`, { headers, redirect: "manual" });
  const text = await res.text();
  return { res, text };
}

async function main() {
  console.log(`=== MENTLIO LIVE CHECKS — ${BASE} ===\n`);

  console.log("1. App shell");
  {
    const { res } = await get("/");
    res.status === 200 || res.status === 307
      ? pass("GET / responds", String(res.status))
      : fail("GET / responds", String(res.status));
  }

  console.log("2. Security headers");
  {
    const { res } = await get("/");
    const need = ["x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy"];
    const missing = need.filter((h) => !res.headers.get(h));
    missing.length === 0
      ? pass("baseline headers present")
      : fail("baseline headers present", `missing ${missing.join(", ")}`);
  }

  console.log("3. Anonymous data access");
  {
    const { res } = await get("/api/data/users?select=*&limit=1");
    res.status === 401
      ? pass("GET /api/data/users is rejected", "401")
      : fail("GET /api/data/users is rejected", String(res.status));
  }

  console.log("4. Public mentor payload");
  {
    const { res, text } = await get("/api/data/mentors?select=*&limit=1");
    if (res.status !== 200) {
      fail("GET /api/data/mentors", String(res.status));
    } else {
      let rows = [];
      try {
        const body = JSON.parse(text);
        rows = Array.isArray(body) ? body : body ? [body] : [];
      } catch {
        fail("mentor payload is JSON");
      }
      if (rows.length === 0) {
        skip("mentor PII redaction", "directory is empty on this deployment");
      } else {
        const row = rows[0];
        if ("phone" in row) fail("mentor phone not public");
        else pass("mentor phone not public");
        if ("email" in row) fail("mentor email not public to anonymous callers");
        else pass("mentor email not public to anonymous callers");
      }
    }
  }

  console.log("5. Login does not enumerate accounts");
  {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: `nobody-${Date.now()}@example.invalid`, password: "WrongPass123!" }),
    });
    const body = await res.text();
    if (res.status !== 401) fail("unknown email rejected", String(res.status));
    else if (/not found|no user|unknown email/i.test(body)) fail("error message is generic", body.slice(0, 120));
    else pass("error message is generic");
  }

  console.log("6. AI routes require a session");
  {
    const res = await fetch(`${BASE}/api/ai/roadmap-gen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    res.status === 401
      ? pass("anonymous roadmap-gen rejected", "401")
      : fail("anonymous roadmap-gen rejected", `${res.status} (must not reach the model)`);
  }

  console.log("7. College search fails honestly");
  {
    const { res, text } = await get("/api/colleges?page=1&limit=6");
    if (res.status === 200) {
      pass("college search configured", "200");
    } else if (res.status === 503 && /SEARCH_PROVIDER_/.test(text)) {
      pass("college search returns explicit 503", text.slice(0, 120));
    } else {
      fail("college search error is explicit", `${res.status} ${text.slice(0, 120)}`);
    }
  }

  console.log("8. Session endpoint is anonymous-safe");
  {
    const { res, text } = await get("/api/auth/session");
    let ok = false;
    try {
      const body = JSON.parse(text);
      ok = res.status === 200 && (body.user === null || body.user === undefined);
    } catch {}
    ok ? pass("anonymous session is null") : fail("anonymous session is null", `${res.status} ${text.slice(0, 80)}`);
  }

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed, ${skipped} skipped ===`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Live check crashed:", err.message);
  process.exit(1);
});
