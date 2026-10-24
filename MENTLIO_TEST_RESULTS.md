# MENTLIO — Test Results

Date: 2026-10-24
Build under test: local repository `mentlio-career-platform` (Next.js 16.1.1), dev server `http://localhost:3000`, production bundle built locally with `npm run build`.
Production URL `https://mentlio-career-platform.vercel.app/` was used only for read-only reconnaissance in earlier phases; **the fixes in this pass are not deployed** (no deployment authorization was given).

Status vocabulary: **PASS / FAIL / BLOCKED / NOT IMPLEMENTED / NOT TESTED / FIXED — RETESTED**. No untested behaviour is marked PASS.

---

## 1. Test environment and method

| Item | Value |
|---|---|
| OS / runtime | Windows 10 (build 26300), Node v24.18.0, Git Bash |
| Framework | Next.js 16.1.1 App Router (Turbopack), React 19, TypeScript |
| Database | File JSON store at `data/mentlio.json` (Vercel would use ephemeral `/tmp/mentlio.json`) |
| Browser automation | Chrome via browser-use MCP: real clicks, typing through native setters + `input` events, snapshot-based trusted clicks for radix tabs |
| API automation | `scripts/test-auth.mjs`, `scripts/test-api-security.mjs`, `scripts/test-functional.mjs`, `scripts/test-llm.mjs` |
| Test accounts | Local QA fixtures only (`qa_func_stu_a@mentlio.local`, `qa_func_stu_b@mentlio.local`, `qa_func_mentor@mentlio.local`). No real user records were deleted. |
| Payments | Never executed against live Razorpay. Production guard and unconfigured-key paths only. |

### Reproduce

```bash
npm run dev            # terminal 1
npm run test:auth      # 24 checks
npm run test:security  # 51 checks
npm run test:functional# 43 checks
npm run test:llm       # live LLM endpoints
npx tsc --noEmit
npm run build
```

---

## 2. Phase 1 — Repository baseline

| Check | Status | Evidence |
|---|---|---|
| Project installs and starts | PASS | `next dev` ready on :3000; `.env.local` loaded |
| Route inventory | PASS | 38 `page.tsx` routes; see `MENTLIO_FEATURE_INVENTORY.md` |
| API inventory | PASS | 33 route handlers, all classified public vs auth-required |
| Baseline typecheck | FAIL → FIXED — RETESTED | Started with an ImageKit type error; `npx tsc --noEmit` is now silent (exit 0) |
| Baseline production build | FAIL → FIXED — RETESTED | Build threw because `SESSION_SECRET` was missing; a real 48-byte secret is now in `.env.local` and the build completes |

---

## 3. Phase 3 — Real user interaction (browser)

Every surface below was opened in a signed-in browser session. "Empty state" is only acceptable when the API genuinely returned no rows; unconfigured providers must show their 503 reason.

### Public / auth

| Surface | Status | Observed |
|---|---|---|
| `/` anonymous | FIXED — RETESTED | Redirects to `/auth` |
| `/auth` email login/signup | PASS | QA student signs in, cookie set, redirect to `/home` |
| `/auth-mentor` mentor login | PASS | QA mentor signs in, redirect to `/dashboard` |
| OAuth buttons (Google/Discord/Slack) | BLOCKED | Placeholder provider credentials; no session is fabricated |
| `/web` | PASS | `Services`/`About` anchors scroll to real sections; `Pricing` → `/home/settings/billing`; no dead "Reach us" |
| `/email-verified` | NOT IMPLEMENTED | No verification mail is sent; page CTA now points to `/auth` |
| `/unauthorized` | PASS | Renders role-mismatch landing |

### Student app

