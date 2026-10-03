-- ============================================================================
-- SMS Broadcast Jobs Migration
-- Created: 2026-10-02
--
-- The admin bulk SMS broadcast feature (app/api/admin/sms-broadcast) used to
-- send to every recipient synchronously inside a single POST handler. On a
-- real customer list (~2,000+ numbers) this blew past Vercel's serverless
-- function timeout and the request died with a 504 after only ~120 sends,
-- silently abandoning the rest with no record of who was reached.
--
-- This table makes a broadcast a durable, resumable job: the POST handler
-- now just resolves recipients and inserts one row here, then kicks off a
-- self-chaining batch sender (each batch call triggers the next one via a
-- fire-and-forget fetch) instead of looping inline. Progress survives any
-- single request dying, and the admin UI can poll status instead of blocking
-- on one giant request.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sms_broadcast_jobs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message         TEXT NOT NULL,
  recipients      JSONB NOT NULL, -- [{ id, first_name, phone_number, role }]
  total           INTEGER NOT NULL,
  sent_count      INTEGER NOT NULL DEFAULT 0,
  success_count   INTEGER NOT NULL DEFAULT 0,
  failed_count    INTEGER NOT NULL DEFAULT 0,
  errors          JSONB NOT NULL DEFAULT '[]'::jsonb,
  status          TEXT NOT NULL DEFAULT 'pending',
  created_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sms_broadcast_jobs_status_check'
  ) THEN
    ALTER TABLE public.sms_broadcast_jobs
      ADD CONSTRAINT sms_broadcast_jobs_status_check
      CHECK (status IN ('pending', 'processing', 'completed', 'failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sms_broadcast_jobs_status ON public.sms_broadcast_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sms_broadcast_jobs_created_at ON public.sms_broadcast_jobs(created_at DESC);

ALTER TABLE public.sms_broadcast_jobs ENABLE ROW LEVEL SECURITY;

-- Admins can read/manage broadcast jobs; all writes in practice go through
-- the service-role client (enqueue + batch processor), this policy only
-- covers the admin UI's status-polling reads.
DROP POLICY IF EXISTS "sms_broadcast_jobs_admin_read" ON public.sms_broadcast_jobs;
CREATE POLICY "sms_broadcast_jobs_admin_read" ON public.sms_broadcast_jobs
  FOR SELECT USING (
    (SELECT role FROM public.users WHERE id = (SELECT auth.uid())) = 'admin'
  );
