-- =========================================================================
-- MENTLIO / CLARIO PRODUCTION DATABASE MIGRATION SCRIPT
-- PostgreSQL / Supabase Migration
-- Version: 1.0.0
-- =========================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------------------------
-- 1. USERS TABLE
-- Stores student and general platform candidate accounts
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id BIGINT PRIMARY KEY,
    "userName" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL UNIQUE,
    "passwordHash" TEXT,
    avatar TEXT DEFAULT '/user1.png',
    "totalCredits" INTEGER DEFAULT 10,
    "remainingCredits" INTEGER DEFAULT 10,
    invite_link TEXT,
    current_status TEXT DEFAULT '',
    "userPhone" TEXT DEFAULT '',
    "institutionName" TEXT DEFAULT '',
    "mainFocus" TEXT DEFAULT '',
    is_verified BOOLEAN DEFAULT FALSE,
    "isQuizDone" BOOLEAN DEFAULT FALSE,
    latitude DOUBLE PRECISION DEFAULT 0,
    longitude DOUBLE PRECISION DEFAULT 0,
    "isPro" BOOLEAN DEFAULT FALSE,
    google_refresh_token TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users("userEmail");

-- -------------------------------------------------------------------------
-- 2. MENTORS TABLE
-- Stores verified industry mentors
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mentors (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    "passwordHash" TEXT,
    phone TEXT,
    linkedin TEXT,
    bio TEXT,
    expertise TEXT[] DEFAULT '{}',
    current_position TEXT DEFAULT '',
    availability BOOLEAN DEFAULT TRUE,
    rating NUMERIC(3,2) DEFAULT 5.0,
    avatar TEXT,
    video_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mentors_email ON public.mentors(email);

-- -------------------------------------------------------------------------
-- 3. USER QUIZ DATA TABLE
-- Stores onboarding quiz answers, career recommendations, and skills
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."userQuizData" (
    id BIGSERIAL PRIMARY KEY,
    "userId" BIGINT REFERENCES public.users(id) ON DELETE CASCADE,
    quiz_answers JSONB DEFAULT '[]'::jsonb,
    suggested_careers TEXT[] DEFAULT '{}',
    selected_career TEXT,
    summary TEXT,
    stream TEXT,
    skills TEXT[] DEFAULT '{}',
    insights JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_userId ON public."userQuizData"("userId");

-- -------------------------------------------------------------------------
-- 4. COLLEGES TABLE
-- College database for suggestion algorithms
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.colleges (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    college_name TEXT,
    location TEXT NOT NULL,
    fees TEXT,
    placement TEXT,
    type TEXT DEFAULT 'Private',
    best_suit_for TEXT[] DEFAULT '{}',
    rating NUMERIC(3,2) DEFAULT 4.5,
    rank_score INTEGER DEFAULT 70,
    link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_colleges_location ON public.colleges(location);

-- -------------------------------------------------------------------------
-- 5. CAREER TRACKS TABLE
-- Curated learning paths & skill milestones
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracks (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    domain TEXT NOT NULL,
    difficulty TEXT DEFAULT 'Beginner',
    milestones JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 6. MENTOR SESSIONS TABLE
-- Scheduled 1-on-1 mentorship bookings
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mentor_sessions (
    id BIGSERIAL PRIMARY KEY,
    "mentorId" TEXT REFERENCES public.mentors(id) ON DELETE CASCADE,
    "userId" BIGINT REFERENCES public.users(id) ON DELETE CASCADE,
    scheduled_time TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 45,
    meeting_link TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 7. ORDERS TABLE (RAZORPAY INTEGRATION)
-- Tracks pending and confirmed payment orders
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id BIGSERIAL PRIMARY KEY,
    "orderId" TEXT NOT NULL UNIQUE,
    receipt TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    "amountInPaise" BIGINT NOT NULL,
    currency TEXT DEFAULT 'INR',
    credits INTEGER DEFAULT 0,
    "isPro" BOOLEAN DEFAULT FALSE,
    "isSimulated" BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'created',
    "paymentId" TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_orderId ON public.orders("orderId");
CREATE INDEX IF NOT EXISTS idx_orders_userId ON public.orders("userId");

-- -------------------------------------------------------------------------
-- 8. PAYMENTS TABLE (RAZORPAY VERIFICATION AUDIT)
-- Immutable ledger of successful transactions
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY,
    "orderId" TEXT REFERENCES public.orders("orderId") ON DELETE RESTRICT,
    "paymentId" TEXT NOT NULL UNIQUE,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    currency TEXT DEFAULT 'INR',
    "creditsGranted" INTEGER NOT NULL,
    "isPro" BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'captured',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_userId ON public.payments("userId");

-- -------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- Ensures data privacy, tenant isolation, and secure access
-- -------------------------------------------------------------------------

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."userQuizData" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Colleges & Tracks: Public Read Access
CREATE POLICY "Public read access for colleges" ON public.colleges FOR SELECT USING (true);
CREATE POLICY "Public read access for tracks" ON public.tracks FOR SELECT USING (true);
CREATE POLICY "Public read access for mentors" ON public.mentors FOR SELECT USING (true);

-- Users: Self read & update
CREATE POLICY "Users can read own profile" ON public.users 
    FOR SELECT USING (auth.uid()::text = id::text OR "userEmail" = auth.jwt() ->> 'email');
CREATE POLICY "Users can update own profile" ON public.users 
    FOR UPDATE USING (auth.uid()::text = id::text OR "userEmail" = auth.jwt() ->> 'email');

-- UserQuizData: Self access
CREATE POLICY "Users can view own quiz data" ON public."userQuizData"
    FOR SELECT USING ("userId"::text = auth.uid()::text);
CREATE POLICY "Users can insert own quiz data" ON public."userQuizData"
    FOR INSERT WITH CHECK ("userId"::text = auth.uid()::text);
CREATE POLICY "Users can update own quiz data" ON public."userQuizData"
    FOR UPDATE USING ("userId"::text = auth.uid()::text);

-- Orders & Payments: User can view own billing records
CREATE POLICY "Users can view own orders" ON public.orders
    FOR SELECT USING ("userId" = auth.uid()::text OR "userEmail" = auth.jwt() ->> 'email');
CREATE POLICY "Users can view own payments" ON public.payments
    FOR SELECT USING ("userId" = auth.uid()::text OR "userEmail" = auth.jwt() ->> 'email');
