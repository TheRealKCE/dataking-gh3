import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

// ── Allowlists & validation constants ──────────────────────────────────────
const VALID_ID_TYPES = ['Ghana Card', 'Passport', "Driver's License", 'Voter ID'] as const

const VALID_REGIONS = [
    'Greater Accra', 'Ashanti', 'Western', 'Eastern', 'Central', 'Northern',
    'Volta', 'Upper East', 'Upper West', 'Bono', 'Bono East', 'Ahafo',
    'Savannah', 'North East', 'Oti', 'Western North',
] as const

// Mirrors the patterns in the frontend's ID_PATTERNS constant (page.tsx)
const ID_FORMAT_PATTERNS: Record<string, { pattern: RegExp; hint: string }> = {
    'Ghana Card':       { pattern: /^GHA-\d{9}-\d$/,  hint: 'GHA-XXXXXXXXX-X'  },
    'Passport':         { pattern: /^[A-Z]\d{7}$/,    hint: '[A-Z]XXXXXXX'     },
    "Driver's License": { pattern: /^DVLA-\d{10}$/,   hint: 'DVLA-XXXXXXXXXX'  },
    'Voter ID':         { pattern: /^\d{10}$/,         hint: '10 numeric digits' },
}

// Maximum character lengths per field (protects against oversized DB payloads)
// Finding 3 fix: id_type and region now explicitly capped
const FIELD_MAX_LENGTHS: Record<string, number> = {
    full_name: 100,
    phone:     20,
    id_number: 20,
    id_type:   50,
    region:    100,
    location:  100,
    notes:     500,
}

