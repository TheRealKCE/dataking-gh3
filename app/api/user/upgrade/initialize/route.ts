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

        if (dbUser?.role !== 'customer' && dbUser?.role !== 'agent') {
            return NextResponse.json(
                { error: 'Membership upgrades are only available for customers and existing agents' },
                { status: 400 }
            )
        }

        // Fetch upgrade prices from admin settings using service role to bypass RLS
        const { createClient } = await import('@supabase/supabase-js')
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        const { data: settings } = await supabaseAdmin
            .from('admin_settings')
            .select('key, value')
            .in('key', ['agent_upgrade_price_3d', 'agent_upgrade_price_14d', 'agent_upgrade_price_30d', 'agent_upgrade_price_permanent'])

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
        } else if (plan === 'permanent') {
            upgradePrice = getPrice('agent_upgrade_price_permanent', 149.99);
            planLabel = 'Permanent Agent Pass';
        } else {
            upgradePrice = getPrice('agent_upgrade_price_30d', 99.99);
            planLabel = '30 Days Agent Pass';
        }


        // No fees for membership payments - customer pays exact price
        const fee = 0
        const totalAmount = upgradePrice

        // Create a pending record in wallet_payments so the webhook can find it
        const reference = `agent_upgrade_${generateReferenceCode()}`

        // Get user's wallet
        const { data: wallet } = await supabaseAdmin
            .from('wallets')
            .select('id')
            .eq('user_id', user.id)
            .single()

        if (!wallet) {
            throw new Error('User wallet not found')
        }

        const planDays = plan === 'permanent' ? null : (plan === '3d' ? 3 : (plan === '14d' ? 14 : 30))

        const { error: paymentError } = await (supabaseAdmin
            .from('wallet_payments') as any)
            .insert({
                user_id: user.id,
                wallet_id: (wallet as any).id,
                amount: upgradePrice,
                fee: 0,
                total_amount: upgradePrice,
                reference,
                provider: 'paystack',
                status: 'pending',
                metadata: {
                    user_id: user.id,
                    upgrade_type: 'agent',
                    plan_type: plan,
                    plan_days: planDays,
                    plan_label: planLabel,
                    base_amount: upgradePrice,
                }
            })

        if (paymentError) {
            console.error('[UpgradeInit] Database error:', paymentError)
            throw new Error('Failed to record payment attempt')
        }

        // Initialize Paystack payment
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
                    plan_days: planDays,
                    plan_label: planLabel,
                    base_amount: upgradePrice,
                    fee: fee,
                },
                callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/upgrade?success=true`,
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
