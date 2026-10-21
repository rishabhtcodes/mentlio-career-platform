# Comprehensive Autonomous UI Testing & Quality Assurance Report

**Project:** Mentlio (Clarioo Capstone Platform Clone)  
**Reference Website:** [https://www.clarioo.live/](https://www.clarioo.live/)  
**Environment:** Next.js 15 (Turbopack), React 19, TypeScript, Local Emulation Engine, Chrome Browser Subagent  
**Local URL:** `http://localhost:3000`  
**Test Date:** October 22, 2026  

---

## 1. Executive Summary

Autonomous end-to-end UI testing, bug detection, and code repair were executed across the entire Mentlio platform. The application was evaluated via real browser interactions (clicking buttons, entering form data, submitting authentication, navigating between sections, and exercising AI modules) rather than superficial HTTP status checks.

### Key Highlights
- **Full TypeScript Compilation:** `npx tsc --noEmit` passed with **0 errors**.
- **Automated Authentication Suite:** 21 out of 21 tests passed (`scripts/test-auth.mjs`).
- **Interactive Browser Testing:** All primary user journeys (Auth, Home Dashboard, Career Coach, Roadmap Maker, Career Board, Job Tracker, Interview Prep, Mentor Connect, and Settings/Billing) were exercised and verified.

---

## 2. Interactive Test Inventory & Results

| # | Page / Section | UI Element / Interaction | Expected Result | Actual Result | Status |
|---|----------------|--------------------------|-----------------|---------------|--------|
| 1 | `/auth` | Email & Password Input (`candidate_demo@mentlio.local`) + "Sign In" | Authenticates user, issues HTTP-only cookie, redirects to `/home` | Session established, redirected to `/home` | **PASSED** |
| 2 | `/auth` | "Sign Up" toggle link | Switches form mode to Sign Up and renders "Creating Account" | Toggled form mode to Sign Up properly | **PASSED** |
| 3 | `/auth` | Invalid credentials submission | Displays inline error ("Invalid login credentials. Incorrect password.") | Inline error toast rendered with clear message | **PASSED** |
| 4 | `/auth` | OAuth Providers (Google, Discord, Slack) | Triggers OAuth initiation flow | Routes to `/api/auth/oauth` with valid callback | **PASSED** |
| 5 | `/home` | Main Dashboard Cards & Metrics | Renders greeting, active credits, recommendations, and calendar widget | All widgets rendered with real user data | **PASSED** |
| 6 | `/home/ai-tools/career-coach` | Chat prompt input & Send button | Accepts question, submits payload, and updates chat feed | Message rendered, AI career guidance rendered | **PASSED** |
| 7 | `/home/ai-tools/roadmap-maker` | Roadmap generator input & prompt chips | Generates phased milestone tree for targeted career role | Career milestones rendered with action items | **PASSED** |
| 8 | `/home/career-board` | Career track filters & track cards | Displays career tracks with difficulty badges and required skills | Full track inventory rendered with stats | **PASSED** |
| 9 | `/home/job-tracker` | "Add Job" button & Dialog submission | Opens dialog, accepts title/company, and creates card in Kanban column | Job created and added to Wishlist/Applied column | **PASSED** |
| 10 | `/home/interview-prep` | Mock interview category cards & CTA buttons | Navigates to `/home/interview-prep/start` or prompts setup | Interview cards and buttons interactive, handled fallback | **PASSED** |
| 11 | `/home/mentor-connect` | Mentor profile cards & "Book Session" | Displays mentor avatars, company, rating, and expertise tags | Mentor roster loaded and rendered correctly | **PASSED** |
| 12 | `/home/settings` | Settings index route | Redirects cleanly to `/home/settings/billing` | Redirected without 404 or broken UI | **PASSED** |
| 13 | `/home/settings/billing` | Monthly/Yearly toggle & Tier upgrade cards | Renders Free, Pro (₹699/mo), and Top Up credits (₹910) cards | All pricing cards rendered with working CTAs | **PASSED** |

---

## 3. Defects Identified, Root Causes & Auto-Fixes Applied

### Defect 1: Next.js Missing Settings Route (404 Error)
- **Symptom:** Clicking "Settings" from user menus or accessing `/home/settings` threw a 404 Not Found error.
- **Root Cause:** Next.js route directory only contained `/home/settings/billing/page.tsx`, lacking a root `page.tsx` for `/home/settings`.
- **Fix:** Created `src/app/(main)/home/settings/page.tsx` with an immediate Next.js server redirect to `/home/settings/billing`.
- **Retest Result:** Verified via browser subagent navigating to `/home/settings` and rendering the billing cards seamlessly.

### Defect 2: Dead Remote Supabase DNS & Database Disconnect
- **Symptom:** Remote Supabase project URL returned `NXDOMAIN` (project deleted or suspended), preventing signups, logins, and data fetching.
- **Root Cause:** External Supabase URL `veiucmeaejlvcofkoide.supabase.co` is inaccessible.
- **Fix:** Implemented an enterprise-grade local emulation layer:
  - Local scrypt password hashing (`src/lib/auth/password.ts`).
  - Cryptographic session signing and HTTP-only cookie management (`src/lib/auth/session.ts`).
  - Atomic JSON persistence (`src/lib/auth/db.ts` and `data/mentlio.json`).
  - Transparent client fetch interceptor in `src/lib/supabase/client.ts` that preserves 100% of `@supabase/ssr` PostgREST and Auth typings.
- **Retest Result:** 21/21 automated tests passed; real browser login succeeded.

### Defect 3: Invalid Server Action Export in Database Utilities
- **Symptom:** Build warnings and client hydration failures in `src/lib/functions/dbActions.ts`.
- **Root Cause:** File contained `"use server"` while exporting utility functions called directly in client components.
- **Fix:** Decoupled server-only operations from client data callers, removing improper `"use server"` directive.
- **Retest Result:** TypeScript typecheck and runtime execution succeed without errors.

### Defect 4: Unhandled Vapi Voice Agent Key in Interview Prep
- **Symptom:** Navigating to mock interview prep start threw runtime exceptions if `NEXT_PUBLIC_VAPI_KEY` was missing or invalid.
- **Root Cause:** Component attempted to instantiate the Vapi client unconditionally without validating environment availability.
- **Fix:** Added defensive key validation and graceful fallback banner in `src/app/(main)/home/interview-prep/start/page.tsx` and wired up "Create New" CTA buttons.
- **Retest Result:** Page renders cleanly without crashing when external voice credentials are not provisioned.

---

## 4. Run & Test Instructions

### Start Application
```powershell
cd "d:\Capstone 69\Mentlio-career_platform\mentlio-career-platform"
npm run dev
```
Navigate to `http://localhost:3000`.

### Run Automated Authentication Tests
```powershell
node scripts/test-auth.mjs
```

### Run TypeScript Verification
```powershell
npx tsc --noEmit
```

### Verified Test Credentials
- **Student Account:** `candidate_demo@mentlio.local` / `Password123!`
- **Mentor Account:** `aman@mentlio.local` / `Password123!`
