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
        const { shopId, items } = body

        if (!shopId || !items || !Array.isArray(items)) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
        }

        // Verify shop ownership
        const { data: shopProfile, error: shopError } = await supabase
            .from('shop_profiles')
            .select('user_id, owner_role')
            .eq('id', shopId)
            .single()

        if (shopError || !shopProfile || shopProfile.user_id !== session.user.id) {
            return NextResponse.json({ error: 'Unauthorized to modify this shop' }, { status: 403 })
        }

        const maxProfit = shopProfile.owner_role === 'agent' ? 10 : 5

        // Strict Backend Validation
        for (const item of items) {
            if (item.profit_margin === undefined || item.profit_margin === null) {
                return NextResponse.json({ error: 'Missing profit margin' }, { status: 400 })
            }
            if (item.profit_margin <= 0) {
                return NextResponse.json({ error: 'Profit must be more than 0' }, { status: 400 })
            }
            if (item.profit_margin > maxProfit) {
                return NextResponse.json({ error: `Profit cannot exceed GHS ${maxProfit.toFixed(2)}` }, { status: 400 })
            }
            
            // Validate the item format minimally
            if (!item.package_id || !item.selling_price) {
                return NextResponse.json({ error: 'Invalid payload format' }, { status: 400 })
            }
            
            // Ensure shop_id is correctly mapped and un-tampered
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

        // Insert new pricing capturing profit_margin explicitly
        const { error: insertError } = await supabase
            .from('shop_pricing')
            .insert(items)

        if (insertError) {
            return NextResponse.json({ error: 'Failed to insert pricing data' }, { status: 500 })
        }

        // Instantly make the shop live without needing admin review
        const { error: updateError } = await supabase
            .from('shop_profiles')
            .update({
                pricing_status: 'approved',
                approval_status: 'approved',
                pricing_submitted_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
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