| Surface | Status | Observed |
|---|---|---|
| `/home` | PASS | Greeting, career line, quick actions, recommended mentors, persisted resume card |
| `/start-quiz` → result | PASS | 10-question quiz, no auto-skip, score saved to `userQuizData` |
| `/home/ai-tools/career-coach` | FIXED — RETESTED | Suggestion chips persist `selectedCareer`; "Choose your career" dialog; quick actions navigate; chat replies via Groq fallback |
| `/home/career-board` | FIXED — RETESTED | No gate for the QA student; "Selected Career — Data Scientist / Data Analyst"; `Learn More` scrolls to `#industry-insights`; static benchmarks disclosed |
| `/home/job-tracker` | PASS | Persisted QA job renders in "Applied"; Add dialog; "Career Board" navigates; Tracked Jobs opens job search |
| `/home/mentor-connect` | PASS | 12 mentors fetched, career category, pagination; "0 exact matches" is literal position equality |
| `/home/mentor-connect/[id]` booking | PASS | Future slot booked, past slot rejected, credit failure reported honestly |
| `/home/mentor-connect/bookings` | FIXED — RETESTED | "Total Sessions Found : 4"; status filters; Join link only when `vc_link` exists |
| `/home/messages` | PASS | Existing QA thread renders; recipient scoping verified by tests |
| `/home/my-tracks` | PASS | Persisted track at 50%, checkpoint 2 available |
| `/home/my-tracks/[id]/mocktest/quiz` + results | FIXED — RETESTED | 5/10 fails, 6/10 passes → `isMockDone`, progress 50%, checkpoint unlock; results survive navigation |
| `/home/interview-prep` | PASS | History and empty states; start flow reaches provider boundary |
| Voice interview room | BLOCKED | Vapi public key placeholder — explicit message, no crash |
| `/home/ai-tools/roadmap-maker` | PASS | Live roadmap response (HTTP 200, structured nodes) |
| `/home/ai-tools/resume-maker` + `/start` | FIXED — RETESTED | Persisted draft loads; print/export works |
| `/home/profile` | PASS | Form populated (name, email, phone, invite link, chosen career) |
| `/home/calendar` | PASS | Agenda renders; local event persistence verified via API; Google sync BLOCKED (placeholder OAuth client) |
| `/home/settings` | NOT IMPLEMENTED | Redirect to billing only |
| `/home/settings/billing` | PASS | 2-column Free/Pro table, correct features, history; live payment BLOCKED (placeholder keys) |
| `/room/[roomid]` | BLOCKED | UI shows "Video calling is not configured on this server…"; token API 401 anonymous, 503 `ZEGO_SECRET_MISSING` authenticated |

### Mentor app

| Surface | Status | Observed |
|---|---|---|
| `/dashboard` | PASS | KPI cards, chart, calendar, messages rail; honest zero states |
| `/dashboard/sessions` | PASS | Pending / Confirmed / Ongoing tabs; accept/reject owner-scoped (also covered by API tests) |
| `/dashboard/calender` | PASS | Month view, "No confirmed or completed sessions on this date" |
| `/dashboard/upload` | BLOCKED | Page renders; ImageKit credentials are placeholders, upload fails with a real error |
| `/dashboard/profile` | PASS (avatar UI) / BLOCKED (upload) | Only an avatar uploader exists; text profile editing NOT IMPLEMENTED |
| `/dashboard/messages` | PASS | Empty thread list with honest state |
| Logout | FIXED — RETESTED | Cookie cleared; subsequent API calls 401 |

### Remaining UI gaps (not bugs)

- Mentor "Ongoing Session" tab is a placeholder; rejected requests are not listed for the mentor.
- Booking filter buttons lack `aria-pressed` (visual state only).
- Realtime is a no-op with the JSON store, so cross-tab changes need a reload.

---

## 4. Phase 4 — Authentication and authorization

| Check | Status | Evidence |
|---|---|---|
| Email signup (student + mentor) | PASS | scrypt hash stored, 10 credits, session issued |
| Duplicate email | PASS | 409 with clear message |
| Wrong password | PASS | 401 generic |
| Unknown email | FIXED — RETESTED | Same 401 body as wrong password; timing equalized (0.113 s vs 0.117 s) |
| Password-less seeded rows | PASS | Cannot log in ("any password" hole closed) |
| Signed cookie tamper | PASS | HMAC verified with `timingSafeEqual`; tampered token rejected |
| Session expiry | PASS | 72 h `expiresAt` checked |
| Cookie flags | PASS | `httpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/` |
| Logout invalidation | PASS | Cookie cleared |
| Student → mentor API access | PASS | 403/401 on mentor-only routes; student session cannot index mentor vectors |
| Cross-user reads/writes (IDOR) | PASS | Owner scoping via `READER_KEYS`; student B cannot read student A's rows or the mentor inbox |
| Anonymous API access | PASS | All non-public routes 401 |
| Page-level role separation | PASS | Student hitting `/dashboard` is not served the mentor dashboard |
| OAuth (real providers) | BLOCKED | Placeholder Google/Discord/Slack credentials; state parameter implemented |
| Email verification enforcement | NOT IMPLEMENTED | Signup issues a session immediately; `is_verified` is recorded but not enforced |
| Login rate limiting / lockout | NOT IMPLEMENTED | No throttle; Upstash credentials are placeholders |
| Captcha | NOT IMPLEMENTED | hCaptcha component is commented out and there is no server verification |

