# MENTLIO — Feature Inventory

Generated 2026-10-23 from source inspection; statuses re-verified 2026-10-24 (Next.js 16.1.1 App Router, React 19, custom session auth + Supabase-shaped file DB proxy).

Status legend — **PASS** (exercised and behaving correctly), **FAIL** (reachable and broken), **FIXED — RETESTED** (was broken, fixed and re-verified), **BLOCKED** (cannot be exercised without an external credential/resource; failure is reported honestly), **NOT IMPLEMENTED** (feature does not exist in code), **NOT TESTED** (exists, not exercised).

## 1. Architecture in one page

| Layer | Implementation |
|---|---|
| Framework | Next.js 16.1.1 App Router, Turbopack dev, React 19, TypeScript (typecheck clean) |
| Styling | Tailwind v4 + radix-ui primitives, sonner toasts, custom fonts (raleway/inter) |
| Auth | Custom HMAC-SHA256 signed token in httpOnly cookie `mentlio_session`; scrypt password hashing; `getServerSession()` per route; SameSite=Lax, Secure in production |
| Auth surface | Supabase **browser client with a custom `fetch` interceptor** (`src/lib/supabase/client.ts`) — `/auth/v1/*` → `/api/auth/*`, `/rest/v1/{table}` → `/api/data/{table}`, realtime degraded to no-op |
| Persistence | File JSON "database" `src/lib/auth/db.ts` → `data/mentlio.json` locally, `/tmp/mentlio.json` on Vercel (ephemeral) |
| State | `UserDataProvider`, `QuizDataProvider`, `InterviewProvider` + zustand stores (Notification, Razorpay, Session, Resume, AssistantSheet) |
| Guarding | Client-side `RoleGuard` / `StudentAuthGate`; **no `middleware.ts`** — route protection is per-API-route + client gates |
| Roles | `user` (student), `mentor`, `admin` — carried in the signed token / `user_metadata.role`, not as a `users` column |

## 2. Public / auth surface

| Route | Purpose | Status |
|---|---|---|
| `/` | Session splash, redirects by role | FIXED — RETESTED (redirects to `/auth` when anonymous) |
| `/auth` | Student email+password login/signup, Google/Discord/Slack buttons | PASS (local email flow, 24/24 auth tests) / BLOCKED (live OAuth — placeholder provider creds) |
| `/auth/callback` | Student post-login landing + onboarding | FIXED — RETESTED (full onboarding persisted) |
| `/auth-mentor` | Mentor login/signup | PASS (local email flow) |
| `/auth-mentor/callback` | Mentor landing + mentor onboarding | FIXED — RETESTED |
| `/email-verified` | Email-verification landing | NOT IMPLEMENTED (no verification e-mail is sent; signup returns a session directly) |
| `/unauthorized` | Role-mismatch landing | PASS |
| `/start-quiz` | Diagnostic quiz entry | PASS (10-question run, score, save) |
| `/web` | Marketing/landing page | PASS (nav anchors `#services`/`#about`, pricing link) |
| `/room/[roomid]` | Video room (game-server token) | BLOCKED (Zego placeholder; page shows the 503 reason instead of a broken stage; token route requires login) |

## 3. Student app — `(main)` group under `/home`

| Route | Features | Status |
|---|---|---|
| `/home` | Greeting, career line, notification bell, quick actions, recommended mentors, resume card | FIXED — RETESTED (all requests 200/304) |
| `/home/profile` | Name/avatar/status/institution edit, invite link, chosen career + suggested options | PASS (form loads and is populated; saving edits not exercised in this pass) |
| `/home/calendar` | Agenda, manual events, Google Calendar connect/sync | PASS (agenda renders; event persistence verified via API) / Google sync BLOCKED (placeholder OAuth client) |
| `/home/career-board` | Career insights board, hero CTAs, industry charts | FIXED — RETESTED (career persists across retakes; Learn More scrolls to `#industry-insights`) |
| `/home/job-tracker` | Kanban (dnd-kit), add job, AI interview-prep entry, persisted `job_tracker` | PASS (persisted job renders; drag reorder not re-exercised) |
| `/home/interview-prep` + `/start` | Mock interviews, qna-generate, feedback, proctoring | PASS (history/empty states) / voice room BLOCKED (Vapi placeholder) |
| `/home/mentor-connect` | Mentor directory, career filter, pagination | PASS (12 mentors fetched; "0 exact matches" is literal `current_position` equality) |
| `/home/mentor-connect/[id]` | Profile detail + booking | PASS (booking created and persisted) |
| `/home/mentor-connect/bookings` | Session list, status filters, join link | FIXED — RETESTED ("Total Sessions Found : 4"; filters work; join only when mentor has started the call) |
| `/home/messages` + `/[type]/[id]` | Thread list + conversation, `messages` table | PASS (existing thread renders; read scoping tested) / realtime is a no-op with the JSON store |
| `/home/my-tracks` | Track carousel, course + YouTube resources, mock tests, results | PASS (persisted 50% progress, unlocked checkpoint) |
| `/home/ai-tools/career-coach` | Chat, career selection, quick actions | FIXED — RETESTED (career selection persists and unlocks the board) / chat PASS via Groq fallback (Gemini key revoked) |
| `/home/ai-tools/roadmap-maker` | Roadmap generation → `roadmapUsers` | PASS (live 200 from `/api/ai/roadmap-gen`) |
| `/home/ai-tools/resume-maker` | Landing + persisted draft | FIXED — RETESTED |
| `/home/ai-tools/resume-maker/start` | Multi-section editor, preview, print/export | FIXED — RETESTED |
| `/home/settings` | Redirect → `/home/settings/billing` | NOT IMPLEMENTED (no settings UI) |
| `/home/settings/billing` | Razorpay order/checkout, plans, top-ups, history | PASS (UI + empty states; template leftovers removed) / live payment BLOCKED (placeholder Razorpay keys; not attempted by design) |

