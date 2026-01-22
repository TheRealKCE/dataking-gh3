import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/types/supabase'

// Route handler client for API routes (reads session from cookies)
// This file should only be imported in server-side code (API routes, server components)
export const createRouteClient = () => {
    return createRouteHandlerClient<Database>({ cookies })
}
