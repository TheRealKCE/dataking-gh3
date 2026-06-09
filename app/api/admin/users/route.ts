import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { validateAdminAccess } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
    try {
        const authResult = await validateAdminAccess(false, request)
        if (authResult.error) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status })
        }
        const { supabase: supabaseUserClient } = authResult

        const { searchParams } = new URL(request.url)
        const rawLimit = parseInt(searchParams.get('limit') || '50')
        const limit = Math.min(Math.max(rawLimit, 1), 200)
        const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0)
        const rawSearch = searchParams.get('search')
        const search = rawSearch ? rawSearch.trim().slice(0, 100) : null
        const role = searchParams.get('role')

        const VALID_ROLES = ['customer', 'agent', 'sub-admin', 'admin', 'all']
        if (role && !VALID_ROLES.includes(role)) {
            return NextResponse.json({ error: 'Invalid role filter' }, { status: 400 })
        }

        // Service role client to bypass RLS
        const supabase = createServerClient()

        // Add timeout to prevent hanging queries
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Database query timeout')), 10000)
        )

        let query = supabase
            .from('users')
            .select(`
                id,
                email,
                first_name,
                last_name,
                phone_number,
                role,
                status,
                agent_expires_at,
                created_at,
                updated_at,
                wallets (
                    balance
                )
            `, { count: 'exact' })

        if (role && role !== 'all') {
            query = query.eq('role', role)
        }

        if (search) {
            query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone_number.ilike.%${search}%`)
        }

        const fetchPromise = query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        const { data: users, count, error: fetchError } = await Promise.race([
            fetchPromise,
            timeoutPromise
        ]) as any

        if (fetchError) {
            console.error('[AdminUsersFetch] Database error:', fetchError)
            throw new Error(`Database query failed: ${fetchError.message}`)
        }

        return NextResponse.json({
            users: users || [],
            totalCount: count || 0
        })
    } catch (error: any) {
        console.error('Admin Users Fetch Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
