import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { generateReferenceCode } from '@/lib/utils'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { sendAirtimeBeneficiarySMS, sendAdminAirtimeAlertSMS } from '@/lib/sms-service'
import { sendAdminAirtimeOrderEmail } from '@/lib/email-service'
import { sendPushToAdmins } from '@/lib/web-push'

const NETWORK_KEY_MAP: Record<string, string> = {
    MTN: 'mtn',
    Telecel: 'telecel',
    AT: 'at',
}

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore
        })
        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = authUser.id
        const supabase = createServerClient()

        let body: any
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }

        const { beneficiaryPhone, network, amount, useExactAmount, referenceCode: clientReferenceCode, type: orderType, bundlePreference } = body

        // ── Validate required fields ──────────────────────────────────────────
        if (!beneficiaryPhone || !network || !amount) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }
        if (!['MTN', 'Telecel', 'AT'].includes(network)) {
            return NextResponse.json({ error: 'Invalid network' }, { status: 400 })
        }

        // ── Mashup is MTN-exclusive ───────────────────────────────────────────
        const resolvedType: 'airtime' | 'mashup' = orderType === 'mashup' ? 'mashup' : 'airtime'
        const resolvedPreference: 'balanced' | 'data' | 'voice' = ['balanced', 'data', 'voice'].includes(bundlePreference)
            ? bundlePreference
            : 'balanced'

        if (resolvedType === 'mashup' && network !== 'MTN') {
            return NextResponse.json({ error: 'Mashup orders are only available for MTN' }, { status: 400 })
        }

        // ── Tier 1 phone validation (hard) ────────────────────────────────────
        const cleanPhone = String(beneficiaryPhone).replace(/\s+/g, '')
        if (!/^0\d{9}$/.test(cleanPhone)) {
            return NextResponse.json({
                error: 'Invalid phone number. Use Ghana format: 0XXXXXXXXX (10 digits starting with 0)'
            }, { status: 400 })
        }

        // ── Fetch user role + check idempotency ────────────────────────────────
        const [userResult, settingsResult] = await Promise.all([
            (supabase.from('users') as any).select('role, first_name, last_name, email, phone_number').eq('id', userId).single(),
            (supabase.from('admin_settings') as any).select('key, value').in('key', [
                `airtime_enabled_${NETWORK_KEY_MAP[network]}`,
                `airtime_fee_${NETWORK_KEY_MAP[network]}_customer`,
                `airtime_fee_${NETWORK_KEY_MAP[network]}_agent`,
                'airtime_min_amount',
                'airtime_max_amount',
            ])
        ])

        if (userResult.error || !userResult.data) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const userData = userResult.data as any
        const userRole = userData.role === 'agent' ? 'agent' : 'customer'

        const settingsMap: Record<string, string> = {}
        for (const s of (settingsResult.data || [])) {
            settingsMap[s.key] = s.value
        }

        // ── Check network availability ─────────────────────────────────────────
        const networkEnabledKey = `airtime_enabled_${NETWORK_KEY_MAP[network]}`
        if (settingsMap[networkEnabledKey] === 'false') {
            return NextResponse.json({ error: `${network} airtime is currently unavailable. Please try another network.` }, { status: 400 })
        }

        // ── Validate amount ───────────────────────────────────────────────────
        const parsedAmount = parseFloat(amount)
        const minAmount = parseFloat(settingsMap['airtime_min_amount'] || '1')
        const maxAmount = parseFloat(settingsMap['airtime_max_amount'] || '500')

        if (isNaN(parsedAmount) || parsedAmount < minAmount) {
            return NextResponse.json({ error: `Minimum airtime amount is GHS ${minAmount.toFixed(2)}` }, { status: 400 })
        }
        if (parsedAmount > maxAmount) {
            return NextResponse.json({ error: `Maximum airtime amount is GHS ${maxAmount.toFixed(2)}` }, { status: 400 })
        }

        // ── Fee calculation (always server-side) ──────────────────────────────
        const feeRateKey = `airtime_fee_${NETWORK_KEY_MAP[network]}_${userRole}`
        const feeRate = parseFloat(settingsMap[feeRateKey] || '5')

        let airtimeAmount: number
        let feeAmount: number
        let totalPaid: number

        if (useExactAmount) {
            // Exact mode: user pays amount + fee, beneficiary receives exactly amount
            airtimeAmount = parsedAmount
            feeAmount = parseFloat((parsedAmount * (feeRate / 100)).toFixed(2))
            totalPaid = parseFloat((parsedAmount + feeAmount).toFixed(2))
        } else {
            // Standard mode: user pays exactly amount, beneficiary receives amount - fee
            totalPaid = parsedAmount
            feeAmount = parseFloat((parsedAmount * (feeRate / 100)).toFixed(2))
            airtimeAmount = parseFloat((parsedAmount - feeAmount).toFixed(2))
        }

        if (airtimeAmount <= 0) {
            return NextResponse.json({ error: 'Airtime amount after fees is too low' }, { status: 400 })
        }

        // ── 30-second idempotency guard ───────────────────────────────────────
        const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString()
        const { data: recentOrder } = await (supabase.from('airtime_orders') as any)
            .select('id, reference_code')
            .eq('user_id', userId)
            .eq('beneficiary_phone', cleanPhone)
            .eq('total_paid', totalPaid)
            .gte('created_at', thirtySecondsAgo)
            .maybeSingle()

        if (recentOrder) {
            return NextResponse.json({
                error: 'Duplicate order detected. Please wait 30 seconds before placing the same order again.',
                isDuplicate: true
            }, { status: 409 })
        }

        // ── Client-side idempotency (referenceCode) ───────────────────────────
        if (clientReferenceCode) {
            const { data: existingOrder } = await (supabase.from('airtime_orders') as any)
                .select('id, reference_code, status')
                .eq('reference_code', clientReferenceCode)
                .maybeSingle()

            if (existingOrder) {
                return NextResponse.json({
                    success: true,
                    isDuplicate: true,
                    order: { id: existingOrder.id, reference_code: existingOrder.reference_code, status: existingOrder.status }
                })
            }
        }

        // ── Atomic wallet deduction ───────────────────────────────────────────
        const { data: deductResult, error: deductError } = await (supabase as any)
            .rpc('deduct_wallet_balance', {
                p_user_id: userId,
                p_amount: totalPaid,
            })

        if (deductError) {
            if (deductError.message?.includes('INSUFFICIENT_BALANCE')) {
                return NextResponse.json({ error: 'Insufficient balance. Please top up your wallet.' }, { status: 400 })
            }
            console.error('[Airtime] Wallet deduction error:', deductError)
            return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 })
        }

        const walletRow = deductResult?.[0] || deductResult
        const walletId = walletRow?.wallet_id
        const newBalance = walletRow?.new_balance

        if (!walletId) {
            return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
        }

        const referenceCode = clientReferenceCode || generateReferenceCode()

        // ── Create airtime order ───────────────────────────────────────────────
        const { data: order, error: orderError } = await (supabase.from('airtime_orders') as any)
            .insert({
                user_id: userId,
                user_role: userRole,
                beneficiary_phone: cleanPhone,
                network,
                airtime_amount: airtimeAmount,
                fee_rate: feeRate,
                fee_amount: feeAmount,
                total_paid: totalPaid,
                use_exact_amount: useExactAmount || false,
                status: 'pending',
                reference_code: referenceCode,
                type: resolvedType,
                bundle_preference: resolvedType === 'mashup' ? resolvedPreference : null,
            })
            .select()
            .single()

        if (orderError) {
            console.error('[Airtime] Order creation error:', orderError)
            // Refund wallet on order creation failure
            await (supabase.from('wallets') as any)
                .update({ balance: (newBalance ?? 0) + totalPaid, updated_at: new Date().toISOString() })
                .eq('id', walletId)
            return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
        }

        // ── Wallet transaction record (fire-and-forget) ───────────────────────
        ;(supabase.from('wallet_transactions') as any).insert({
            wallet_id: walletId,
            user_id: userId,
            type: 'debit',
            amount: totalPaid,
            description: resolvedType === 'mashup'
                ? `Mashup Bundle: GHS ${airtimeAmount.toFixed(2)} for ${cleanPhone} (MTN)`
                : `Airtime: GHS ${airtimeAmount.toFixed(2)} for ${cleanPhone} (${network})`,
            reference: referenceCode,
            source: resolvedType === 'mashup' ? 'mashup' : 'airtime',
            status: 'completed',
        }).then(() => {}).catch((e: any) => console.error('[Airtime] Tx insert error:', e))

        // ── In-app notification (fire-and-forget) ─────────────────────────────
        ;(supabase.from('notifications') as any).insert({
            user_id: userId,
            title: resolvedType === 'mashup' ? 'Mashup Order Placed 🎯' : 'Airtime Order Placed',
            message: resolvedType === 'mashup'
                ? `MTN Bundle request of GHS ${airtimeAmount.toFixed(2)} for ${cleanPhone} is pending. Ref: ${referenceCode}`
                : `GHS ${airtimeAmount.toFixed(2)} airtime for ${cleanPhone} (${network}) is pending. Ref: ${referenceCode}`,
            type: 'order_update',
            action_url: '/dashboard/airtime',
        }).then(() => {}).catch((e: any) => console.error('[Airtime] Notification error:', e))

        // ── Post-order notifications (awaited to prevent Vercel from killing) ──
        try {
            // Preference code map for anti-spam SMS
            const prefCode: Record<string, string> = { balanced: 'B', data: 'D', voice: 'V' }

            // 1. Beneficiary SMS — only sent for standard airtime (not mashup)
            if (resolvedType !== 'mashup') {
                await sendAirtimeBeneficiarySMS(cleanPhone, airtimeAmount)
                    .catch((err: any) => console.error('[Airtime] Beneficiary SMS failed:', err))
            }

            // 2. Admin email alert
            await sendAdminAirtimeOrderEmail({
                referenceCode,
                userName: `${userData.first_name} ${userData.last_name}`.trim(),
                userEmail: userData.email,
                userRole,
                beneficiaryPhone: cleanPhone,
                network,
                airtimeAmount,
                feeRate,
                feeAmount,
                totalPaid,
                walletBalanceAfter: newBalance,
                useExactAmount: useExactAmount || false,
                orderType: resolvedType,
                bundlePreference: resolvedType === 'mashup' ? resolvedPreference : undefined,
            }).catch((err: any) => console.error('[Airtime] Admin email failed:', err))

            // 3. Admin push notification
            sendPushToAdmins({
                title: resolvedType === 'mashup' ? 'New Mashup Order' : 'New Airtime Order',
                body: `${`${userData.first_name} ${userData.last_name}`.trim() || 'User'} · ${network} GHS ${airtimeAmount.toFixed(2)} → ${cleanPhone}`,
                url: '/admin/airtime',
            }).catch(() => {})

            // 4. Admin SMS alert (mashup uses anti-spam title + preference code)
            try {
                const { data: admins } = await (supabase.from('users') as any)
                    .select('phone_number')
                    .eq('role', 'admin')
                const adminPhones = admins?.map((a: any) => a.phone_number).filter(Boolean) || []

                if (adminPhones.length > 0) {
                    await sendAdminAirtimeAlertSMS(adminPhones, {
                        source: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'Guest',
                        receiver: cleanPhone,
                        amount: airtimeAmount,
                        network: network,
                        orderType: resolvedType,
                        bundlePreference: resolvedType === 'mashup' ? resolvedPreference : undefined,
                    })
                }
            } catch (smsErr) {
                console.error('[Airtime] Admin SMS failed:', smsErr)
            }
        } catch (postOrderErr) {
            console.error('[Airtime] Post-order processing error:', postOrderErr)
        }

        return NextResponse.json({
            success: true,
            order: {
                id: (order as any).id,
                reference_code: referenceCode,
                status: 'pending',
                network,
                beneficiary_phone: cleanPhone,
                airtime_amount: airtimeAmount,
                fee_amount: feeAmount,
                total_paid: totalPaid,
                new_balance: newBalance,
                type: resolvedType,
                bundle_preference: resolvedType === 'mashup' ? resolvedPreference : null,
            }
        })
    } catch (error) {
        console.error('[Airtime] Unexpected error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
