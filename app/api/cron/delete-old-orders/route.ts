import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient()

    try {
        // Calculate date 90 days ago
        const ninetyDaysAgo = new Date()
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

        // Delete orders older than 90 days
        const { data, error, count } = await (supabase
            .from('orders') as any)
            .delete()
            .lt('created_at', ninetyDaysAgo.toISOString())
            .select('id', { count: 'exact' })

        if (error) throw error

        console.log(`Deleted ${count || 0} orders older than 90 days`)

        return NextResponse.json({
            success: true,
            deleted: count || 0,
            cutoffDate: ninetyDaysAgo.toISOString()
        })
    } catch (error) {
        console.error('Cron delete-old-orders error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
