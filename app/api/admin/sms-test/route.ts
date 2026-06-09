import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { sendSMS } from '@/lib/sms-service'
import { z } from 'zod'

const testSchema = z.object({
    phone: z.string().min(9).max(15),
    provider: z.enum(['moolre', 'mnotify', 'auto']).optional().default('auto'),
})

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabase = createRouteHandlerClient({
            // @ts-expect-error
            cookies: () => cookieStore
        })

        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single()

        if (userData?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
        }

        let body: unknown
        try { body = await request.json() } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const parsed = testSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.errors },
                { status: 400 }
            )
        }

        const { phone, provider } = parsed.data
        const message = `[ARHMS SMS Test] Diagnostic message sent at ${new Date().toISOString()}. If you received this, SMS delivery is working. ARHMSGh`

        const result = await sendSMS({ recipient: phone, message })

        return NextResponse.json({
            success: result.success,
            provider: 'moolre',
            phone,
            messageId: result.messageId ?? null,
            error: result.error ?? null,
            timestamp: new Date().toISOString(),
        })
    } catch (error: any) {
        console.error('[SMSTest] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
