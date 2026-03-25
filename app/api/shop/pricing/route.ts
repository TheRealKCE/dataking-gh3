import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
    try {
        const supabase = createRouteHandlerClient({ cookies })
        
        // Ensure user is authenticated
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { shopId, items, airtimeFees } = body

        if (!shopId) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
        }

        // Verify shop ownership
        const { data: shopProfile, error: shopError } = await supabase
            .from('shop_profiles')
            .select('owner_id')
            .eq('id', shopId)
            .single()

        if (shopError || !shopProfile || shopProfile.owner_id !== session.user.id) {
            return NextResponse.json({ error: 'Unauthorized to modify this shop' }, { status: 403 })
        }

        const { data: userData } = await supabase.from('users').select('role').eq('id', shopProfile.owner_id).single()
        const userRole = userData?.role || 'customer'
        const maxDataProfit = userRole === 'agent' ? 10 : 5

        // Fetch Admin Settings to properly calculate Airtime caps
        const { data: adminSettingsData } = await supabase.from('admin_settings').select('key, value')
        const adminSettings: Record<string, string> = {}
        for (const row of adminSettingsData || []) adminSettings[row.key] = String(row.value)

        // Strict Backend Validation for Data Packages
        if (items && Array.isArray(items)) {
            for (const item of items) {
                if (item.profit_margin === undefined || item.profit_margin === null) {
                    return NextResponse.json({ error: 'Missing profit margin' }, { status: 400 })
                }
                if (item.profit_margin <= 0) {
                    return NextResponse.json({ error: 'Profit must be more than 0' }, { status: 400 })
                }
                if (item.profit_margin > maxDataProfit) {
                    return NextResponse.json({ error: `Profit cannot exceed GHS ${maxDataProfit.toFixed(2)}` }, { status: 400 })
                }
                
                if (!item.package_id || !item.selling_price) {
                    return NextResponse.json({ error: 'Invalid payload format' }, { status: 400 })
                }
                
                item.shop_id = shopId
            }

            // Clear existing pricing to prevent duplicates
            const { error: deleteError } = await supabase
                .from('shop_pricing')
                .delete()
                .eq('shop_id', shopId)

            if (deleteError) {
                return NextResponse.json({ error: 'Failed to clear previous pricing data' }, { status: 500 })
            }

            // Insert new pricing capturing profit_margin explicitly if elements exist
            if (items.length > 0) {
                const { error: insertError } = await supabase
                    .from('shop_pricing')
                    .insert(items)

                if (insertError) {
                    return NextResponse.json({ error: 'Failed to insert pricing data' }, { status: 500 })
                }
            }
        }

        // Secure Airtime Fee calculations & clamping strictly bounding at MAX 10% including admin baseline
        let airtimeUpdates: any = {}
        if (airtimeFees) {
            for (const net of ['mtn', 'telecel', 'at']) {
                if (airtimeFees[net] !== undefined) {
                    let fee = parseFloat(airtimeFees[net])
                    if (isNaN(fee) || fee < 0) fee = 0

                    const adminFeeKey = `airtime_fee_${net}_${userRole}`
                    const baseAdminFeeString = adminSettings[adminFeeKey] || '0'
                    const baseAdminFee = parseFloat(baseAdminFeeString)

                    const maxAllowedFee = Math.max(0, 10 - baseAdminFee)
                    if (fee > maxAllowedFee) fee = maxAllowedFee

                    airtimeUpdates[`airtime_fee_${net}`] = fee
                }
            }
        }

        // Instantly make the shop live and save the new airtime prices inline
        const profileUpdates = {
            pricing_status: 'approved',
            approval_status: 'approved',
            pricing_submitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...airtimeUpdates
        }

        const { error: updateError } = await supabase
            .from('shop_profiles')
            .update(profileUpdates)
            .eq('id', shopId)

        if (updateError) {
            return NextResponse.json({ error: 'Pricing saved but failed to update shop status' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('Pricing API Error:', err)
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
    }
}
