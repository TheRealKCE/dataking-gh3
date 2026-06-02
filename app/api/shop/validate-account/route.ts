import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { validateAccountName, MOOLRE_CHANNEL_MAP } from '@/lib/moolre-transfer-service'
import { phoneSchema } from '@/lib/validation'

const validateSchema = z.object({
    phone: z.string().min(8, 'Number is too short').max(30, 'Number is too long').regex(/^\d+$/, 'Must contain only digits'),
    network: z.string().min(1, 'Network is required'),
    bankId: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.network !== 'Bank') {
        if (!phoneSchema.safeParse(data.phone).success) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['phone'],
                message: 'Must be a valid Ghanaian MoMo number (e.g. 0241234567)'
            })
        }
    }
})

export async function POST(req: NextRequest) {
    try {
        // 1. Auth check — only authenticated shop owners/agents
        const cookieStore = await cookies()
        const supabase = createRouteHandlerClient({ cookies: () => cookieStore as any })
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { data: dbUser } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()

        const allowedRoles = ['customer', 'agent', 'dealer', 'admin', 'sub-admin']
        if (!dbUser || !allowedRoles.includes(dbUser.role)) {
            return NextResponse.json({ error: 'Forbidden. Only approved shop owners can withdraw.' }, { status: 403 })
        }

        // 2. Validate input shape
        const body = await req.json()
        const parsed = validateSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid request', details: parsed.error.errors.map(e => e.message) },
                { status: 400 }
            )
        }

        const { phone, network, bankId } = parsed.data

        // 3. Map network string to Moolre channel ID
        const channel = MOOLRE_CHANNEL_MAP[network]
        if (channel === undefined) {
            return NextResponse.json({ error: `Unsupported network: ${network}` }, { status: 400 })
        }

        // 4. Validate with Moolre
        const result = await validateAccountName(phone, channel, bankId)

        if (!result.success || !result.name) {
            return NextResponse.json(
                { success: false, error: result.error || 'Could not verify account name' },
                { status: 200 } // Return 200 so client handles it as a validation failure, not a crash
            )
        }

        // 5. Return only the verified name — never the raw Moolre response
        return NextResponse.json({ success: true, name: result.name })

    } catch (error: any) {
        console.error('[validate-account API]', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