Automated coverage: **`npm run test:auth` → 24/24 PASS**.

---

## 5. Phase 5 — AI / LLM features

| Endpoint / surface | Provider | Status | Evidence |
|---|---|---|---|
| `/api/ai/roadmap-gen` | Groq | PASS | HTTP 200, structured title/nodes |
| `/api/ai/qna-generate` | Groq | PASS | HTTP 200, non-empty question array |
| `/api/ai/follow-up` | Groq | BLOCKED (env) | Reachable but account quota returns 429; surfaced as `LLM_RATE_LIMITED` |
| `/api/ai/career-coach` | Gemini → Groq fallback | PASS | Valid coaching reply through the fallback; Gemini key is revoked |
| `/api/ai/quiz-feedback` | Groq | PASS | Scoring/strengths/next-step payload (audit + flow) |
| `/api/ai/generate-checkpoint` | Groq | PASS | Used by track generation; bounded prompt |
| `/api/feedback` | Groq | PASS | Interview feedback path |
| `/api/ai/mocktest/generate-questions` | Groq | PASS | Mock-test pipeline |
| `/api/embed` | Gemini + Pinecone | BLOCKED | Honest `503 CREDENTIALS_MISSING`; no fake vectors |
| Voice interview (Vapi) | Vapi | BLOCKED | Placeholder public key; explicit toast |
| Auth on every AI route | — | PASS | All call `getServerSession()`; anonymous → 401 |
| Output safety / bounds | PASS | Server-side `groqComplete()` with timeouts and size limits; no keys in client bundle |

No uncontrolled loops were used: each endpoint was called once per test run.

Automated coverage: **`npm run test:llm` → 8 PASS, 0 FAIL, 1 BLOCKED(env)**.

---

## 6. Phase 6 — Database and persistence

| Check | Status | Evidence |
|---|---|---|
| Signup persists a user | PASS | Re-login after restart works |
| Quiz result persists | PASS | Row written; newest-attempt ordering enforced |
| Selected career persists | FIXED — RETESTED | `setSelectedCareer` updates every quiz row for the user; provider backfills across attempts |
| Booking lifecycle | PASS | Create → student read → mentor read → accept → foreign update rejected → cleanup |
| Messages | PASS | Sender/receiver read scoping; third party sees nothing; `or=` groups evaluated correctly |
| Job tracker | PASS | Insert/update persisted; foreign move rejected |
| Calendar | PASS | Event persists per user |
| Mock-test progress | FIXED — RETESTED | `isMockDone` + `roadmapUsers.progress` written |
| Notification insert | PASS | Signed-in booking can notify the mentor |
| Server-only tables | PASS | Direct client writes to `payments`, `orders`, `proctor_events` → 403/405 |
| Unfiltered PATCH/DELETE | PASS | Refused by the data API |
| Vercel durability | BLOCKED | `/tmp` JSON is wiped on deploy/cold start; needs Postgres/Supabase |

Automated coverage: **`npm run test:functional` → 43/43 PASS**, including cleanup of all seven rows each run creates (previously quiz/roadmap/notification fixtures leaked).

---

## 7. Phase 7 — Bug fixing

49 numbered findings are recorded in `MENTLIO_BUG_FIX_LOG.md`; every fixed item was retested. Highlights:

- Career personalization chain (selection → persistence → board/jobs/tracks/mentor matching) repaired and resilient to retakes.
- Dead CTAs wired or removed across the landing page, career board, job results and pricing.
- Fake/empty states replaced with explicit provider-unavailable messages (jobs, courses, YouTube, salary, voice, video).
- Mock-test data-loss, auto-skip and locked-checkpoint bypass fixed.
- Booking list, past-time booking and credit-failure honesty fixed.
- Account enumeration in login fixed; security headers added; production build unblocked.
- Test-suite fixture leak fixed so QA data cannot mask future regressions.

