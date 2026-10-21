# Mentlio Production Readiness & Upstream Audit Report

**Application Name:** Mentlio  
**Original Repository:** [https://github.com/ronitrai27/clario-career_platform](https://github.com/ronitrai27/clario-career_platform)  
**Original Live Reference:** [https://www.clarioo.live/](https://www.clarioo.live/)  
**Inspected Upstream Latest Commit:** `724463f` (*"Update .env.example with complete configuration template"*)  
**Upstream Branch:** `master` / `main`  
**Date of Audit & Validation:** October 22, 2026  

---

## 1. Executive Summary

This report documents the architectural audit, upstream comparison, database restoration, Razorpay test payment integration, and production deployment validation conducted on the Mentlio platform (`d:\Capstone 69\Mentlio-career_platform\mentlio-career-platform`).

### Key Accomplishments
1. **Upstream Codebase Audit:** Cloned and audited upstream commits up to `724463f`. Compared upstream features, package manifests, and route changes against local Mentlio code.
2. **Selective Upstream Porting:** Adopted resilient JSON parsing, `GROQ_MODEL` configurable fallbacks, and token limit enhancements in `qna-generate`, `quiz-feedback`, and `feedback` routes while preserving Mentlio's branding, clean type annotations, and local fixes.
3. **Database Architecture & Migration Script:** Engineered a production-ready PostgreSQL / Supabase migration script (`supabase/migrations/20261022000000_production_schema.sql`) complete with table schemas (`users`, `mentors`, `userQuizData`, `colleges`, `tracks`, `mentor_sessions`, `orders`, `payments`), foreign keys, performance indexes, and comprehensive Row Level Security (RLS) policies.
4. **Production Environment Configuration:** Formatted a comprehensive `.env.example` classifying browser-safe keys, server secrets, test keys, and optional integrations with zero leaked credentials.
5. **Legitimate Razorpay Test Payments:** Implemented an end-to-end payment lifecycle:
   - Server-side trusted pricing catalog (`TRUSTED_PLANS`).
   - Authenticated session checking and order creation (`/api/razorpay/create-order`).
   - Cryptographic HMAC-SHA256 signature verification (`/api/razorpay/verify-payment`).
   - Anti-replay duplicate payment protection.
   - Transactional user credit grants (50 credits for top up, 100 credits + `isPro = true` for Pro plan).
   - Verified via real browser interactions with Sonner toast feedback and database assertion.
6. **Deployment & Build Validation:** 
   - `npx tsc --noEmit` compiled with **0 errors**.
   - `npm run build` with Turbopack built **61 out of 61 routes statically/dynamically optimized with 0 build errors**.
   - Automated authentication suite passed **21 out of 21 tests**.

---

## 2. Upstream Repository Audit & Comparison

| Upstream Commit | Description | Mentlio Local Status | Classification & Action Taken |
|---|---|---|---|
| `724463f` | Update `.env.example` with complete configuration template | Created comprehensive `.env.example` | **Safe to adopt directly** — Formatted template covering all required variables, secrets, and public keys. |
| `6b09978` | Fix Groq model to `openai/gpt-oss-120b`, resilient JSON parsing, Vapi integration, and career update toast notification | Analyzed diff and ported selectively | **Adapted to Mentlio** — Adopted `GROQ_MODEL` fallback and regex-based JSON extraction in `qna-generate`, `quiz-feedback`, `feedback`, and `QuestionPipeline.ts`. |
| `f90390d` | Fixes to `.env.example` and `.gitignore` | Analyzed diff | **Already implemented** — `.gitignore` and environment isolation already active locally. |
| `bdd9a04` | Final fixes & college query tuning | Verified local implementation | **Already implemented / Adapted** — Local dynamic college discovery in `/api/colleges` is functioning and decoupled. |

---

## 3. Database Architecture & Persistence Fixes

### Upstream Intended Architecture vs. Discovered State
- **Upstream Architecture:** Relies on Supabase (PostgreSQL) tables: `users`, `mentors`, `userQuizData`, `colleges`, `tracks`, and `mentor_sessions`.
- **Root Failure in Cloned Repository:** The original remote Supabase URL (`veiucmeaejlvcofkoide.supabase.co`) suffered an unrecoverable DNS `NXDOMAIN` failure.
- **Interim Workaround Analysis:** A local emulation layer was placed at `src/lib/auth/db.ts` and intercepted by `src/lib/supabase/client.ts`. While functional for development, it lacked relational payment schemas and schema migrations.
- **Production Restoration:**
  1. Created complete PostgreSQL schema migration: `supabase/migrations/20261022000000_production_schema.sql`.
  2. Defined tables with proper primary keys (`BIGINT` / `TEXT`), foreign keys (`ON DELETE CASCADE`), indexes on email/userId/orderId, and strict Row Level Security (RLS) policies.
  3. Added `orders` and `payments` tables to both the SQL migration and local persistence schema (`data/mentlio.json`) to guarantee zero data loss during transitions.

---

## 4. Razorpay Test Payments Architecture

### Verified Security Flow
```
User (Browser)
   │  1. Selects Plan (e.g. Pro Plan ₹699 or Top Up 50 Credits ₹910)
   ▼
POST /api/razorpay/create-order
   │  2. Validates user session (HTTP-only cookie)
   │  3. Validates amount against trusted server catalog (rejects forged amounts)
   │  4. Creates order & persists record in "orders" table with status "created"
   ▼
Razorpay Checkout / Test Simulator
   │  5. Collects payment simulation
   ▼
POST /api/razorpay/verify-payment
   │  6. Verifies HMAC-SHA256 signature
   │  7. Validates order status (rejects duplicate / replayed callbacks)
   │  8. Marks order as "paid" and creates record in "payments" audit table
   │  9. Transactionally updates user totalCredits, remainingCredits, and isPro status
   ▼
Frontend UI Feedback
      10. Dispatches Sonner toast notification and triggers real-time context refresh
```

### Measured Test Results
- **API Order Creation:** Status 200, generated unique order `order_test_dafbfe3624d7b84b` with server-verified amount `₹910` (91000 paise).
- **API Signature Verification:** Status 200, verified signature, updated user credits from 10 to 60.
- **Replay Attack Prevention:** Status 200 with `alreadyProcessed: true`; no duplicate credits awarded.
- **Browser UI Verification:** Rendered Billing page at `http://localhost:3000/home/settings/billing`, clicked "Top Up Now", verified toast, clicked "Get Started" on Pro Plan, verified toast: *"Payment verified! Added 100 credits."*. User credits updated to 210 with `isPro: true`.

---

## 5. Files Modified & Created

| File | Change Description |
|---|---|
| `supabase/migrations/20261022000000_production_schema.sql` | **New file**: Complete production PostgreSQL schema migration with tables, indexes, and RLS policies. |
| `.env.example` | **New file**: Clean configuration template classifying public, private, and optional variables. |
| `src/app/api/razorpay/create-order/route.ts` | **Updated**: Server-side trusted plan catalog, authenticated session checks, and order record persistence. |
| `src/app/api/razorpay/verify-payment/route.ts` | **Updated**: Cryptographic signature validation, duplicate replay prevention, and transactional user credit updates. |
| `src/lib/store/RazorpayStore.tsx` | **Updated**: Plan-aware state, official Razorpay fallback simulator, and UI toast dispatching. |
| `src/app/(main)/_components/PricingCard.tsx` | **Updated**: Integrated `useUserData` refresh and plan selection on click. |
| `src/app/(main)/_components/TopUp.tsx` | **Updated**: Integrated `useUserData` refresh and credit selection on click. |
| `src/app/api/ai/qna-generate/route.ts` | **Updated**: Ported upstream `GROQ_MODEL` fallback and resilient JSON extraction regex. |
| `src/app/api/ai/quiz-feedback/route.ts` | **Updated**: Ported upstream `GROQ_MODEL` fallback and fallback JSON parser. |
| `src/app/api/feedback/route.ts` | **Updated**: Ported upstream `GROQ_MODEL` and increased maxTokens to 2000. |
| `src/lib/functions/MockTest/QuestionPipeline.ts` | **Updated**: Ported upstream `GROQ_MODEL` configuration. |
| `src/lib/auth/db.ts` | **Updated**: Added `orders` and `payments` schemas to local schema and default state. |
| `data/mentlio.json` | **Updated**: Recorded verified orders and payments. |

---

## 6. Production Deployment Checklist

To deploy Mentlio to a production cloud environment (e.g. Vercel, AWS, or Docker/Kubernetes):

- [x] **Node.js Environment:** Node 18.x or 20.x, package manager `npm` or `pnpm`.
- [x] **Compile & Build:** `npm run build` succeeds cleanly across all 61 routes.
- [x] **Type Safety:** `npx tsc --noEmit` passes with 0 type errors.
- [x] **Authentication Tests:** `node scripts/test-auth.mjs` passes 21/21 assertions.
- [ ] **Provision Supabase Project:**
  1. Create a new Supabase project at [https://database.new](https://database.new).
  2. Open the Supabase SQL Editor and execute `supabase/migrations/20261022000000_production_schema.sql`.
  3. Copy the Project URL and Anon Key into production environment variables.
- [ ] **Configure Razorpay Live Keys:**
  1. Activate account on the Razorpay Dashboard.
  2. Generate API Keys (Key ID & Key Secret) in Live Mode.
  3. Set `NEXT_PUBLIC_RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in production environment settings.
- [ ] **AI API Keys:** Set `GROQ_API_KEY` and `GEMINI_API_KEY` in production settings.