export async function POST(request: NextRequest) {
    try {
        // ── 2A: Authenticate user ──────────────────────────────────
        const cookieStore = await cookies()
        const supabaseUserClient = await createRouteHandlerClient()

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

        // Finding 8 fix — referenceCode length cap (legitimate UUIDs are 36 chars)
        if (referenceCode.length > 100) {
            return NextResponse.json({ error: 'Invalid reference code.' }, { status: 400 })
        }

        if (!formData || typeof formData !== 'object') {
            return NextResponse.json({ error: 'Missing form data' }, { status: 400 })
        }

        // ── Presence check on required fields ─────────────────────
        const requiredFields = ['full_name', 'phone', 'id_type', 'id_number', 'location', 'region', 'date_of_birth']
        for (const field of requiredFields) {
            if (!formData[field] || String(formData[field]).trim() === '') {
                return NextResponse.json(
                    { error: `Missing required field: ${field}` },
                    { status: 400 }
                )
            }
        }

        // ── Field length caps (Finding 3b + Finding 3 extension) ───
        // Runs before allowlist checks — oversized id_type/region rejected here first
        for (const [field, maxLen] of Object.entries(FIELD_MAX_LENGTHS)) {
            const val = formData[field]
            if (val && String(val).length > maxLen) {
                return NextResponse.json(
                    { error: `Field "${field}" exceeds maximum length of ${maxLen} characters.` },
                    { status: 400 }
                )
            }
        }

        // ── ID type allowlist (Finding 3a) ─────────────────────────
        if (!(VALID_ID_TYPES as readonly string[]).includes(formData.id_type)) {
            return NextResponse.json(
                { error: `Invalid ID type. Must be one of: ${VALID_ID_TYPES.join(', ')}.` },
                { status: 400 }
            )
        }

        // ── Region allowlist (Finding 3a) ──────────────────────────
        if (!(VALID_REGIONS as readonly string[]).includes(formData.region)) {
            return NextResponse.json(
                { error: 'Invalid region. Must be one of the supported Ghana regions.' },
                { status: 400 }
            )
        }

        // ── ID number format validation per id_type (Finding 4 — fail-closed) ──
        // If id_type passed the allowlist but has no pattern entry, fail closed with 500.
        // This prevents silent bypass if a new id_type is added to VALID_ID_TYPES
        // without a corresponding entry in ID_FORMAT_PATTERNS.
        const idConfig = ID_FORMAT_PATTERNS[formData.id_type as string]
        if (!idConfig) {
            console.error(`[AFA Registration] No format pattern configured for id_type: "${formData.id_type}"`)
            return NextResponse.json(
                { error: 'ID type validation is not configured. Please contact support.' },
                { status: 500 }
            )
        }
        if (!idConfig.pattern.test(String(formData.id_number).trim())) {
            return NextResponse.json(
                { error: `Invalid ID number format for the selected ID type. Expected format: ${idConfig.hint}` },
                { status: 400 }
            )
        }

        // ── Validate Date of Birth (at least 18 years old) ─────────
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

        // ── 2B: Fetch user role ────────────────────────────────────
        const { data: userRow } = await (supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', userId)
            .single() as any)

        const userRole = (userRow as any)?.role || 'customer'

        // ── 2C: Fetch price server-side using service role (bypasses RLS) ──
        // Uses supabaseAdmin so RLS on admin_settings cannot block the read.
        // Mirrors the exact pattern from app/api/user/upgrade/initialize/route.ts.
        const { createClient } = await import('@supabase/supabase-js')
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                }
            }
        )

        const { data: settingsData, error: settingsError } = await supabaseAdmin
            .from('admin_settings')
            .select('key, value')
            .in('key', ['afa_price_customer', 'afa_price_agent', 'afa_price_dealer'])

        if (settingsError) {
            console.error('[AFA Registration] Failed to fetch pricing settings:', settingsError)
            return NextResponse.json(
                { error: 'Registration pricing is not configured. Please contact support.' },
                { status: 500 }
            )
        }

        const settingsMap: Record<string, string> = ((settingsData || []) as any[]).reduce(
            (acc: Record<string, string>, row: any) => {
                acc[row.key] = row.value
                return acc
            },
            {}
        )

        const priceKey = userRole === 'agent' ? 'afa_price_agent' : userRole === 'dealer' ? 'afa_price_dealer' : 'afa_price_customer'
        const rawPrice = settingsMap[priceKey]

        if (!rawPrice) {
            console.error(`[AFA Registration] Price key "${priceKey}" not found in admin_settings`)
            return NextResponse.json(
                { error: 'Registration pricing is not configured. Please contact support.' },
                { status: 500 }
            )
        }

        const price = parseFloat(rawPrice)

        if (isNaN(price) || price <= 0) {
            console.error(`[AFA Registration] Price key "${priceKey}" has invalid value: "${rawPrice}"`)
            return NextResponse.json(
                { error: 'Registration pricing is not configured. Please contact support.' },
                { status: 500 }
            )
        }

        // ── 2D: Call atomic RPC ───────────────────────────────────
        const { data: rpcResult, error: rpcError } = await (supabaseUserClient as any).rpc(
            'process_afa_order',
            {
                p_user_id:        userId,
                p_amount:         price,
                p_form_data:      formData,
                p_reference_code: referenceCode,
            }
        )

        // ── 2E: Handle errors ─────────────────────────────────────
        if (rpcError) {
            // Graceful duplicate: unique constraint violation (Postgres code 23505)
            if (
                rpcError.code === '23505' ||
                rpcError.message?.includes('afa_orders_reference_code_unique') ||
                rpcError.message?.includes('duplicate key')
            ) {
                // Ownership enforced via both referenceCode AND userId (Finding 9 fix)
                const { data: existingOrder, error: duplicateError } = await (supabaseUserClient
                    .from('afa_orders')
                    .select('id, status, payment_amount')
                    .eq('reference_code', referenceCode)
                    .eq('user_id', userId)
                    .single() as any)

                // Finding 7 fix — log ownership mismatch instead of silently returning null
                if (duplicateError) {
                    console.warn(
                        '[AFA Registration] Duplicate reference code but no matching order for user:',
                        userId,
                        duplicateError.code
                    )
                }

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

        // ── 2F: Send Admin Notification (Asynchronous) ──────────────
        try {
            // Find main admins to notify (excluding sub_admin)
            const { data: adminUsers } = await supabaseUserClient
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
