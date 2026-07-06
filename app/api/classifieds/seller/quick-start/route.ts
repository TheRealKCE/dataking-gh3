import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createServerClient } from '@/lib/supabase'
import { sendSMS } from '@/lib/sms-service'
import { validateGhanaianPhone } from '@/lib/phone-validation'

/**
 * Login-less seller onboarding.
 *
 * Takes only a phone number and silently provisions (or re-uses) an invisible
 * Supabase account keyed to that phone, marks the user as a seller, sends a
 * welcome SMS, and returns one-time credentials so the client can establish a
 * session via signInWithPassword. The phone is NOT ownership-verified (product
 * decision) — see the plan's security notes.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}))
        const { phone_number } = body ?? {}

        // 1. Validate + normalize the Ghana phone number
        const validation = validateGhanaianPhone(phone_number || '')
        if (!validation.isValid) {
            return NextResponse.json(
                { error: validation.error || 'Invalid phone number' },
                { status: 400 }
            )
        }
        const normalized = validation.normalizedNumber // 0XXXXXXXXX
        const intl = '233' + normalized.slice(1) // 233XXXXXXXXX
        const pseudoEmail = `seller_${intl}@sellers.arhmsgh.com`
        const password = `${randomUUID()}${randomUUID()}`

        const supabase = createServerClient()

        // 2. Find an existing invisible account for this phone (public.users mirrors auth.users via trigger)
        const { data: existing } = await supabase
            .from('users')
            .select('id, first_name')
            .eq('email', pseudoEmail)
            .maybeSingle()

        let userId = existing?.id ?? null
        let firstName = existing?.first_name || 'Seller'

        if (userId) {
            // Returning phone → rotate the password so we can hand the client a working credential
            const { error: updErr } = await supabase.auth.admin.updateUserById(userId, { password })
            if (updErr) {
                console.error('[QuickStart] updateUserById error:', updErr.message)
                return NextResponse.json({ error: 'Could not start seller session' }, { status: 500 })
            }
        } else {
            // New phone → create the invisible auth account (trigger inserts the public.users row)
            const { data: created, error: createErr } = await supabase.auth.admin.createUser({
                email: pseudoEmail,
                password,
                email_confirm: true,
                user_metadata: { first_name: 'Seller', phone_number: normalized },
            })

            if (createErr || !created?.user) {
                // Handle a race where the account was created between the lookup and now
                const { data: raced } = await supabase
                    .from('users')
                    .select('id, first_name')
                    .eq('email', pseudoEmail)
                    .maybeSingle()

                if (raced?.id) {
                    userId = raced.id
                    firstName = raced.first_name || 'Seller'
                    await supabase.auth.admin.updateUserById(userId, { password })
                } else {
                    console.error('[QuickStart] createUser error:', createErr?.message)
                    return NextResponse.json({ error: 'Could not create seller account' }, { status: 500 })
                }
            } else {
                userId = created.user.id
            }
        }

        // 3. Mark seller + store phone on the public.users row
        const { error: sellerErr } = await supabase
            .from('users')
            .update({ is_seller: true, phone_number: normalized })
            .eq('id', userId)

        if (sellerErr) {
            console.error('[QuickStart] Failed to set is_seller:', sellerErr.message)
            return NextResponse.json({ error: 'Could not enable seller status' }, { status: 500 })
        }

        // 4. Welcome SMS (non-fatal)
        const welcomeMessage = `Welcome ${firstName}! 🎉 You are now a seller on ARHMS MARKETPLACE. Start posting items to reach buyers. Visit: arhmsgh.com`
        const smsResult = await sendSMS({ recipient: normalized, message: welcomeMessage })
        if (!smsResult.success) {
            console.warn('[QuickStart] SMS failed (seller still enabled):', smsResult.error)
        }

        // 5. Hand back one-time credentials for the client to sign in with
        return NextResponse.json({ email: pseudoEmail, password }, { status: 200 })
    } catch (error: any) {
        console.error('[QuickStart] Exception:', error?.message)
        return NextResponse.json(
            { error: error?.message || 'Failed to start selling' },
            { status: 500 }
        )
    }
}
