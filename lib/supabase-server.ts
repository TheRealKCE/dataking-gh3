import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/supabase'

function createCompatibleServerClient(cookieStore: any) {
    return createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            cookieStore.set(name, value, options)
                        })
                    } catch {
                        // Ignore errors from setting cookies in read-only environments
                    }
                }
            }
        }
    )
}

// Drop-in replacement for API route handlers
export function createRouteHandlerClient(options?: { cookies: () => any }) {
    if (options?.cookies) {
        return createCompatibleServerClient(options.cookies())
    }
    // Fallback if they didn't pass it (though Next.js 15 requires await cookies())
    // This is risky in Next 15 without await, but keeps backward compatibility for synchronous code
    return createCompatibleServerClient(cookies())
}

// Drop-in replacement for Server Components
export function createServerComponentClient(options?: { cookies: () => any }) {
    if (options?.cookies) {
        return createCompatibleServerClient(options.cookies())
    }
    return createCompatibleServerClient(cookies())
}

// Drop-in replacement for Server Actions
export function createServerActionClient(options?: { cookies: () => any }) {
    if (options?.cookies) {
        return createCompatibleServerClient(options.cookies())
    }
    return createCompatibleServerClient(cookies())
}

// Kept for backward compatibility with older files
export const createRouteClient = () => {
    return createCompatibleServerClient(cookies())
}
