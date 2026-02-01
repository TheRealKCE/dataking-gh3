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

        const { plan = '30d' } = await request.json().catch(() => ({}));
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

        // Fetch upgrade prices from admin settings
        const { data: settings } = await supabase
            .from('admin_settings')
            .select('*')

        const getPrice = (key: string, def: number) => {
            const s = settings?.find((s: any) => s.key === key);
            return s ? Number(s.value) : def;
        };

        let upgradePrice = 100;
        let planLabel = 'Agent Status';

        if (plan === '3d') {
            upgradePrice = getPrice('agent_upgrade_price_3d', 9.99);
            planLabel = '3 Days Agent Pass';
        } else if (plan === '14d') {
            upgradePrice = getPrice('agent_upgrade_price_14d', 49.99);
            planLabel = '14 Days Agent Pass';
        } else {
            upgradePrice = getPrice('agent_upgrade_price_30d', 99.99);
            planLabel = '30 Days Agent Pass';
        }

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
                    plan_type: plan,
                    plan_label: planLabel,
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
