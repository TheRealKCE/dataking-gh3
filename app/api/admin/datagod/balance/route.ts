import { NextResponse } from 'next/server'
import { fetchDataGodBalance } from '@/lib/datagod-service'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET() {
    try {
        const cookieStore = await cookies()
        const supabase = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore
        })
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: dbUser } = await (supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single() as any)

        if (dbUser?.role !== 'admin') {
            return NextResponse.json({ error: 'Admin only' }, { status: 403 })
        }

        const result = await fetchDataGodBalance()

        if (!result.success) {
            return NextResponse.json({
                error: result.error
            }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            balance: result.balance,
            currency: result.currency || 'GHS',
            username: result.username,
            role: result.role
        })

    } catch (error: any) {
        return NextResponse.json({
            error: error.message
        }, { status: 500 })
    }
}
