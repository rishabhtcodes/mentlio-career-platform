# MENTLIO — Final Audit

Date: 2026-10-24
Scope: full application audit, repair and verification of `mentlio-career-platform` (Next.js 16.1.1, React 19).
Companion documents: `MENTLIO_FEATURE_INVENTORY.md`, `MENTLIO_BUG_FIX_LOG.md`, `MENTLIO_TEST_RESULTS.md`.

---

## 1. Verdict

The application is **functionally healthy in the local environment and buildable for production**. Every reproducible application bug found in this pass was fixed and retested; the automated suites are fully green (24 auth, 51 API-security, 43 functional, 8 LLM with 1 provider-quota block).

It is **not yet safe to treat as a durable production service** for three independent reasons, all of which are infrastructure/feature work rather than broken code:

1. **Persistence is ephemeral.** The "database" is a JSON file under `/tmp` on Vercel and is wiped on every deploy/cold start. Real user accounts, quiz results, bookings and payments would be lost.
2. **No abuse controls.** Login, signup and every AI endpoint are unthrottled, and the credit system is display-only, so provider spend is uncapped per signed-in account.
3. **Provider-dependent features are honest but unavailable** (OAuth, payments, video, voice, jobs/courses/salary, vector search) because their credentials are placeholders.

Nothing was deployed. No live payments, destructive production tests, or real-user record deletions were performed.

---

## 2. Scorecard

| Phase | Result |
|---|---|
| 1. Repository baseline | PASS |
| 2. Feature inventory | PASS — `MENTLIO_FEATURE_INVENTORY.md` |
| 3. Browser interaction on every surface | PASS — 38 routes swept; results in test results §3 |
| 4. Auth methods + role authorization | PASS for email auth and roles; OAuth BLOCKED on credentials |
| 5. AI/LLM features | PASS except provider-quota and missing vector credentials (reported honestly) |
| 6. Database/persistence | PASS locally; production durability BLOCKED |
| 7. Fixes | 49 numbered findings; fixed items retested |
| 8. Tests / typecheck / lint / build | PASS (typecheck, 126 automated checks, build); full-repo lint BLOCKED by environment OOM |
| 9. Security / performance / usability | Completed; residual risks below |
| 10. Final verification + docs | PASS locally; live production NOT TESTED (not deployed) |

---

## 3. Security audit

### 3.1 Controls that are correct

| Control | Evidence |
|---|---|
| Session integrity | HMAC-SHA256 over a base64url payload, compared with `crypto.timingSafeEqual`; expiry checked server-side |
| Session storage | `httpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/`, 72 h max-age |
| Secret fail-closed | Production signs with `SESSION_SECRET` when set, otherwise with a high-entropy secret generated at build time (gitignored, never the public dev fallback) |
| Password storage | Node `scrypt`, 16-byte random salt, 64-byte derived key, timing-safe verification |
| Password-less rows | Seeded/directory rows without a hash cannot authenticate |
| Credential errors | Uniform 401 for unknown email, bad password and missing hash; dummy scrypt work equalizes timing; 500s no longer echo internals |
| Authorization | Every non-public route calls `getServerSession()`; the data API enforces owner scoping on read, patch and delete; unfiltered mutations are refused |
| IDOR | 51 API-security checks cover cross-user reads, writes, deletes, mentor inbox, vectors and logical filter groups |
| Secret separation | All provider secrets are read server-side; the Zego token is signed server-side; no key appears in a client component or report |
| Security headers | `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy: frame-ancestors 'self'`, `Referrer-Policy`, `Permissions-Policy`, HSTS; `X-Powered-By` removed |
| XSS | React escaping throughout; only constant chart CSS uses `dangerouslySetInnerHTML`; no `eval` / `new Function` |
| Payments | Server-side Razorpay order creation + signature verification; direct client writes to `orders`/`payments` are refused |

### 3.2 Residual risks (open)

