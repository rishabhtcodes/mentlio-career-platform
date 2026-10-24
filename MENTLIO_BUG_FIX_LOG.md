# MENTLIO — Bug Fix Log

Status legend: FIXED — RETESTED / FIXED — pending retest / BLOCKED

---

## Session 2026-10-23 (auth hardening + browser E2E)

### 1. Unauthenticated CRUD + secret leakage on `/api/data/users` — FIXED — RETESTED
- **Repro:** `curl GET /api/data/users` (no cookie) returned all rows incl. `passwordHash`; POST/PATCH/DELETE open.
- **Root cause:** generic data endpoint had no authn/authz.
- **Fix:** full rewrite of `src/app/api/data/[table]/route.ts`: session required (except public read of `mentors`/`colleges`); server-only `payments`/`orders`; directory read (`users`/`userQuizData`) for any signed-in user with `passwordHash`/`google_*_token` stripped; per-row ownership on reads (READER_KEYS) and writes (WRITER_CLAIM_KEYS); protected write fields (`role`, `isPro`, credits, `rating`, …) stripped; PATCH/DELETE require ownership of every matched row; idempotent account insert by email; mini-PostgREST filter engine (`eq/neq/gt/gte/lt/lte`, `or(...)`, `and(...)`, `order=`).

### 2. Login with any password for seeded mentors — FIXED — RETESTED
- **Repro:** seeded mentors had no `passwordHash`; login route treated `undefined` hash as success.
- **Fix:** `src/app/api/auth/login/route.ts` rejects accounts without `passwordHash` (401) before verify.

### 3. OAuth callbacks 404 + CSRF (`state = role`) — FIXED — RETESTED (flow-level)
- **Fix:** new `src/lib/auth/oauth-callback.ts` (`handleOAuthCallback`) + `/api/auth/oauth/{google,discord,slack}/callback` routes; nonce-based state in httpOnly `mentlio_oauth_state` cookie. Live provider verification BLOCKED (no real provider creds — never simulated).

### 4. Razorpay production self-credit — FIXED — RETESTED
- **Repro:** simulator accepted any signature as `sig_valid_${orderId}` in production builds.
- **Fix:** `src/app/api/razorpay/create-order/route.ts` simulator branch only when NOT (`NODE_ENV=production` || `VERCEL`); prod returns 503 `PAYMENT_PROVIDER_UNCONFIGURED`.

### 5. Google Calendar sync IDOR — FIXED — RETESTED
- **Repro:** `POST /api/google/sync` accepted arbitrary `userId` + refresh token in body.
- **Fix:** session required; body `userId` ignored; `session.userId` used; token logging removed. Same treatment for `/api/google/callback` (state must match session user) and `/api/google/connect`.

### 6. Login/signup browser dead-end (GoTrue session shape) — FIXED — RETESTED
- **Repro:** after correct credentials, UI stayed on `/auth`; signup falsely showed "check your email" (no email infra exists).
- **Root cause:** supabase-js `_sessionResponse` requires top-level `access_token` + `refresh_token` + `expires_in`; interceptor returned nested `{user, session}`.
- **Fix:** `src/lib/supabase/client.ts` `sessionPayload()` returns GoTrue shape for signup + token; refresh-grant resolves `/api/auth/session`; cookie-path fallback keeps OAuth redirects working.

### 7. `/auth/callback` stuck at "Validating user..." forever — FIXED — RETESTED
- **Repro:** log in → redirect to `/auth/callback` → spinner forever; console `Auth session missing!`.
- **Root cause:** `UserDataProvider` runs `ensureUserInDB` once on app mount; when mounted pre-login (on `/auth`), `user` stayed `null` and SPA navigation never re-triggered it; callback page's own re-check was commented out; no redirect for anonymous users; blank render when `is_verified===false` but localStorage flag missing.
- **Fix:** provider initial `loading=true`; callback page (student + mentor) calls `ensureUserInDB` on mount, redirects to `/auth` (resp. `/auth-mentor`) when authed check completes with no user, toast ref-guard against StrictMode double-fire, render gate includes `is_verified === false`, welcome toast uses `userName || userEmail` fallback.

### 8. Generic data route incompatible with supabase-js client contract — FIXED — RETESTED
- **Repro (8a):** every supabase-js GET through the interceptor returned `[]` — `select=*` query param was treated as a row filter (`row.select === "*"` → no matches). Broke messages, mentor lists, everything.
- **Repro (8b):** `setUser(inserted)` received a 1-element ARRAY — supabase-js sends insert bodies as arrays so the route returned an array, while postgrest-js `.single()` (this version) only sets `Accept: application/vnd.pgrst.object+json` and does not unwrap. All downstream `user.id` were `undefined` (onboarding PATCH went to `?id=undefined`, toast showed "Welcome aboard, undefined!").
- **Repro (8c):** PATCH/DELETE from supabase-js `.eq("id", x)` sent `?id=eq.x`; route required `eqKey`/`eqVal` → 400.
- **Fix:** skip `select`/`columns` params in filtering; honor `Accept: application/vnd.pgrst.object+json` on GET+POST to return a single object; `resolveEqFilter()` accepts supabase-js `key=eq.value` / plain `key=value` filters (eqKey/eqVal still supported).
- **Retest:** full browser onboarding completed; `users` row persisted with phone/institution/focus/status/`is_verified=true`; redirect to `/home` works.

