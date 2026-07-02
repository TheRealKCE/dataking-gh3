import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, verifyAdminAuth } from '@/lib/classifieds-auth'
import { reviewVerificationRequest } from '@/lib/classifieds-queries'

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')
        const userId = await verifyAuth(token)

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const isAdmin = await verifyAdminAuth(userId)
        if (!isAdmin) {
            return NextResponse.json({ error: 'Only admins can review verification requests' }, { status: 403 })
        }

        const body = await request.json()
        const { decision, rejection_reason } = body

        if (!decision || !['approved', 'rejected'].includes(decision)) {
            return NextResponse.json(
                { error: 'Decision must be either "approved" or "rejected"' },
                { status: 400 }
            )
        }

        if (decision === 'rejected' && !rejection_reason) {
            return NextResponse.json(
                { error: 'Rejection reason is required when rejecting' },
                { status: 400 }
            )
        }

        const result = await reviewVerificationRequest(
            params.id,
            userId,
            decision,
            rejection_reason
        )

        return NextResponse.json({
            success: true,
            result,
            message: `Verification request ${decision} successfully.`,
        })
    } catch (error: any) {
        console.error('Review verification API error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to review verification request' },
            { status: 500 }
        )
    }
}