## 4. Mentor app — `(mentor-main)` group under `/dashboard`

| Route | Features | Status |
|---|---|---|
| `/dashboard` | KPI cards, meeting chart, calendar, message rail, session tabs | PASS (honest empty states) |
| `/dashboard/sessions` | Pending / Confirmed / Ongoing tabs, accept/reject | PASS (tabs render; accept/reject owner-scoped and covered by tests) / completed-history tab NOT IMPLEMENTED |
| `/dashboard/calender` | Mentor agenda (route name misspelled) | PASS (renders month view + honest empty state) |
| `/dashboard/upload` | Intro video upload to image host + save to profile | PASS (page renders) / BLOCKED (ImageKit key is a placeholder, upload fails with a real error) |
| `/dashboard/profile` | Avatar upload only | Avatar PASS (UI) / BLOCKED (ImageKit placeholder); text profile editing NOT IMPLEMENTED |
| `/dashboard/video-call-Home` | Session start screen, notes, chat link | NOT IMPLEMENTED end-to-end (requires the Zego secret; room itself BLOCKED) |
| Mentor Navbar | Search, notifications link, logout | FIXED — RETESTED (logout was dead; bell links to `/dashboard`) |

## 5. API routes (33)

Auth-required (all call `getServerSession()` and were probed): `/api/data/[table]`, `/api/ai/*` (career-coach, follow-up, qna-generate, roadmap-gen, quiz-feedback, generate-checkpoint, mocktest/generate-questions, mocktest/security), `/api/feedback`, `/api/tavily`, `/api/vector/upload` (+role), `/api/gcp-upload`, `/api/upload-auth`, `/api/google/{connect,callback,sync}`, `/api/razorpay/*`, `/api/youtube/search`, `/api/courses`, `/api/jobs`, `/api/zego/token`.

Intentionally public: `/api/auth/login`, `/api/auth/signup`, `/api/auth/logout`, `/api/auth/oauth/*` (+3 provider callbacks), `/api/colleges` (lookup only).

Contract behaviours worth remembering: insert bodies are arrays; `.single()` sets `Accept: application/vnd.pgrst.object+json` and does not unwrap; filters ride as `?col=eq.val`, `col=in.(…)`, `or=(…)`; `select`/`columns` are transport params, never row filters; PATCH/DELETE refuse unfiltered writes and non-owned rows.

## 6. Data tables

`users` (key: `userEmail`), `mentors` (key: `email`), `userQuizData`, `others`, `notification`, `colleges`, `tracks`, `mentor_sessions`, `orders`, `payments`, `messages`, `job_tracker`, `userCalendar`, `roadmapUsers`, `proctor_events`.

## 7. Known gaps (not bugs — absent functionality)

- Realtime is a no-op with the JSON store: new messages/requests appear after reload or refetch.
- `settings` page is a redirect only — no preferences, password change or account deletion UI.
- Mentor notifications have no list surface; the bell only navigates to `/dashboard`.
- Mentor "Ongoing Session" tab is a placeholder; rejected requests are not listed for the mentor.
- Referral-source onboarding answer is collected in the DOM but never persisted.
- AI resume enhancement, cover letters, session-note generation and video calling have UI affordances but no backing implementation (Zego/Vapi placeholders).
- No `middleware.ts`: page-level protection relies on client guards; API routes are the authoritative boundary.
- Persistent DB on Vercel: `/tmp` JSON is wiped on each deploy/cold start — needs external Postgres/Supabase.
- Credits are displayed but not debited server-side; AI routes are auth-gated without per-user quotas.