### 9. Onboarding could not set `is_verified` — FIXED — RETESTED
- **Repro:** finishing onboarding PATCHed `is_verified: true`, but the field was in `PROTECTED_WRITE_FIELDS` → stripped → next login resumed onboarding forever.
- **Fix:** removed `is_verified` from protected set; PATCH ownership check already restricts it to the caller's own row.

### 10. Unauthenticated paid-quota AI/data endpoints — FIXED — RETESTED
- **Fix:** `getServerSession()` 401 guard added at POST top of: career-coach, follow-up, qna-generate, roadmap-gen, quiz-feedback, generate-checkpoint, feedback, mocktest/generate-questions, tavily, vector/upload (also requires role=mentor), gcp-upload (POST + session), upload-auth. Courses/jobs mock fallbacks → 503 `SEARCH_PROVIDER_UNCONFIGURED`; colleges DB fallback uses server-side `getTable`.

## Session 2026-10-23 (continued: supabase-js contract, secrets, dead controls, prod hygiene)

### 11. Every `.in()` query silently returned zero rows — FIXED — RETESTED
- **Repro:** `/home` mentor rail, messages, and any `supabase.from(t).select().in(col,[…])` came back `[]` even with matching rows.
- **Root cause:** `src/lib/supabase/client.ts` rewrote `?col=in.(a,b)` into a mangled param before forwarding, so the server-side filter engine never saw valid PostgREST grammar.
- **Fix:** forward `url.search` verbatim (`new URLSearchParams(url.search)`), only translating the transport (Content-Type/Accept). Server-side engine gained `in.` / `is.` operators (`filterParams`, `rowMatchesFilters`, `splitTopLevel` in `api/data/[table]/route.ts`).
- **Retest:** browser network log shows `or=(sender_id.eq.…,receiver_id.eq.…)` and `rating=gt.4&order=rating.desc&limit=6` returning data; `test-api-security.mjs` Test K asserts `in.()` returns 2 rows.

### 12. PATCH/DELETE could target more rows than intended — FIXED — RETESTED
- **Repro:** `PATCH /api/data/users?userEmail=eq.x&id=eq.y` used only the **first** filter param, so a multi-filter update collapsed to "every row of this user"; a request with **no** filter mutated/deleted the whole table.
- **Fix:** `buildTargetMatcher()` — PATCH/DELETE now require a real filter (AND of all params + `or=` group) and return **400 "A row filter is required…"** when none is present; the same matcher is used for the ownership check and the mutation, so target selection can no longer diverge from authorization. `resolveEqFilter()` removed.
- **Retest:** Test J (unfiltered PATCH/DELETE → 400) in `scripts/test-api-security.mjs`.

### 13. Anonymous directory reads leaked personal fields of every account — FIXED — RETESTED
- **Repro:** signed-in student `GET /api/data/users` received peers' `phone`, credit balances, `institutionName`, coordinates; anonymous `GET /api/data/mentors` included mentors' phone numbers.
- **Fix:** `PEER_VISIBLE_FIELDS` allowlist (id, userName, userEmail, avatar, mainFocus, current_status, created_at) applied to non-owned directory rows; `PUBLIC_REDACTED_FIELDS` strips `phone` from mentor rows read without a mentor session. Own-row reads stay unrestricted so profile/settings still work.
- **Retest:** Test I + Test L pass; `/home` still renders the peer rail and profile.

### 14. Secrets inlined into browser bundles (Gemini, Tavily, YouTube) — FIXED — RETESTED
- **Repro:** `NEXT_PUBLIC_GEMINI_API_KEY`, `NEXT_PUBLIC_TAVILY_API_KEY`, `NEXT_PUBLIC_YOUTUBE_API_KEY` are build-time inlined — any visitor could read them from the JS bundle, and `YtVideo.tsx` / `CourseData.tsx` / `my-tracks/[id]/start` called `googleapis.com` directly with the key.
- **Fix:** new session-guarded `src/app/api/youtube/search/route.ts` (server-first `YOUTUBE_API_KEY`, 401 without session, query length/`maxResults` bounds, 503 `YOUTUBE_UNCONFIGURED`, 502 on upstream error); all three call sites now hit the proxy and their inlined-key lines were deleted. `/api/tavily` prefers server-side `TAVILY_API_KEY` and returns 503 `TAVILY_UNCONFIGURED` instead of pretending. `.env.example` rewritten to mark these keys server-only.
- **Retest:** Test M asserts the proxy 401s anonymously and reports 503 honestly; no `NEXT_PUBLIC_(GEMINI|TAVILY|YOUTUBE)` reference remains in `src`.

### 15. Client-side AI agent with an unbounded tool loop — FIXED — RETESTED
- **Repro:** `src/lib/functions/Agents.ts` (`"use client"`) constructed `GoogleGenAI` with the inlined key (falling back to the literal `"unconfigured-client-key"`) and ran `while (true)` over tool calls in the browser — an uncontrolled request loop with a billing key.
- **Fix:** deleted `Agents.ts` and the fully commented-out `src/lib/functions/tavily.ts`; removed the dead `runAgent` import from `career-coach/page.tsx`. All AI generation stays server-side behind session-guarded routes with quota checks.

