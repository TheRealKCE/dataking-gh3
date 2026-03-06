import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { message } = body

        if (!message || typeof message !== 'string') {
            return NextResponse.json(
                { reply: "I didn't quite get that. Could you please rephrase?" },
                { status: 400 }
            )
        }

        let userName = 'Anonymous'

        try {
            const cookieStore = await cookies()
            const supabaseUserClient = createRouteHandlerClient({
                // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
                cookies: () => cookieStore
            })
            const { data: { session } } = await supabaseUserClient.auth.getSession()

            if (session?.user) {
                userName = session.user.user_metadata?.full_name || session.user.email || 'User'

                // Try fetching precise name if email is the best we got
                if (userName === session.user.email || userName === 'User') {
                    const supabase = createServerClient()
                    const { data: userData } = await supabase
                        .from('users')
                        .select('first_name, last_name')
                        .eq('id', session.user.id)
                        .single()

                    const pUser = userData as any;
                    if (pUser && (pUser.first_name || pUser.last_name)) {
                        userName = `${pUser.first_name || ''} ${pUser.last_name || ''}`.trim()
                    }
                }
            }
        } catch (authError) {
            console.error('Support Chat API: Auth error', authError)
        }

        try {
            const supabase = createServerClient()
            await (supabase.from('support_logs') as any).insert({
                user_name: userName,
                message: message,
                timestamp: new Date().toISOString()
            })
        } catch (dbError) {
            console.error('Support Chat API: DB insert error', dbError)
        }

        const msgLower = message.toLowerCase()
        let reply = "I'm not exactly sure about that. Please contact our human support team via WhatsApp for further assistance."

        if (msgLower.includes('buy data') || msgLower.includes('purchase data') || msgLower.includes('how to buy') || msgLower.includes('data bundle')) {
            reply = "To buy data bundles, go to the 'Data Packages' section on your dashboard, select your preferred network, choose a package, and enter the recipient's phone number. Ensure your wallet has sufficient funds."
        } else if (msgLower.includes('deposit') || msgLower.includes('fund wallet') || msgLower.includes('add money') || msgLower.includes('top up')) {
            reply = "You can deposit funds into your wallet by navigating to the 'Wallet' section. Click on 'Fund Wallet', enter the amount, and follow the prompts to complete the payment via Mobile Money."
        } else if (msgLower.includes('fail') || msgLower.includes('error') || msgLower.includes('not going through')) {
            reply = "Orders might fail due to several reasons: insufficient wallet balance, network downtime from the telecom provider, or an invalid recipient phone number. Please check your details and try again."
        } else if (msgLower.includes('refund') || msgLower.includes('money back')) {
            reply = "If your order fails but your wallet was deducted, the system usually processes a refund automatically. If you haven't received your refund within a few minutes, please contact our WhatsApp support with your transaction ID."
        } else if (msgLower.includes('delivery time') || msgLower.includes('how long') || msgLower.includes('not received')) {
            reply = "Data bundles are typically delivered instantly. However, during peak times or network congestion, it might take a few minutes. If you haven't received it after 10 minutes, please reach out to our WhatsApp support."
        } else if (msgLower.includes('hi') || msgLower.includes('hello') || msgLower.includes('hey')) {
            reply = "Hello! How can I help you today? You can ask me about buying data, funding your wallet, failed orders, refunds, or delivery times."
        }

        return NextResponse.json({ reply })
    } catch (error) {
        return NextResponse.json(
            { reply: "An error occurred while processing your request. Please try again later." },
            { status: 500 }
        )
    }
}
