import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { generateReferenceCode, calculatePaystackFee } from '@/lib/utils'

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies()
        const supabase = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore
        })
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError || !session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const user = session.user

        // Check if user is already an agent or admin
        const { data: dbUser } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()

        if (dbUser?.role !== 'customer') {
            return NextResponse.json(
                { error: 'Only customers can upgrade to agent status' },
                { status: 400 }
            )
        }

        // Fetch upgrade price from admin settings
        const { data: settingData } = await supabase
            .from('admin_settings')
            .select('value')
            .eq('key', 'agent_upgrade_price')
            .single()

        const upgradePrice = settingData?.value ? Number(settingData.value) : 100
        const fee = calculatePaystackFee(upgradePrice)
        const totalAmount = upgradePrice + fee

        // Initialize Paystack payment
        const reference = `agent_upgrade_${generateReferenceCode()}`

        const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: user.email,
                amount: Math.round(totalAmount * 100), // Convert to pesewas
                reference,
                metadata: {
                    user_id: user.id,
                    upgrade_type: 'agent',
                    base_amount: upgradePrice,
                    fee: fee,
                },
                callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
            }),
        })

        if (!paystackResponse.ok) {
            throw new Error('Failed to initialize payment')
        }

        const paystackData = await paystackResponse.json()

        return NextResponse.json({
            authorization_url: paystackData.data.authorization_url,
            reference,
        })
    } catch (error: any) {
        console.error('Error initializing agent upgrade:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to initialize upgrade' },
            { status: 500 }
        )
    }
}
