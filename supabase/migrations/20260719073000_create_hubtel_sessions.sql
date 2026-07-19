-- Migration: Create hubtel_sessions table for USSD session state tracking

CREATE TABLE IF NOT EXISTS public.hubtel_sessions (
    session_id TEXT PRIMARY KEY,
    mobile TEXT NOT NULL,
    current_step TEXT NOT NULL DEFAULT 'initiation',
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cleaning up old sessions if necessary
CREATE INDEX IF NOT EXISTS idx_hubtel_sessions_created_at ON public.hubtel_sessions(created_at DESC);

-- RLS Policies
ALTER TABLE public.hubtel_sessions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (API routes use service role)
DROP POLICY IF EXISTS "hubtel_sessions_service_role_all" ON public.hubtel_sessions;
CREATE POLICY "hubtel_sessions_service_role_all" ON public.hubtel_sessions FOR ALL TO service_role USING (true);
