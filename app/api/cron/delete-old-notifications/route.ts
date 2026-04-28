import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { areCronJobsEnabled, cronDisabledResponse } from '@/lib/cron-control'

export async function GET(request: NextRequest) {
    if (!areCronJobsEnabled()) return cronDisabledResponse()

    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient()

    try {
        // Calculate date 30 days ago
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        // Delete notifications older than 30 days
        const { data, error, count } = await (supabase
            .from('notifications') as any)
            .delete()
            .lt('created_at', thirtyDaysAgo.toISOString())
            .select('id', { count: 'exact' })

        if (error) throw error

        console.log(`Deleted ${count || 0} notifications older than 30 days`)

        return NextResponse.json({
            success: true,
            deleted: count || 0,
            cutoffDate: thirtyDaysAgo.toISOString()
        })
    } catch (error) {
        console.error('Cron delete-old-notifications error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
