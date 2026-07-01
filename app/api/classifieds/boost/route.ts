import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAuth } from '@/lib/classifieds-auth'
import { getListingById, updateListing } from '@/lib/classifieds-queries'
import type { Database } from '@/types/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const TIER_DAYS: Record<string, number> = {
    '7d': 7,
    '14d': 14,
    '21d': 21,
    '30d': 30,
    '60d': 60,
    '90d': 90,
}

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')
        const userId = await verifyAuth(token)

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { listing_id, tier } = body

        if (!listing_id || !tier) {
            return NextResponse.json(
                { error: 'Missing listing_id or tier' },
                { status: 400 }
            )
        }

        if (!TIER_DAYS[tier]) {
            return NextResponse.json(
                { error: 'Invalid tier. Valid values: 7d, 14d, 21d, 30d, 60d, 90d' },
                { status: 400 }
            )
        }

        // Verify listing exists and belongs to the seller
        const listing = await getListingById(listing_id)
        if (!listing) {
            return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
        }

        if (listing.seller_id !== userId) {
            return NextResponse.json(
                { error: 'You can only boost your own listings' },
                { status: 403 }
            )
        }

        // Create Supabase client with service role (for admin operations)
        const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

        // Fetch boost fee from admin_settings
        const { data: feeSettings } = await supabase
            .from('admin_settings')
            .select('value')
            .eq('key', `classifieds_boost_fee_${tier}`)
            .single()

        const boostFee = feeSettings ? parseFloat(String(feeSettings.value)) : 0

        if (boostFee <= 0) {
            return NextResponse.json(
                { error: 'Boost pricing not configured by admin' },
                { status: 400 }
            )
        }

        // Debit wallet
        const { data: deductResult, error: deductError } = await supabase.rpc('deduct_wallet_balance', {
            p_user_id: userId,
            p_amount: boostFee,
        })

        if (deductError) {
            if (deductError.message?.includes('INSUFFICIENT_BALANCE')) {
                return NextResponse.json(
                    { error: 'Insufficient wallet balance. Top up your wallet first.' },
                    { status: 400 }
                )
            }
            throw deductError
        }

        // Calculate boost end date
        const now = new Date()
        const endsAt = new Date(now.getTime() + TIER_DAYS[tier] * 24 * 60 * 60 * 1000)

        // Insert boost record
        const { error: boostError } = await supabase
            .from('classified_boosts')
            .insert({
                listing_id,
                seller_id: userId,
                tier,
                amount_paid: boostFee,
                starts_at: now.toISOString(),
                ends_at: endsAt.toISOString(),
            })

        if (boostError) throw boostError

        // Update listing with boost info
        await updateListing(listing_id, {
            is_boosted: true,
            boosted_until: endsAt.toISOString(),
            boost_tier: tier,
        } as any)

        // Log wallet transaction
        const { error: txError } = await supabase
            .from('wallet_transactions')
            .insert({
                wallet_id: (deductResult as any)?.wallet_id,
                user_id: userId,
                type: 'debit',
                amount: boostFee,
                description: `Listing boost – ${tier}`,
                source: 'purchase',
                status: 'completed',
            } as any)

        if (txError) console.error('Transaction logging error:', txError)

        return NextResponse.json({
            success: true,
            boosted_until: endsAt.toISOString(),
            amount_paid: boostFee,
            message: `Listing boosted for ${TIER_DAYS[tier]} days!`,
        })
    } catch (error: any) {
        console.error('Boost API error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to boost listing' },
            { status: 500 }
        )
    }
}