| # | Finding | Severity | Status / required fix |
|---|---|---|---|
| S1 | Ephemeral JSON store on `/tmp`; whole-file reads/writes, no transactions, single-process assumptions | **Critical** (data loss, integrity) | BLOCKED on infrastructure. Migrate `src/lib/auth/db.ts` to Postgres/Supabase and keep `/api/data` as the only access path |
| S2 | No rate limiting or lockout on login/signup; no per-user quota on AI routes | **High** (brute force, cost abuse) | NOT IMPLEMENTED. Add Upstash/Redis sliding windows (the env names already exist) or a Postgres counter; enforce at the route level |
| S3 | Credits are display-only; AI endpoints never debit them | **High** (unbounded provider spend) | NOT IMPLEMENTED. Debit server-side inside each AI route with an atomic check-and-decrement before the provider call |
| S4 | Email verification is not enforced; signup issues a session immediately | Medium | NOT IMPLEMENTED. Send a verification token and gate paid/AI actions until `is_verified` |
| S5 | hCaptcha is commented out and there is no server-side verification | Medium | NOT IMPLEMENTED. Requires `HCAPTCHA_SECRET` and verification in `/api/auth/signup` + login |
| S6 | Any signed-in user may insert a `notification` row for another user (`OPEN_INSERT_TABLES`) | Medium (spam/annoyance) | OPEN. Scope inserts to a booking/message that involves both parties, or move notification creation server-side into the booking endpoint |
| S7 | Stateless sessions cannot be revoked before expiry; logout only clears the cookie | Low–Medium | OPEN. Add a session version / token revocation list if immediate logout everywhere is required |
| S8 | No `middleware.ts`; page access relies on client gates, API routes are the real boundary | Low | Accepted design. Keep authorization in routes (verified); add middleware only for defence-in-depth |
| S9 | CSP is limited to `frame-ancestors`; no script/style policy | Low | Deferred. A strict CSP needs nonce plumbing for Next + Razorpay + Vapi + Zego; adding it blindly would break the app |
| S10 | OAuth state cookie exists, but real providers cannot be exercised | Info | BLOCKED on credentials |

---

## 4. Performance audit

| Observation | Impact | Recommendation |
|---|---|---|
| JSON DB rewrites the entire file per mutation, and reads parse the whole file | Linear slowdown with data growth; concurrent writes can race | Postgres/Supabase (same as S1) |
| `/tmp` is per-instance | Two serverless instances see different data | Persistent DB before horizontal scaling |
| `reactStrictMode: false` | Double-render bugs can hide; React 19 dev checks are reduced | Enable after verifying provider effects |
| Realtime is a no-op | Clients stale until refetch | Acceptable for the file store; replace with DB realtime/SSE later |
| AI calls are bounded with timeouts, but no cache | Repeat prompts cost tokens; Groq 429s under load | Add short-lived response caching and quotas (S2/S3) |
| Some course images use `<img>` | Slower LCP / no optimization | Migrate course thumbnails to `next/image` |
| Production build strips `console` except `error`/`warn` | Prevents leaking ids/quiz answers in prod logs | Keep |
| Zego SDK is dynamically imported | Keeps the video SDK out of every page bundle | Keep |
| Marketing pages are prerendered static | Fast first paint | Keep |

No load or stress testing was performed; results describe correctness and static characteristics only.

---

## 5. Usability and accessibility

Fixed in this pass:

- Dead/misleading controls: landing nav, hero cards, "Liked Jobs", billing "Upgrade", copy-invite, job-tracker "Filter"/"Add", mentor logout.
- Dishonest states: fake empty results for unavailable providers, hardcoded "Quiz Complete!", fabricated analytics, template pricing rows, "2K+ bonus".
- Data-loss traps: results reset on `beforeunload`, quiz auto-skip, locked checkpoints reachable by keyboard.
- Career continuity: chosen career survives retakes and unlocks board/jobs/tracks/mentor matching.
- Accessible names on icon-only buttons, disabled state on locked checkpoints, labelled message input, dialog semantics.
- Honest errors for unconfigured providers instead of silent failure.

Still open:

- Booking filter buttons show selection visually but lack `aria-pressed`.
- Mentor "Ongoing Session" tab and rejected-request visibility are placeholders.
- Mentor notifications have no list surface; the bell navigates to the dashboard.
- No settings/preferences page, password change or account deletion.
- Referral-source onboarding answer is not persisted.

---

## 6. Deployment readiness — exact remaining steps