### 16. Session cookie forgeable with a repo-committed secret when `SESSION_SECRET` is unset — FIXED — RETESTED
- **Repro:** `session.ts` always fell back to a hard-coded 56-char secret committed to the repo, so anyone with the source could mint `role:"admin"` tokens — and the dev fallback was used in production too.
- **Fix:** `resolveSessionSecret()` requires `SESSION_SECRET` ≥32 chars; in `NODE_ENV=production` it **throws** (fail closed) instead of using the fallback; the fallback is dev-only and documented in `.env.example` with the generation command.

### 17. Four development-only endpoints reachable in production — FIXED — RETESTED
- **Repro:** `/home/test`, `/home/test/showchats`, `/home/test/run-embed`, `/home/test/yt` were routable pages exposing raw component scaffolding.
- **Fix:** `showchats` → `_components/MessageNamesList.tsx`, `yt` → `_components/YtVideo.tsx` (imports updated in `home/page.tsx`, `CourseData.tsx`, `MessagesRightBar.tsx`); `test/page.tsx` and `test/run-embed/page.tsx` deleted; `.next/types` cleared and the app restarted.
- **Retest:** Test M…(404 assertions) + browser navigation to `/home/test` returns not-found.

### 18. Mentor logout was a dead button — FIXED — RETESTED
- **Repro:** `(mentor-main)/_components/Navbar.tsx` had `// onClick={signOut}` — the menu item did nothing; mentors could not sign out.
- **Fix:** implemented `signOut()` (`supabase.auth.signOut()` → toast → `router.push("/auth-mentor")` + `refresh()`, loading state, error toast instead of silent failure).

### 19. Resume builder: Download / Enhance / Start Now / Generate were dead controls — FIXED — RETESTED
- **Repro:** "Download" had no handler; "Enhance Resume" was a `<div>` styled as a button; `ResumeCard` "Start Now" never navigated; the landing "Generate" button did nothing.
- **Fix:** Download prints the real resume via `window.print()` with an A4 `@media print` block in `globals.css` scoped to `#resume-print-area` (chrome hidden, exact 794px page, no transform); "Enhance Resume" and "Generate" now return honest `toast.info` messages that AI generation/enhancement is not implemented (no fake progress spinners); `ResumeCard` is a client component navigating to `/home/ai-tools/resume-maker/start`; the landing page shows the persisted draft under "Recent Created Resume" with an Open action or an explicit empty state.

### 20. Resume draft lost on every refresh — FIXED — RETESTED
- **Repro:** `useResumeStore` was unpersisted `create()`, so a reload during resume editing wiped the work in progress.
- **Fix:** `persist(..., { name: "mentlio.resume-draft", partialize: s => ({ resume: s.resume }) })`.

### 21. Browser-hostile dead imports crashed the roadmap page module graph — FIXED — RETESTED
- **Repro:** `roadmap-maker/page.tsx` had `import { time } from "console"` and `import { se } from "date-fns/locale"` (IDE auto-imports) — Node built-ins pulled into a client bundle.
- **Fix:** both removed.

### 22. New accounts were created with a 404 avatar — FIXED — RETESTED
- **Repro:** signup assigned `/user${1..5}.png`; only `/user.png` exists, so every new user's avatar (and the peer rail) rendered broken.
- **Fix:** `DEFAULT_AVATAR = "/user.png"` in `api/auth/signup/route.ts` (user and mentor paths); repaired the 23 persisted rows in `data/mentlio.json`.
- **Retest:** `/home` network log — `/_next/image?url=%2Fuser.png` → 200; mentor avatars `/a1/a2/a4.png` → 200.

### 23. Onboarding skipped (or account data leaked) when switching users — FIXED — RETESTED
- **Repro:** `UserDataProvider` kept the previous `user`/`mentor` after a different account signed in, and `/auth/callback` treated a missing `is_verified` as "already onboarded", sending new users straight to `/home`.
- **Fix:** provider clears stale `user`/`mentor` whenever the resolved auth email differs from what is in state; both callback pages gate on `is_verified !== true` (absent ⇒ onboarding) and use `needsOnboarding = is_verified !== true || localStorage flag === "false"`. Removed `console.log(onboardingStatus)` debug output.

## Session 2026-10-24 (functional E2E, filter grammar, AI transport)

### 24. Every chat thread and every `or=` query returned nothing — FIXED — RETESTED
- **Repro:** send a message from a mentor thread → it never appears in "Previous Chats" or the conversation; `GET /api/data/messages?or=(sender_id.eq.<me>,receiver_id.eq.<me>)` → `[]` while `sender_id=eq.<me>` returns the row. Reproduced with `qa_func_*` accounts in `scripts/test-functional.mjs`.
- **Root cause:** `rowMatchesFilters()` split the `or=` value on top-level commas — but the whole value is wrapped in parentheses (`(a,b)`), so `splitTopLevel` yields a **single** token, and `matchOrGroup()` then evaluated that token with `.every()` — an `or=(A,B)` was executed as `AND(A,B)`. Any row missing one side was dropped, so no message ever matched both sides.
- **Fix:** recursive PostgREST logic-tree evaluator `matchLogicGroup(row, raw, mode)` + `stripOuterParens()`; `or=` now ORs, `and=` ANDs, nested `or=(and(A,B),C)` (the exact shape `/home/messages/[type]/[id]` sends) resolves correctly, and `and=` is excluded from the plain-filter list. `buildTargetMatcher()` also accepts `and=`-only PATCH/DELETE targets.
- **Retest:** new Test N in `scripts/test-api-security.mjs` (6 assertions: either-side match, no false positive, `and=` strictness, nested group) → security suite 51/51; functional suite messages section 3/3.

