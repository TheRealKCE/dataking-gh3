import { createServerClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization')
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        const supabase = createServerClient()

        // Calculate date 3 days ago
        const threeDaysAgo = new Date()
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

        // Delete old complaints
        const { count, error } = await (supabase
            .from('complaints') as any)
            .delete({ count: 'exact' })
            .lt('created_at', threeDaysAgo.toISOString())

        if (error) throw error

        return NextResponse.json({
            success: true,
            message: `Deleted ${count} old complaints`,
            deletedCount: count
        })
    } catch (error: any) {
        console.error('Error deleting old complaints:', error)
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        )
    }
}
