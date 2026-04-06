import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { creditShopProfit } from '@/lib/shop-service'
import { sendOrderSuccessSMS } from '@/lib/sms-service'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const ref = searchParams.get('ref')
    const slug = searchParams.get('slug')

    if (!ref || !slug) {
        return NextResponse.redirect(new URL(`/shop/${slug || ''}?error=invalid_ref`, request.url))
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kingflexygh.com'

    try {
        const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY
        if (!PAYSTACK_SECRET_KEY) {
            return NextResponse.redirect(new URL(`/shop/${slug}?error=payment_error`, request.url))
        }

        // 1. Verify payment with Paystack
        const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`, {
            headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}` },
        })
        const verifyData = await verifyRes.json()

        const cookieStore = await cookies()
        const supabase = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore,
        })
        const db = supabase as any

        // 2. Extract order data from metadata
        const metadata = verifyData.data?.metadata
        if (!metadata || !metadata.shop_id) {
            console.error('[Shop Verify] Missing metadata in Paystack response:', verifyData)
            return NextResponse.redirect(new URL(`/shop/${slug}?error=payment_error`, request.url))
        }

        if (verifyData.data?.status !== 'success') {
            console.error('[Shop Verify] Payment not successful:', verifyData.data?.status)
            return NextResponse.redirect(new URL(`/shop/${slug}?error=payment_failed`, request.url))
        }

        // 3. Process the order using the shared logic (Idempotent)
        const { processShopOrder } = await import('@/lib/shop-order-processor')
        const result = await processShopOrder(
            ref,
            metadata,
            verifyData.data?.amount || 0,
            slug!
        )

        if (!result.success) {
            const errorType = result.error === 'Payment amount mismatch' ? 'payment_mismatch' : 'payment_error'
            return NextResponse.redirect(new URL(`/shop/${slug}?error=${errorType}`, request.url))
        }

        return NextResponse.redirect(new URL(`/shop/${slug}/success?ref=${ref}`, request.url))

    } catch (error) {
        console.error('[Shop Verify] Error:', error)
        return NextResponse.redirect(new URL(`/shop/${slug}?error=server_error`, request.url))
    }
}

