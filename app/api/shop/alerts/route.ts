import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import {
    sendShopPricingApprovedSMS,
    sendShopPricingRejectedSMS,
    sendShopProfileApprovedSMS,
    sendShopProfileRejectedSMS,
    sendShopWithdrawalProcessedSMS,
    sendShopWithdrawalRejectedSMS,
} from '@/lib/sms-service'
import {
    sendShopPricingApprovedEmail,
    sendShopPricingRejectedEmail,
    sendShopProfileApprovedEmail,
    sendShopProfileRejectedEmail,
    sendShopWithdrawalProcessedEmail,
    sendShopWithdrawalRejectedEmail,
    sendAdminShopPricingSubmissionAlert,
    sendAdminNewShopRegistrationAlert,
    sendAdminShopWithdrawalRequestAlert,
} from '@/lib/email-service'

export async function POST(req: NextRequest) {
    try {
        // Auth check — must be a signed-in user with an elevated role
        const cookieStore = await cookies()
        const supabase = await createRouteHandlerClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // Role check — only admins, sub-admins, and agents (shop owners) can fire alerts
        const { data: dbUser } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()

        const allowedRoles = ['admin', 'sub-admin', 'agent']
        if (!dbUser || !allowedRoles.includes(dbUser.role)) {
            return NextResponse.json({ error: 'Forbidden: insufficient role' }, { status: 403 })
        }

        const body = await req.json()
        const { type, payload } = body

        if (!type || !payload) {
            return NextResponse.json({ error: 'Missing type or payload' }, { status: 400 })
        }

        let smsResult, emailResult

        switch (type) {

            // ── Alert 3: Pricing Approved ──────────────────────────────
            case 'pricing_approved': {
                const { phone, firstName, email, shopName } = payload
                    ;[smsResult, emailResult] = await Promise.allSettled([
                        sendShopPricingApprovedSMS(phone, firstName),
                        sendShopPricingApprovedEmail(email, firstName, shopName),
                    ])
                break
            }

            // ── Alert 4: Pricing Rejected ──────────────────────────────
            case 'pricing_rejected': {
                const { phone, firstName, email, shopName, reason } = payload
                    ;[smsResult, emailResult] = await Promise.allSettled([
                        sendShopPricingRejectedSMS(phone, firstName, reason),
                        sendShopPricingRejectedEmail(email, firstName, shopName, reason),
                    ])
                break
            }

            // ── Alert 5: Shop Profile Approved ─────────────────────────
            case 'profile_approved': {
                const { phone, firstName, email, shopName } = payload
                    ;[smsResult, emailResult] = await Promise.allSettled([
                        sendShopProfileApprovedSMS(phone, shopName),
                        sendShopProfileApprovedEmail(email, firstName, shopName),
                    ])
                break
            }

            // ── Alert 6: Shop Profile Rejected ─────────────────────────
            case 'profile_rejected': {
                const { phone, firstName, email, shopName, reason } = payload
                    ;[smsResult, emailResult] = await Promise.allSettled([
                        sendShopProfileRejectedSMS(phone, firstName, reason || 'Please check your dashboard for details.'),
                        sendShopProfileRejectedEmail(email, firstName, shopName, reason || 'Please check your dashboard for details.'),
                    ])
                break
            }

            // ── Alert 7: Withdrawal Processed (owner) ──────────────────
            case 'withdrawal_processed': {
                const { phone, firstName, email, shopName, amount, momoNumber, network } = payload
                    ;[smsResult, emailResult] = await Promise.allSettled([
                        sendShopWithdrawalProcessedSMS(phone, firstName, amount, network, momoNumber),
                        sendShopWithdrawalProcessedEmail(email, firstName, shopName, amount, momoNumber, network),
                    ])
                break
            }

            // ── Alert 7b: Withdrawal Rejected (owner) ──────────────────
            case 'withdrawal_rejected': {
                const { phone, firstName, email, shopName, amount, adminNote } = payload
                    ;[smsResult, emailResult] = await Promise.allSettled([
                        sendShopWithdrawalRejectedSMS(phone, firstName),
                        sendShopWithdrawalRejectedEmail(email, firstName, shopName, amount, adminNote),
                    ])
                break
            }

            // ── Alert 9: New Pricing Submission (admin) ────────────────
            case 'admin_pricing_submission': {
                emailResult = await sendAdminShopPricingSubmissionAlert(payload)
                break
            }

            // ── Alert 10: New Shop Registration (admin) ────────────────
            case 'admin_new_shop': {
                emailResult = await sendAdminNewShopRegistrationAlert(payload)
                break
            }

            // ── Alert 11: Withdrawal Request (admin) ───────────────────
            case 'admin_withdrawal_request': {
                emailResult = await sendAdminShopWithdrawalRequestAlert(payload)
                break
            }

            default:
                return NextResponse.json({ error: `Unknown alert type: ${type}` }, { status: 400 })
        }

        return NextResponse.json({ success: true, smsResult, emailResult })

    } catch (err: any) {
        console.error('[Shop Alerts API]', err)
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
    }
}