### 25. Every Groq-backed AI feature failed after a 80–115 s hang — FIXED — RETESTED
- **Repro:** `/api/ai/roadmap-gen` → 500 after **114 s**; `/api/ai/qna-generate` → 500; `/api/ai/follow-up` → 500. Server log: `FetchError: Invalid response body while trying to fetch https://api.groq.com/...: Premature close`, `attemptNumber: 6`.
- **Isolation:** raw `fetch` to Groq with the same key/model returns 200 in 0.4–1.1 s, while `new ChatGroq(...).invoke()` fails identically in 80 s in this runtime → the defect is `@langchain/groq` 0.2.4's transport, not the key, model, prompt or parser.
- **Fix:** new `src/lib/ai/groq.ts` — a server-side OpenAI-compatible client with a wall-clock `AbortController` timeout, **bounded** attempts (default 2, honouring `Retry-After`, capped 5 s backoff), and typed `LlmError` codes (`LLM_UNCONFIGURED` 503, `LLM_KEY_INVALID` 503, `LLM_RATE_LIMITED` 429, `LLM_UPSTREAM_ERROR` 503, `LLM_BAD_REQUEST` 502, `LLM_TIMEOUT` 504, `LLM_EMPTY_RESPONSE`/`LLM_MALFORMED` 502). Prompts, zod schemas and `StructuredOutputParser` usage are unchanged; only the transport was swapped in roadmap-gen, qna-generate, follow-up, generate-checkpoint, quiz-feedback, feedback and `MockTest/QuestionPipeline`. 4xx responses are no longer retried (previously the SDK retried up to 6 times), and the "fallback" paths no longer issue a **second** paid LLM call — they now re-parse the response already in hand.
- **Also fixed with it:** `/api/ai/follow-up` returned `{followUps: []}` at HTTP 500 and a bare `{}` at 200 when the key was missing — i.e. it masked failures as success. It now keeps the `followUps` key the UI reads but reports `error` + `code` with the true status. Missing-key branches across the AI routes returned 500; they are 503 `LLM_UNCONFIGURED` now.
- **Retest:** `node scripts/test-llm.mjs` → roadmap 200, qna 200, career-coach 200 with reply, embed honest 503, anonymous 401; follow-up reported **BLOCKED(ENV)** on a real Groq 429 (previously a false 500). Direct probe: roadmap 114 s/500 → **2.9 s/200**.

### 26. Invalid default model ids — FIXED — RETESTED
- **Repro:** `QuestionPipeline` defaulted to `llama-3.1-8b-instant` and `career-coach` to `llama-3.3-70b-versatile`; both return `404 model_not_found` for this account (verified by probe), so mock-test generation and the Groq coaching fallback could never succeed.
- **Fix:** both default to `openai/gpt-oss-120b` (probed 200), still overridable by `GROQ_MODEL`; career-coach fallback now routes through the same bounded `groqComplete()` and degrades to Gemini instead of hanging. Mock-test request budget: 2 attempts × 30 s (was 15 s, which truncated valid 20-question answers).

### 27. Committed secret fragment + browser-inlined provider secrets — FIXED — RETESTED
- **Repro:** `career-coach/route.ts` hard-coded part of a live-looking Gemini key (`AIzaSyBw-xO7zJgJzKkSj4jE6s8r6nC2tZ8w8`) into source as an "is this key dummy?" check. `.env.local` still exposed `NEXT_PUBLIC_ZEGO_SERVER_SECRET` (a *server* secret) plus duplicate `NEXT_PUBLIC_GEMINI/TAVILY_API_KEY` and `NEXT_PUBLIC_YOUTUBE_API_KEY`, all of which Next.js inlines into the client bundle.
- **Fix:** the key-prefix test replaced with a shape check (`length >= 20`, no "dummy"); env vars renamed to their server-only forms (`ZEGO_SERVER_SECRET`, `YOUTUBE_API_KEY`) and the duplicate public copies deleted (values untouched — the server-side names already held them). `room/[roomid]` already takes its Zego token from `/api/zego/token`, so nothing client-side needed the secret.
- **Retest:** no `NEXT_PUBLIC_*(SECRET|PRIVATE|TOKEN|API_KEY)` variable remains in `.env.local`; `/api/zego/token` still returns 401/503 codes rather than a client-side secret.

### 28. Onboarding step 4 mislabelled + "Complete SetUp" typo — FIXED — RETESTED
- **Repro:** the a11y region for step 4 announced "Connect Google Calendar" while the step asks "Where did you find Mentlio?", and the submit button read "Complete SetUp".
- **Fix:** `aria-label="Referral source"` and "Complete Setup" in `auth/_components/OnBoardingCard.tsx`.

## Session 2026-10-24 (continued): career personalization, mock tests, mentor bookings, navigation

