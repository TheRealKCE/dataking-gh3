-- Query to check if there are any agents in the database
-- Run this in your Supabase SQL Editor

-- 1. Check total number of users with role='agent'
SELECT COUNT(*) as agent_count 
FROM public.users 
WHERE role = 'agent';

-- 2. List all agents with their details
SELECT 
    id,
    email,
    first_name,
    last_name,
    role,
    status,
    agent_expires_at,
    created_at
FROM public.users 
WHERE role = 'agent'
ORDER BY created_at DESC;

-- 3. Check all user roles to see what roles exist
SELECT role, COUNT(*) as count
FROM public.users
GROUP BY role
ORDER BY count DESC;
