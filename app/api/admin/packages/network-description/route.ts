import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = await createRouteHandlerClient()
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if user is admin
        const { data: userData } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single()

        if (userData?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const { network, description } = body

        if (!network) {
            return NextResponse.json({ error: 'Network is required' }, { status: 400 })
        }

        // Use service role client to update all packages
        const supabase = createServerClient()

        // Update description for all packages of this network
        const { data, error } = await (supabase
            .from('data_packages') as any)
            .update({ description })
            .eq('network', network)
            .select()

        if (error) throw error

        return NextResponse.json({
            success: true,
            updated: data?.length || 0,
            message: `Updated description for ${data?.length || 0} ${network} packages`
        })
    } catch (error: any) {
        console.error('Network Description Update Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