### 29. `selectedCareer` was never written — the whole personalization chain was unreachable — FIXED — RETESTED
- **Repro (high severity):** finish the quiz, open the AI career coach, pick a suggested career → nothing is saved. `/home/career-board` stays on "You Haven't Selected a Career Yet!" forever, profile shows "Not Selected", jobs/courses/videos/peer lists never load, and the selected-career card is always empty.
- **Root cause:** the career coach listed `quizInfo.careerOptions` as inert `<p>` elements and had no write path. `getSelectedCareer` / `insertSelectedCareer` / `updateSelectedCareer` existed in `dbActions.ts` but **were never called** by any component; the only `userQuizData` writes in the app were the quiz inserts.
- **Fix:** new `setSelectedCareer(userId, selectedCareer)` in `dbActions.ts` (PATCH `userQuizData?userId=eq.<id>`, returns `false` if zero rows matched so the UI cannot claim success without persisting). `career-coach/page.tsx` now renders each suggestion as a `<button aria-pressed>` that saves the choice, calls `refreshQuizData()`, shows a "Saving…" state and an honest error toast on failure; a new "Choose your career" dialog (wired to the previously dead "Find Now" button) exposes the same list at any time. The placeholder "5 searchs -" was replaced with the real current career.
- **Retest (browser, QA student `qa_func_stu_a`):** completed the 6-question quiz → summary → Confirm & Continue; career dialog listed the 5 AI suggestions; clicking "Data Scientist / Data Analyst" produced the toast and `aria-pressed="true"`; `data/mentlio.json` recorded `selectedCareer` on the quiz row; `/home/career-board` then rendered the stats card with that career and the full insights/jobs sections.

### 30. Quiz history was read without ordering, so consumers loaded an old attempt — FIXED — RETESTED
- **Repro:** a student who retakes the quiz keeps both rows; `getUserQuizData()` had no `order`, while `career-coach` and `IndustryCharts` read `data[0]`. They picked the stale row (no `quizInfo`) → "No career suggestions yet" and an empty salary chart even though the newest quiz had options.
- **Fix:** `getUserQuizData()` now orders `created_at` descending, so `data[0]` is always the latest attempt.
- **Retest:** after the fix the career dialog listed all 5 options for the same account that previously showed none.

### 31. Career-board hero CTAs "Learn More" / "Check Out" were dead — FIXED — RETESTED
- **Repro:** click either button → URL and scroll unchanged.
- **Fix:** `IndustrySingleCard` now takes an `onAction(cardId)` prop (plus `aria-label`s); `career-board/page.tsx` scrolls to the `#industry-insights` section when the account is unlocked, otherwise routes to `/start-quiz`; "Check Out" (career fit) routes to the assessment.
- **Retest:** with an unlocked account, "Learn More" scrolls the content container so `#industry-insights` sits at the viewport top; the locked-account path navigates to `/start-quiz`.

### 32. Career-board stat cards presented hardcoded figures as personalized data — FIXED (disclosed)
- **Repro:** "Industry Growth 12.5%", "Demand Level High" and a fixed Python/ML/SQL skill list render identically for every career; there is no growth/demand data source in the database.
- **Fix:** kept the cards (design intent) and added an explicit line under the grid: "Growth, demand, and skill benchmarks are general industry figures, not personalized to your selected career yet." The salary chart already refuses to show invented numbers and explains the missing `SERPAPI_KEY`.

### 33. Missing job/course/video providers were reported as "nothing found" — FIXED — RETESTED
- **Repro:** with no SERP/YouTube key the APIs return 503 `SEARCH_PROVIDER_UNCONFIGURED`; `industryJobs`, `CourseData` dropped the message into `console.error` and the UI said "No jobs found for …" / "No videos match the criteria", implying an empty result set. Worse, `CourseData` returned early on `!courses.length`, so the whole **Resources tab rendered "No courses found." and the YouTube sub-tab was unreachable**.
- **Fix:** all three fetchers check `res.ok` and surface the server's message ("Job search is not configured on this server.", "Course search is not configured on this server.", "YouTube search is not configured."); the early return is gone and each list has its own empty/error state.
- **Retest (browser):** Jobs tab shows the server message; Resources tab now opens and shows the course message; its YouTube Videos sub-tab shows the YouTube message.

### 34. Dead like/track affordances in job results — FIXED — RETESTED
- **Repro:** the "Liked Jobs" header button and the heart on each job card had no handler (no liked-jobs feature exists).
- **Fix:** the header button is now "Tracked Jobs" → `/home/job-tracker`; the card heart opens the existing "Track this Job" dialog (keyboard accessible, `role="button"`, `aria-label`).

### 35. Public landing page navigation was inert — FIXED — RETESTED
- **Repro:** "Services", "About us", "Pricing" and "Reach us" all pointed to `/web`, so every click just reloaded the page; there is no contact channel behind "Reach us".
- **Fix:** added `id="services"` / `id="about"` sections and pointed the two matching links at `/web#services` / `/web#about`; "Pricing" now opens the real plans at `/home/settings/billing`; the "Reach us" item was removed (no destination exists). Removed the unused `Button`/`SmoothCursor` imports from `web/page.tsx`.
- **Retest:** clicking "Services" navigates to `/web#services` and the section lands at the top of the viewport.

