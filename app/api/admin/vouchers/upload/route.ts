import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAccess } from '@/lib/auth-utils'
import { createServerClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
    const auth = await validateAdminAccess(false)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    try {
        const body = await request.json()
        const { typeId, vouchers } = body

        if (!typeId || !vouchers || !Array.isArray(vouchers) || vouchers.length === 0) {
            return NextResponse.json({ error: 'Missing typeId or vouchers array' }, { status: 400 })
        }

        // Map vouchers into the DB format
        const rows = vouchers.map((v: any) => ({
            type_id: typeId,
            pin: v.pin,
            serial_number: v.serial_number || null,
            status: 'available',
        }))

        const supabase = createServerClient()
        const { data, error } = await (supabase as any)
            .from('results_checker_inventory')
            .insert(rows)

        if (error) {
            console.error('[Upload Error]', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, count: rows.length, message: `Successfully uploaded ${rows.length} vouchers.` })
    } catch (err: any) {
        console.error('[RC Upload POST]', err)
        return NextResponse.json({ error: 'Failed to process upload payload' }, { status: 500 })
    }
}