> Commits `b8ccdbc` and `472d5a8` were pushed to `origin/main`; Vercel auto-deploy attempted both and failed at the precondition below. The following is the handoff.

### 6.1 Preconditions (blocking)

1. **Persistent database.** Replace the `/tmp/mentlio.json` store before any real traffic. Minimum acceptable: a Postgres instance with the same 15 tables, accessed only through `/api/data`.
2. **`SESSION_SECRET` (recommended, no longer blocking).** Generate once per environment and set it in Vercel for Production and Preview so sessions survive deployments:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   vercel env add SESSION_SECRET production
   ```
   Without it, `scripts/generate-session-secret.mjs` generates a random per-build secret, so the build succeeds and auth stays closed; the only cost is that every deployment invalidates existing sessions. Failed deployments before this change: `dpl_F934uwxuU23fvs1VHqRtKn6qysGT`, `dpl_7Tp9R8SH3xSCuvvE1SSN6NDU4jSw`, `dpl_5rFBEqThAEU1LbM6ka6mfNGXZhHp`.
3. **Provider credentials** (set only when each feature is wanted; all fail honestly otherwise):

   | Feature | Variables |
   |---|---|
   | LLM (core) | `GROQ_API_KEY` |
   | Embeddings / direct Gemini | `GEMINI_API_KEY`, `PINECONE_API_KEY`, `PINECONE_INDEX_NAME` |
   | Career-coach grounding | `TAVILY_API_KEY` (server-only; do not use the legacy `NEXT_PUBLIC_` name) |
   | Jobs / courses / salary | `SERPAPI_KEY` |
   | Course videos | `YOUTUBE_API_KEY` |
   | Avatar / video uploads | `NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT` |
   | Payments | `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (test keys first) |
   | Video room | `NEXT_PUBLIC_ZEGO_APP_ID`, `ZEGO_SERVER_SECRET` |
   | Voice interview | `NEXT_PUBLIC_VAPI_PUBLIC_KEY` |
   | Student OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` |
   | Google Calendar | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` |
   | Captcha (after wiring server verification) | `NEXT_PUBLIC_HCAPTCHA_SITE_KEY`, `HCAPTCHA_SECRET` |
   | Rate limiting | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |

   OAuth redirect URIs to register:
   - `https://<host>/api/auth/oauth/google/callback`
   - `https://<host>/api/auth/oauth/discord/callback`
   - `https://<host>/api/auth/oauth/slack/callback`
   - `https://<host>/api/google/callback` (calendar)

### 6.2 Build and ship

```bash
npm ci
npx tsc --noEmit
npm test                 # auth, security, functional, llm
npm run build
vercel --prod             # only after explicit approval
```

### 6.3 Post-deploy verification

1. `curl -I https://<host>/web` — confirm the six security headers and no `X-Powered-By`.
2. Sign up a fresh account, complete the quiz, pick a career in the AI career coach, reload `/home/career-board` — career must persist.
3. Book a mentor slot, accept it as the mentor in a second session, reload the student bookings page.
4. Trigger one roadmap generation and one career-coach reply — verify 200s and that credits are (once S3 is implemented) debited.
5. Attempt an unauthenticated call to `/api/data/users` and `/api/ai/roadmap-gen` — must be 401.
6. Restart/redeploy and confirm the account still exists — this is the persistence check that currently fails until the Postgres migration in 6.1 is done.

### 6.4 Next engineering work, in priority order

1. Postgres migration (S1).
2. Server-enforced credits + AI quotas (S3).
3. Rate limiting for auth and AI (S2).
4. Notification insert scoping (S6).
5. Email verification + captcha (S4, S5).
6. Mentor notifications list, completed-session history, settings page.
7. Enable `reactStrictMode` after the provider effects are stable.

---

## 7. What was verified vs not

- **Verified locally:** every route renders; all automated suites pass; typecheck and production build pass; security headers are served; auth, role boundaries, owner scoping and persistence behave as described; career selection persists and unlocks personalization; unavailable providers fail with explicit messages.
- **Not verified:** the live Vercel deployment after these changes (not deployed), real OAuth logins, live payments, real video/voice calls, external job/course/salary data, and any behaviour under load. These are BLOCKED with the specific credentials or infrastructure listed above — none are marked PASS.