No real user records were deleted at any point. QA fixtures are namespaced (`qa_*`) and removed by the scripts.

---

## 8. Phase 8 — Automated tests and quality gates

| Gate | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | PASS (exit 0, no output) |
| Auth suite | `npm run test:auth` | PASS — 24/24 |
| API security suite | `npm run test:security` | PASS — 51/51 |
| Functional suite | `npm run test:functional` | PASS — 43/43 |
| LLM suite | `npm run test:llm` | PASS — 8 passed, 0 failed, 1 blocked (Groq 429) |
| Targeted lint | `npx eslint <changed files>` | PASS — 0 errors, 2 warnings (existing `no-img-element` in course thumbnails, exhaustive-deps in the quiz provider) |
| Full-repo lint | `npm run lint` | BLOCKED (environment OOM, baseline limitation) |
| Production build | `npm run build` | PASS — complete route table, all pages compiled |

`npm test` now runs auth → security → functional → LLM.

---

## 9. Phase 9 — Security, performance, usability

Summary only; details and residual risk are in `MENTLIO_FINAL_AUDIT.md`.

| Area | Status | Notes |
|---|---|---|
| Session/auth crypto | PASS | HMAC-SHA256, timing-safe compare, scrypt (64-byte key), httpOnly/SameSite/Secure, fail-closed without `SESSION_SECRET` |
| Authorization / IDOR | PASS | 51 API-security checks; owner scoping on read, patch and delete |
| Secret handling | PASS | Provider secrets server-only; Zego token signed server-side; no keys in test reports |
| Account enumeration | FIXED — RETESTED | Uniform 401 + equalized timing + generic 500 |
| Security headers | FIXED — RETESTED | `nosniff`, `X-Frame-Options`, `frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`, HSTS; `X-Powered-By` removed |
| CSRF posture | PASS (with caveat) | SameSite=Lax blocks cross-site POSTs; no explicit CSRF tokens |
| Rate limiting | NOT IMPLEMENTED | No auth/AI throttling; Upstash placeholders |
| Email verification / captcha | NOT IMPLEMENTED | Neither is enforced server-side |
| Credit debiting | NOT IMPLEMENTED | Credits are display-only; AI routes have no per-user quota |
| XSS | PASS | React escaping; only constant CSS via `dangerouslySetInnerHTML`; no `eval` |
| Performance | PASS (with caveats) | Static marketing pages, lazy AI SDK import for Zego, console stripped from production builds; JSON DB rewrites the whole file per mutation and `reactStrictMode` is off |
| Accessibility | PASS (with caveat) | New icon buttons labelled, locked checkpoints disabled, dialog labels; booking filter `aria-pressed` still missing |

---

## 10. Phase 10 — Final verification

| Item | Status |
|---|---|
| All local suites green | PASS |
| Typecheck | PASS |
| Production build | PASS (with the new `SESSION_SECRET`) |
| Security headers served | PASS (curl on `/web`) |
| Career board unlocks for the QA student after the provider fix | PASS |
| Live production site re-verified after the fixes | NOT TESTED — fixes are not deployed; deployment would need explicit authorization |
| Exact deployment steps | Listed in `MENTLIO_FINAL_AUDIT.md` §6 |

### Failure ledger (nothing hidden)

| Item | Status | Reason / next action |
|---|---|---|
| Live OAuth login | BLOCKED | Real Google/Discord/Slack credentials |
| Live voice interview | BLOCKED | Real Vapi public key |
| Live video room | BLOCKED | Real Zego app ID + server secret |
| Live payments | BLOCKED | Real Razorpay keys; live charges intentionally not attempted |
| Job/course/salary/YouTube feeds | BLOCKED | SerpApi / YouTube keys (placeholders) |
| Vector search / embeddings | BLOCKED | Gemini + Pinecone keys |
| Persistent production DB | BLOCKED | No Postgres/Supabase instance; `/tmp` JSON is ephemeral |
| Groq follow-up test | BLOCKED (env) | Provider 429 quota |
| Mentor notification list, completed-session history, settings UI | NOT IMPLEMENTED | Feature work, documented in the inventory |
| Rate limiting, server-side credit debits, email verification, captcha | NOT IMPLEMENTED | Security/product work, documented with exact requirements in the final audit |
| Full-repo eslint | BLOCKED | OOM in this environment |
