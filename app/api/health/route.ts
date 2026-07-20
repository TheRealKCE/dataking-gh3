import { NextResponse } from 'next/server'

/**
 * Lightweight health-check endpoint used by the Offline Modal
 * to verify actual server reachability when the user taps "Try Again".
 */
export async function HEAD() {
    return new NextResponse(null, { status: 200 })
}

export async function GET() {
    return NextResponse.json({ ok: true })
}
