import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, verifySellerAuth } from '@/lib/classifieds-auth'
import { getSellerVerificationStatus, createVerificationRequest } from '@/lib/classifieds-queries'

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')
        const userId = await verifyAuth(token)

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const isSeller = await verifySellerAuth(userId)
        if (!isSeller) {
            return NextResponse.json({ error: 'Only sellers can view verification status' }, { status: 403 })
        }

        const status = await getSellerVerificationStatus(userId)

        return NextResponse.json({
            verification: status.verification,
            verified_at: status.verified_at,
            is_verified: !!status.verified_at,
        })
    } catch (error: any) {
        console.error('Verification status API error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to fetch verification status' },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')
        const userId = await verifyAuth(token)

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const isSeller = await verifySellerAuth(userId)
        if (!isSeller) {
            return NextResponse.json({ error: 'Only sellers can request verification' }, { status: 403 })
        }

        const body = await request.json()
        const { note } = body

        const verification = await createVerificationRequest(userId, note)

        return NextResponse.json({
            success: true,
            verification,
            message: 'Verification request submitted successfully. The admin team will review it soon.',
        })
    } catch (error: any) {
        console.error('Create verification API error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to create verification request' },
            { status: error.message?.includes('pending') ? 400 : 500 }
        )
    }
}
