import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { PUBLIC_CONFIG_CACHE_TAG } from '@/lib/cache-tags'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

export async function POST() {
    try {
        const cookieStore = await cookies()
        const supabaseAuth = await createRouteHandlerClient()
        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: dbUser } = await supabaseAuth.from('users').select('role').eq('id', user.id).single()
        if (dbUser?.role !== 'admin' && dbUser?.role !== 'sub-admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        revalidateTag(PUBLIC_CONFIG_CACHE_TAG)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error revalidating config:', error)
        return NextResponse.json(
            { error: 'Failed to revalidate' },
            { status: 500 }
        )
    }
}