### 36. `/email-verified` CTA pointed at the loader page — FIXED
- **Repro:** "Go to Login" linked to `/`, which re-runs the session-check splash; copy read "You can now Go back and log in or click the button below."
- **Fix:** links to `/auth` directly; copy rewritten.

### 37. Paid-plans page still contained template leftovers — FIXED — RETESTED
- **Repro:** `/home/settings/billing` listed "Combine Files Mercurius", "Health care included", "Acess to More advance Features", an **Enterprise** column that does not exist, and "2K+ Worth Joining Bonus" / "2K+ Welcome Bonus" with no explanation (signup actually grants 10 credits). "100 Credits/ Month" also implies a recurring monthly grant that the payment flow does not perform.
- **Fix:** `Pfeature.tsx` now compares the two real plans (Free / Pro) over real capabilities; Pro copy lists the features that actually ship (career coach, roadmap, tracks + mock tests, resume print/export) and "100 credits with your plan"; Free shows "10 Free Credits Included" / "10 free credits on signup".
- **Retest (browser):** table headers are exactly `Features | Free Plan | Pro Plan`; the page contains no leftover template strings.

### 38. Mock-test outcomes were never persisted, so checkpoints could never unlock — FIXED — RETESTED
- **Repro:** pass a mock test with ≥60% → the next checkpoint stayed "Locked", the achievement never unlocked, and `roadmapUsers.progress` stayed 0. `isMockDone` was read by the start page but **written nowhere**.
- **Fix:** the results page now computes the percentage on mount, then writes `tracks.checkpoints[<order-1>].isMockDone = true` and the new `roadmapUsers.progress` (50% per checkpoint) via `recordCheckpointResult()`, shows a pass/fail banner ("Checkpoint passed (60% rule met)"), and reports the real elapsed time instead of the previous "0m 0s".
- **Retest:** 5/10 run → no unlock, "Not passed yet" banner; 6/10 run → `isMockDone: true`, `progress: 50`, Checkpoint 2 flipped from Locked to Available with an enabled Take Test button.

### 39. Leaving the results page destroyed the results (`beforeunload` called `reset()`) — FIXED — RETESTED
- **Repro:** open results, navigate away or refresh → quiz store reset and the page rendered blank; Chrome fires `beforeunload` even when the user chooses to stay, so simply cancelling the dialog wiped the data.
- **Fix:** the handler only calls `preventDefault()`; the store is no longer reset there. Empty state replaced `return null` with an honest card ("No completed test to show…") and a "Back to my track" button.

### 40. Mock test auto-advanced through questions the student never saw — FIXED — RETESTED
- **Repro:** start the test and stay on the instructions screen → questions auto-skip in batches; during the test several questions expired at once.
- **Fix:** the countdown only runs when `startTime` is set and not auto-advancing, and `handleAutoAdvance()` was moved out of the `setQuestionTimer` updater (calling it from inside the updater re-ran it and skipped multiple questions).
- **Retest:** idling 40 s on the instructions screen produced zero advances; a full 10-question run showed every question in order.

### 41. Locked checkpoints were reachable with the keyboard — FIXED — RETESTED
- **Repro:** a locked checkpoint's expand/quiz triggers were only visually/non-interactively blocked (`pointer-events-none`), so Tab + Enter opened the test.
- **Fix:** both the accordion trigger and "Take Test" now use `disabled={!isUnlocked}` plus `aria-expanded`/`aria-label`.
- **Retest:** accelerator snapshot shows `disableable disabled` on checkpoint 2 and a single enabled Take Test button.

### 42. "My bookings" was always empty — FIXED — RETESTED
- **Repro:** a student with 4 bookings saw an empty list. The fetch effect used `[]` deps and read `user?.id` before the async user context resolved, so it queried `student_id = undefined`.
- **Fix:** effect depends on `user?.id` (realtime subscription stays on `[]`); the dead "Back" `<p>` became a working button.
- **Retest:** "Total Sessions Found : 4".

### 43. Sessions could be booked in the past — FIXED — RETESTED
- **Repro:** the time picker defaults to "now", so a booking placed at 23:16 was saved with `scheduled_at` 23:10 — a slot no mentor can join.
- **Fix:** reject start times within one minute of `Date.now()` with a clear toast; dialog stays open.
- **Retest:** past slot rejected; a future 09:00 slot booked successfully.

### 44. Bookings reported success when credits could not be debited — FIXED — RETESTED
- **Fix:** the credit update error path now closes the dialog and warns ("The session was requested, but your credits could not be updated. Contact support before booking again.") instead of toasting success.

### 45. Smaller correctness / a11y / copy fixes — FIXED — RETESTED
- `/home` claimed **"Quiz Complete!"** for everyone (`step` was hardcoded to 1); it now reflects `user.isQuizDone` and shows honest copy for both states.
- Job-tracker header: "Career Board" now navigates, "Add" opens the dialog, the no-op "Filter" button (and its import) was removed.
- Messages: message `<Input>` and send `<Button>` now have `aria-label`s (they had no accessible name).
- Billing "Flexibile Pricing" → "Flexible"; mentor "Current Ocupation" → "Current Occupation"; roadmap "personlaised" → "personalised".
- `imagekit-upload.ts` type error (`Property 'message' does not exist`) fixed by widening the parsed response type — `tsc --noEmit` is clean again.
- Removed genuinely unused imports/helpers encountered along the way (career-board `useEffect/useState/createClient/getUserQuizData/CoursesList`, web page `Button/SmoothCursor`, the three dead `*SelectedCareer` helpers).

