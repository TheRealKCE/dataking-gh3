import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { SupabaseClient, User } from '@supabase/supabase-js'

export type AdminAccessResult = 
    | { user: User; role: string; supabase: SupabaseClient; error: null }
    | { user: null; role: null; supabase: null; error: string; status: number }

/**
 * Standardizes admin authorization for API routes.
 * 
 * @param allowSubAdmin - If true, sub-admins can access this route (restricted to /admin/orders)
 * @param request - Optional NextRequest for additional path-based checks
 */
export async function validateAdminAccess(
    allowSubAdmin: boolean = false,
    request?: Request
): Promise<AdminAccessResult> {
    try {
        const cookieStore = await cookies()
        const supabase = createRouteHandlerClient({
            // @ts-expect-error - Next.js 15 async cookies compatibility
            cookies: () => cookieStore
        })
        
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !authUser) {
            return { user: null, role: null, supabase: null, error: 'Unauthorized', status: 401 }
        }
        
        // Fetch user role from DB to ensure it's up-to-date and not tampered with in JWT (though JWT is signed)
        const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single()
            
        if (!userData) {
            return { user: null, role: null, supabase: null, error: 'User profile not found', status: 404 }
        }
        
        const role = userData.role
        
        // 1. Admin always has access
        if (role === 'admin') {
            return { user: authUser, role, supabase, error: null }
        }
        
        // 2. Sub-admin access (strictly restricted to specific logic)
        if (role === 'sub-admin') {
            if (allowSubAdmin) {
                // If path info is provided, we can do an extra safety check here
                if (request) {
                    const url = new URL(request.url)
                    const path = url.pathname
                    // Strictly allow only order-related APIs for sub-admin
                    const isOrderApi = path.startsWith('/api/admin/orders') || 
                                     path.startsWith('/api/admin/batches') // Often used by orders
                    
                    if (!isOrderApi) {
                        console.warn(`[AuthAudit] Sub-admin ${authUser.id} blocked from non-order API: ${path}`)
                        return { user: null, role: null, supabase: null, error: 'Forbidden: Sub-admin limited to orders', status: 403 }
                    }
                }
                return { user: authUser, role, supabase, error: null }
            } else {
                return { user: null, role: null, supabase: null, error: 'Forbidden: Admin access required', status: 403 }
            }
        }
        
        // 3. Any other role (customer, agent, etc.) is forbidden
        return { user: null, role: null, supabase: null, error: 'Forbidden', status: 403 }
        
    } catch (error) {
        console.error('[AuthAudit] validateAdminAccess critical error:', error)
        return { user: null, role: null, supabase: null, error: 'Internal Server Error', status: 500 }
    }
}
