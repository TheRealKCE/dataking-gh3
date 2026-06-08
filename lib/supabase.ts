import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'

// Browser client — uses @supabase/ssr so cookie format matches the middleware and route handlers
export const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function requireServerEnv(name: string) {
    const value = process.env[name]
    if (!value) {
        throw new Error(`${name} is not configured`)
    }
    return value
}

// Server client with service role for admin operations (bypasses RLS)
export const createServerClient = () => {
    const supabaseUrl = requireServerEnv('NEXT_PUBLIC_SUPABASE_URL')
    const supabaseServiceKey = requireServerEnv('SUPABASE_SERVICE_ROLE_KEY')

    return createClient<Database>(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
}