### 46. Selected career disappeared after a retake — FIXED — RETESTED
- **Repro:** after the functional suite inserted a newer `userQuizData` row that had `answers`/`score` but no `selectedCareer`, `/home/career-board` re-gated to "You Haven't Selected a Career Yet!" and jobs/mentor matching lost the career.
- **Fix:** `getUserQuizData()` orders by `created_at` descending and backfills `selectedCareer` from the newest row that has one, and `QuizDataProvider` now reads through that accessor instead of issuing its own `limit(1).single()` query.
- **Retest:** signed in as the QA student → career board renders "Selected Career — Data Scientist / Data Analyst" with the industry panels; `npx tsc --noEmit` clean; production build succeeds.

### 47. Functional suite leaked its own fixtures — FIXED — RETESTED
- **Repro:** `scripts/test-functional.mjs` deleted the booking/message/job/calendar rows it created but left `userQuizData`, `roadmapUsers` and `notification` behind. The leaked quiz row was the direct cause of #46.
- **Fix:** all inserted rows are now captured and deleted in cleanup (the notification with the mentor's cookie, since it belongs to the mentor). `test:functional` is also wired into `npm test`.
- **Retest:** `npm run test:functional` → 43/43 PASS, including seven `cleanup …` checks.

### 48. Mentor & video-call surfaces verified — FIXED — RETESTED (no code change needed)
- Mentor `/dashboard/sessions`: Pending / Confirmed / Ongoing tabs render, accept/reject are owner-scoped through the data API, empty states are honest.
- `/room/[roomid]`: shows "Video calling is not configured on this server…" instead of a broken stage when Zego is unset; `/api/zego/token` returns 401 anonymous and 503 `ZEGO_SECRET_MISSING` authenticated, and the token is signed server-side (secret never in the bundle).
- `/home/settings` → `/home/settings/billing` redirect verified.

### 49. Login revealed which emails have accounts — FIXED — RETESTED
- **Repro:** `POST /api/auth/login` returned "Invalid login credentials. User not found." for an unknown email and "Incorrect password." for a known one, so an attacker could enumerate registered users. The 500 path also echoed `err.message`.
- **Fix:** every credential failure now returns the same `401 {"error":"Invalid email or password."}`; a dummy scrypt verification runs when the account is missing so response timing does not leak either; unexpected errors return a generic 500 message and only log server-side.
- **Retest:** known email and unknown email → identical body and 401; timings 0.113 s vs 0.117 s; `npm run test:auth` still 24/24.

### 50. Final copy accuracy — FIXED — RETESTED
- Home quick-action card read "personalized path.." (double period); the Discord OAuth 501 message named `DISCORD_SECRET` while the route actually reads `DISCORD_CLIENT_SECRET`, which would misdirect a deployment.
- **Retest:** targeted eslint 0 errors, `tsc --noEmit` clean, production build exit 0.

### 51. Colleges endpoint masked a missing provider key as a 500 — FIXED — RETESTED
- **Repro:** `GET /api/colleges?search=indian` returned HTTP 500 with a bare `[]` body because `SERPAPI_KEY` is a placeholder and SerpApi threw `Invalid API key`.
- **Fix:** the route now rejects a missing/placeholder key before calling the provider with `503 SEARCH_PROVIDER_UNCONFIGURED`, maps a rejected key to `503 SEARCH_PROVIDER_INVALID_KEY`, and returns a JSON error (not an empty array) for genuine failures.
- **Retest:** local endpoint → 503 `SEARCH_PROVIDER_UNCONFIGURED`; `npx tsc --noEmit` clean.

### 52. Anonymous callers could scrape mentor email addresses — FIXED — RETESTED
- **Repro:** `GET /api/data/mentors?select=*` without a session returned rows containing `email` (the old live build also returned `phone`). The directory is public so any scraper could harvest all mentor addresses.
- **Fix:** public reads still redact `phone`; `email` is now removed from responses without a session, while signed-in students keep it on the mentor detail page where it is displayed.
- **Retest:** anonymous → no `phone`/`email`; authenticated student → `email` present; security suite 51/51 and functional suite 43/43 pass against the production build.

### 53. Login failed in the browser with "Auth session or user missing" — FIXED — RETESTED
- **Repro (live build):** valid email/password returned HTTP 200 from `POST /api/auth/login`, but the login page surfaced `Auth session or user missing`. The deployed client shim merged the backend payload with `access_token` only; `@supabase/auth-js` rejects a password-grant response without `refresh_token` (`AuthInvalidTokenResponseError`).
- **Fix:** `sessionPayload()` in `src/lib/supabase/client.ts` now returns a complete GoTrue session (`access_token`, `refresh_token`, `expires_in`, `expires_at`, `token_type`, `user`) for signup and password grants, and resolves refresh grants from the session cookie. This was already on `main`; the live build predates it.
- **Retest:** production build + real UI login → lands on `/auth/callback`; API suite 24/24.

### 54. Production build required a manually configured SESSION_SECRET — FIXED (self-provisioning)
- **Repro:** `SESSION_SECRET= npm run build` compiled, then threw `SESSION_SECRET is missing or shorter than 32 characters` while collecting `/api/auth/signup` page data. Every Vercel deploy since `b8ccdbc` failed for this reason, keeping the broken login build live.
- **Fix:** `next.config.ts` provisions the secret before compilation (Vercel may invoke `next build` directly), and `scripts/generate-session-secret.mjs` does the same on `postinstall`, `predev` and `prebuild`. If `SESSION_SECRET` is absent it writes a 96-hex-character random secret to `src/lib/auth/session-secret.generated.ts`; the file is gitignored and listed in `.vercelignore`. A configured `SESSION_SECRET` always takes precedence; the public dev fallback is still unreachable in production.
- **Trade-off:** until a stable `SESSION_SECRET` is configured, each deployment ships a new secret, so existing sessions require signing in again.
- **Retest:** deleted the generated file, ran `SESSION_SECRET= npm run build` → exit 0 and all 68 pages generated.

### Production deployment finding (2026-10-24) — BLOCKED on Vercel environment
- The live site is still the 2026-10-22 deployment. Pushes of `b8ccdbc` (`dpl_F934uwxuU23fvs1VHqRtKn6qysGT`) and `472d5a8` (`dpl_7Tp9R8SH3xSCuvvE1SSN6NDU4jSw`) both produced failed Vercel deployments because production now fails closed when `SESSION_SECRET` is absent/short. The previous build escaped this by signing sessions with a secret hardcoded in a public repository.
- **Root cause reproduced locally** by running the production build with an empty secret: it compiles, then dies while collecting page data with `Error: SESSION_SECRET is missing or shorter than 32 characters ... Failed to collect page data for /api/auth/signup`. Local builds pass only because `.env.local` supplies the value.
- Local verification of the live site shows the old build's defects: anonymous `POST /api/data/users` succeeds, anonymous `POST /api/ai/roadmap-gen` returns 200, login leaks "User not found.", the public mentor directory exposes `phone` and `email`, and the security headers are missing. All of these are already fixed in the current commit; redeploying requires `SESSION_SECRET` to be set in Vercel.
- Live re-probe after `472d5a8` (2026-10-24): `/api/colleges` still returns `500 []`, unknown-email login still returns `"User not found."`, and the response carries only HSTS — confirming the old build is still serving.

## Known limitations / BLOCKED
- **DB persistence on Vercel:** file-based JSON at `/tmp/mentlio.json` is ephemeral per deployment — BLOCKED on external persistent DB (Postgres/Supabase). Exact requirement documented in final audit.
- **Live LLM keys:** Groq is live and now serves roadmap-gen, qna-generate, generate-checkpoint, quiz-feedback, feedback and the mock-test pipeline (429 rate limit is the only remaining failure, reported honestly as `LLM_RATE_LIMITED`); Gemini key is revoked → career-coach answers through the Groq fallback; Pinecone/Vapi/Razorpay/SerpApi placeholders → 503. Never simulated success.
- **OAuth with real providers:** flow built and state-secured; end-to-end login BLOCKED on real Google/Discord/Slack credentials.
- **Lint:** full-repo eslint OOMs in this environment (baseline limitation); targeted lint only.
- **Voice AI (Vapi) and interview-prep room:** the UI is present but there is no configured Vapi/Zego account, so a real voice session is BLOCKED. The "Talk Now" CTA was pointed at `/home/interview-prep` (a real page) rather than leaving a dead button.
- **YouTube / job / course / salary providers:** all four return 503 with explicit codes; every surface now shows that message instead of an empty-result claim. BLOCKED on keys.
- **Mentor-side notifications:** notification rows are written for bookings/messages, but only the student sidebar has a bell; the mentor bell just links to `/dashboard`, and the mentor shell (`(mentor-main)`) has no notification list. NOT IMPLEMENTED (logged, not built in this pass).
- **Mentor session history:** the "Ongoing Session" tab is a placeholder ("Here you'll see all completed sessions."), and the "Confirmed Request" tab lists accepted sessions only — a rejected request disappears from the mentor's view even though the student sees it under the Rejected filter. NOT IMPLEMENTED for completed history; rejected-visibility is a cosmetic gap, no data is lost.
- **Realtime is a no-op** with the JSON data layer, so mentor request lists and bookings only refresh on mount; after accepting/rejecting the lists update locally. A page reload is needed to see changes made in another tab.
- **Booking status filters:** the Student/Pending/Completed toggles work but do not expose `aria-pressed`; visually they are fine, screen-reader state is missing. Minor, open.
- **Career-board benchmarks:** growth/demand/skill figures remain static values (now explicitly labelled as general industry figures). A per-career data source does not exist. NOT IMPLEMENTED.
- **Quiz rows are duplicated on every attempt** (one row per submit) and consumers rely on the newest row; ordering is now enforced centrally, but a cleanup/dedupe job is still advisable.
- **Local QA hook:** a SessionStart/PostToolUse hook in this environment reports a blocked cross-project `MEMORY.md` path on every edit although the edits succeed — environment noise, not an application defect.
