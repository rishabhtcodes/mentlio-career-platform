# Clario vs. Mentlio Comprehensive Feature-by-Feature Comparison Matrix

## Overview
This document compares the original Clario project ([https://www.clarioo.live/](https://www.clarioo.live/), [ronitrai27/clario-career_platform](https://github.com/ronitrai27/clario-career_platform)) with the deployed Mentlio application ([https://mentlio-career-platform.vercel.app/](https://mentlio-career-platform.vercel.app/), [rishabhtcodes/mentlio-career-platform](https://github.com/rishabhtcodes/mentlio-career-platform)).

---

## Feature Comparison Matrix

| # | Feature / Area | Clario Status | Mentlio Status | Parity Category | Root Cause & Implementation Notes |
|:---|:---|:---|:---|:---|:---|
| 1 | **Landing Page (`/` & `/web`)** | Active, hero with particles & marquee | Active, branded Mentlio, responsive hero | **MATCHES** | All sections, cards, and CTA navigation functional. |
| 2 | **Authentication (`/auth`)** | Blocked on Supabase NXDOMAIN error | Working local session & bcrypt auth | **FIXED AND VERIFIED** | Mentlio has self-contained, durable auth endpoints (`/api/auth/*`). Clario's original Supabase backend (`veiucmeaejlvcofkoide.supabase.co`) is down via DNS failure. |
| 3 | **Auth Mentor (`/auth-mentor`)** | Page rendered | Page rendered with Mentlio branding | **MATCHES** | Accessible via dedicated mentor onboarding route. |
| 4 | **Dashboard / Home (`/home`)** | Dynamic career cards & stats | Dynamic career cards, profile, tracker | **MATCHES** | Interactive components and metrics functional. |
| 5 | **Mentor Connect (`/home/mentor-connect`)** | Only 2 default mentors in fallback | 10 fully populated mentors with ratings/bios | **FIXED AND VERIFIED** (Superior) | Expanded mentor profiles across cloud, AI, ML, frontend, backend, security. |
| 6 | **Mentor Booking (`/home/mentor-connect/[id]`)** | Dependent on Supabase RPC | Working UI route with calendar & booking | **MATCHES** | Booking triggers state updates in `/api/data/mentor_sessions`. |
| 7 | **Career Coach AI (`/home/ai-tools/career-coach`)** | Groq / OpenAI streaming chat | Groq / OpenAI integration configured | **MATCHES** | Keys synced to Vercel production environment. |
| 8 | **Roadmap Maker (`/home/ai-tools/roadmap-maker`)** | LangChain / Groq structured nodes | LangChain + Tavily real-time doc search | **FIXED AND VERIFIED** (Superior) | Mentlio automatically discovers real doc URLs using Tavily search. |
| 9 | **Career Board & College Suggestions** | Had dedicated `/api/colleges` route | Restored `/api/colleges` with NIRF ranking | **FIXED AND VERIFIED** | Restored upstream's Google SerpAPI & NIRF ranking engine. |
| 10 | **Job Tracker (`/home/job-tracker`)** | SerpAPI search + Kanban board | SerpAPI search with mock fallback + Kanban | **MATCHES** | Includes mock fallback for resilient demoing even without SerpAPI credits. |
| 11 | **Interview Prep (`/home/interview-prep`)** | Vapi audio + FaceDetectionCanvas | Vapi audio + Multi-face AI proctoring guard | **FIXED AND VERIFIED** (Superior) | Mentlio includes real-time multi-face proctoring guard. |
| 12 | **Billing & Razorpay Payments (`/home/settings/billing`)** | Non-functional Razorpay dummy buttons | Complete test-mode order & verify flow | **FIXED AND VERIFIED** (Superior) | Server-side signature verification at `/api/razorpay/verify-payment` and state updates in `/api/data/payments`. |
| 13 | **Settings & Profile (`/home/settings`)** | 404 on base `/home/settings` | Added auto-redirect to `/home/settings/billing` | **FIXED AND VERIFIED** | Fixed broken link in navigation hierarchy. |
| 14 | **Database Persistence** | Down (Supabase project deleted/expired) | Restored JSON REST API `/api/data/[table]` | **FIXED AND VERIFIED** | Resilient schema supporting users, mentors, colleges, tracks, payments, orders. |

---

## Authentication Redirect Investigation Summary
- **Symptom**: Suspected redirect from Clario to Mentlio.
- **Investigation Finding**: Clario's public repository and live deployment at `www.clarioo.live` do **not** reference Mentlio anywhere in their source tree.
- **Root Cause**: Clario's backend Supabase domain `veiucmeaejlvcofkoide.supabase.co` produces a DNS NXDOMAIN failure (`DNS_ERROR_RCODE_NAME_ERROR`). When visiting Clario after logging out, browsers that previously had local development tabs open (e.g. `localhost:3000` or recent history auto-completes) can automatically suggest or redirect to active local or recent Vercel sessions if OAuth redirect origins are misconfigured in the shared provider console.
- **Verification**: Mentlio's authentication strictly uses `window.location.origin` for internal redirects (`${window.location.origin}/auth/callback`), ensuring zero cross-domain leakage to Clario.
