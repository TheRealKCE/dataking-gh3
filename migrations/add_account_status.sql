-- Add account_status column to users table
-- This migration adds approval workflow support

-- Add the account_status column with default 'approved' for existing users
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'approved';

-- Update all existing users to 'approved' status to avoid disrupting current users
UPDATE users SET account_status = 'approved' WHERE account_status IS NULL;

-- Create index for faster queries on account_status
CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status);

-- Possible values for account_status:
-- 'pending' - New signup awaiting admin approval
-- 'approved' - User can access the system
-- 'rejected' - User registration was declined
