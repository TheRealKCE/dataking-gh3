import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
    try {
        // ── 2A: Authenticate user ──────────────────────────────────
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore,
        })

        const { data: { user: authUser }, error: authError } = await supabaseUserClient.auth.getUser()

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = authUser.id

        // ── Parse request body ────────────────────────────────────
        let body: any
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }

        const { referenceCode, formData } = body

        if (!referenceCode || typeof referenceCode !== 'string') {
            return NextResponse.json({ error: 'Missing referenceCode' }, { status: 400 })
        }

        if (!formData || typeof formData !== 'object') {
            return NextResponse.json({ error: 'Missing form data' }, { status: 400 })
        }

        // Validate required form fields
        const requiredFields = ['full_name', 'phone', 'id_type', 'id_number', 'location', 'region', 'date_of_birth']
        for (const field of requiredFields) {
            if (!formData[field] || String(formData[field]).trim() === '') {
                return NextResponse.json(
                    { error: `Missing required field: ${field}` },
                    { status: 400 }
                )
            }
        }

        // Validate Date of Birth (at least 18 years old)
        const dob = new Date(formData.date_of_birth)
        if (isNaN(dob.getTime())) {
            return NextResponse.json({ error: 'Invalid Date of Birth format' }, { status: 400 })
        }
        
        const today = new Date()
        let age = today.getFullYear() - dob.getFullYear()
        const monthDiff = today.getMonth() - dob.getMonth()
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
            age--
        }
        
        if (age < 18) {
            return NextResponse.json({ error: 'Applicant must be at least 18 years of age.' }, { status: 400 })
        }

        // ── 2B: Fetch price server-side (prevents amount: 0 exploits) ──
        // Reuse the already-authenticated client — no service role needed here
        const supabase = supabaseUserClient

        const { data: userRow } = await (supabase
            .from('users')
            .select('role')
            .eq('id', userId)
            .single() as any)

        const userRole = (userRow as any)?.role || 'customer'

        const { data: settingsData } = await (supabase
            .from('admin_settings')
            .select('key, value')
            .in('key', ['afa_price_customer', 'afa_price_agent']) as any)

        const settingsMap: Record<string, string> = ((settingsData || []) as any[]).reduce(
            (acc: Record<string, string>, row: any) => {
                acc[row.key] = row.value
                return acc
            },
            {}
        )

        const rawPrice = userRole === 'agent'
            ? settingsMap['afa_price_agent']
            : settingsMap['afa_price_customer']

        const amount = parseFloat(rawPrice || '15')
        const price = isNaN(amount) ? 15 : amount

        // ── 2C: Call atomic RPC ───────────────────────────────────
        const { data: rpcResult, error: rpcError } = await (supabase as any).rpc(
            'process_afa_order',
            {
                p_user_id:        userId,
                p_amount:         price,
                p_form_data:      formData,
                p_reference_code: referenceCode,
            }
        )

        // ── 2D: Handle errors ─────────────────────────────────────
        if (rpcError) {
            // Graceful duplicate: unique constraint violation (Postgres code 23505)
            if (
                rpcError.code === '23505' ||
                rpcError.message?.includes('afa_orders_reference_code_unique') ||
                rpcError.message?.includes('duplicate key')
            ) {
                // Fetch the existing order and return success
                const { data: existingOrder } = await (supabase
                    .from('afa_orders')
                    .select('id, status, payment_amount')
                    .eq('reference_code', referenceCode)
                    .single() as any)

                return NextResponse.json({
                    success:     true,
                    isDuplicate: true,
                    order_id:    (existingOrder as any)?.id ?? null,
                })
            }

            // Insufficient balance
            if (rpcError.message?.includes('INSUFFICIENT_BALANCE')) {
                return NextResponse.json(
                    { error: 'INSUFFICIENT_BALANCE' },
                    { status: 400 }
                )
            }

            // Wallet not found
            if (rpcError.message?.includes('WALLET_NOT_FOUND')) {
                return NextResponse.json(
                    { error: 'Wallet not found' },
                    { status: 404 }
                )
            }

            console.error('[AFA Registration] RPC error:', rpcError)
            return NextResponse.json(
                { error: 'Failed to process registration' },
                { status: 500 }
            )
        }

        // ── 2E: Send Admin Notification (Asynchronous) ──────────────
        try {
            // Find main admins to notify (excluding sub_admin)
            const { data: adminUsers } = await supabase
                .from('users')
                .select('email')
                .eq('role', 'admin')

            // Create a unique set of recipients (DB Admins + Env Fallback)
            const recipients = new Set<string>()
            if (process.env.ADMIN_EMAIL) recipients.add(process.env.ADMIN_EMAIL)

            if (adminUsers) {
                (adminUsers as any[]).forEach(u => {
                    if (u.email) recipients.add(u.email)
                })
            }

            if (recipients.size > 0) {
                const { sendAdminNewAfaApplicationAlert } = await import('@/lib/email-service')
                
                const notifyPromises = Array.from(recipients).map(email => 
                    sendAdminNewAfaApplicationAlert(
                        {
                            applicantName: formData.full_name,
                            phone: formData.phone,
                            region: formData.region
                        },
                        email
                    )
                )
                
                await Promise.allSettled(notifyPromises)
            }
        } catch (emailError) {
            console.error('[AFA Registration] Failed to send admin alert email:', emailError)
        }

        // ── Success ───────────────────────────────────────────────
        return NextResponse.json({
            success:        true,
            order_id:       rpcResult?.order_id,
            transaction_id: rpcResult?.transaction_id,
            new_balance:    rpcResult?.new_balance,
        })
    } catch (error) {
        console.error('[AFA Registration] Unexpected error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
