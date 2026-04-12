import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        let payload: any;
        try {
            payload = await request.json()
        } catch (err) {
            console.error('[DakazinaWebhook] Failed to parse payload:', err)
            return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 })
        }

        // Dakazina's order_code and reference fields don't match our internal order IDs
        // Status updates are handled by manual sync and cron job
        // Webhook is kept for future use when Dakazina adds incoming_api_ref to payload
        const { order_code, reference, status, type } = payload

        if (type === 'test_event') {
            console.log(`[DakazinaWebhook] Test event received`)
            return NextResponse.json({ success: true, message: 'Test event ignored' }, { status: 200 })
        }

        const upperStatus = (status || '').toUpperCase()
        if (upperStatus !== 'DELIVERED') {
            console.log(`[DakazinaWebhook] Ignored status '${upperStatus}'`)
            return NextResponse.json({ success: true }, { status: 200 })
        }

        // Log for monitoring — order matching pending Dakazina adding incoming_api_ref to webhook
        console.log(`[DakazinaWebhook] DELIVERED event received. order_code=${order_code}, reference=${reference}. Awaiting incoming_api_ref support from Dakazina for automatic DB matching.`)
        return NextResponse.json({ success: true }, { status: 200 })

    } catch (error: any) {
        console.error('[DakazinaWebhook] Unhandled exception:', error)
        return NextResponse.json({ success: true }, { status: 200 })
    }
}
