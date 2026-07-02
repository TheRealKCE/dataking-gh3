import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, verifyAdminAuth } from '@/lib/classifieds-auth'
import { getVerificationRequests } from '@/lib/classifieds-queries'

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')
        const userId = await verifyAuth(token)

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const isAdmin = await verifyAdminAuth(userId)
        if (!isAdmin) {
            return NextResponse.json({ error: 'Only admins can view verification requests' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status') || undefined

        const requests = await getVerificationRequests(status)

        return NextResponse.json({
            requests,
            total: requests.length,
        })
    } catch (error: any) {
        console.error('Get verification requests API error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to fetch verification requests' },
            { status: 500 }
        )
    }
}
