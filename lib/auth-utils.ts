import { createRouteHandlerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { SupabaseClient, User } from '@supabase/supabase-js'

export type AdminAccessResult =
    | { user: User; role: string; supabase: SupabaseClient; error: null; status: number }
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
        const supabase = await createRouteHandlerClient()

        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

        if (authError || !authUser) {
            return { user: null, role: null, supabase: null, error: 'Unauthorized', status: 401 }
        }

        const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single()

        if (!userData) {
            return { user: null, role: null, supabase: null, error: 'User profile not found', status: 404 }
        }

        const role = userData.role

        if (role === 'admin') {
            return { user: authUser, role, supabase, error: null, status: 200 }
        }

        if (role === 'sub-admin') {
            if (allowSubAdmin) {
                if (request) {
                    const url = new URL(request.url)
                    const path = url.pathname
                    const isOrderApi = path.startsWith('/api/admin/orders') ||
                                     path.startsWith('/api/admin/batches')

                    if (!isOrderApi) {
                        console.warn(`[AuthAudit] Sub-admin ${authUser.id} blocked from non-order API: ${path}`)
                        return { user: null, role: null, supabase: null, error: 'Forbidden: Sub-admin limited to orders', status: 403 }
                    }
                }
                return { user: authUser, role, supabase, error: null, status: 200 }
            } else {
                return { user: null, role: null, supabase: null, error: 'Forbidden: Admin access required', status: 403 }
            }
        }

        return { user: null, role: null, supabase: null, error: 'Forbidden', status: 403 }

    } catch (error) {
        console.error('[AuthAudit] validateAdminAccess critical error:', error)
        return { user: null, role: null, supabase: null, error: 'Internal Server Error', status: 500 }
    }
}
