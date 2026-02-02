-- Add agent_expires_at column to users table
-- This column tracks when an agent's access expires

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS agent_expires_at TIMESTAMP WITH TIME ZONE;

-- Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_users_agent_expires_at ON public.users(agent_expires_at);

-- Add a comment to document the column
COMMENT ON COLUMN public.users.agent_expires_at IS 'Timestamp when agent role access expires. NULL means no expiration or not an agent.';
