import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
    try {
        const supabase = createRouteClient()

        // Verify Admin Role
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { data: userProfile } = await supabase
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single()

        if ((userProfile as any)?.role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
        }

        const formData = await request.formData()
        const typeId = formData.get('typeId') as string
        const file = formData.get('file') as File

        if (!typeId || !file) {
            return NextResponse.json({ error: 'Missing typeId or file' }, { status: 400 })
        }

        const text = await file.text()
        const rows = text.split('\n').map(row => row.trim()).filter(row => row.length > 0)

        // Parse CSV (assuming format: PIN,SERIAL)
        // Skip header if first row starts with 'pin' (case-insensitive)
        let startIndex = 0
        if (rows.length > 0 && rows[0].toLowerCase().startsWith('pin')) {
            startIndex = 1
        }

        const batchId = `BATCH-${Date.now()}`
        const vouchersToInsert = []

        for (let i = startIndex; i < rows.length; i++) {
            const cols = rows[i].split(',')
            if (cols.length >= 2) {
                vouchersToInsert.push({
                    type_id: typeId,
                    pin: cols[0].trim(),
                    serial_number: cols[1].trim(),
                    status: 'available',
                    batch_id: batchId
                })
            }
        }

        if (vouchersToInsert.length === 0) {
            return NextResponse.json({ error: 'No valid voucher rows found in CSV' }, { status: 400 })
        }

        // Insert in batches of 500 to avoid request size limits
        const chunkSize = 500
        let totalInserted = 0

        for (let i = 0; i < vouchersToInsert.length; i += chunkSize) {
            const chunk = vouchersToInsert.slice(i, i + chunkSize)
            const { error: insertError } = await (supabase
                .from('results_checker_inventory') as any)
                .insert(chunk)

            if (insertError) {
                console.error('[VoucherUpload] Chunk insert error:', insertError)
                return NextResponse.json({ 
                    error: 'Error inserting batch. Some may have been inserted.', 
                    details: insertError.message 
                }, { status: 500 })
            }
            totalInserted += chunk.length
        }

        return NextResponse.json({ 
            success: true, 
            message: `Successfully uploaded ${totalInserted} vouchers.` 
        })

    } catch (error: any) {
        console.error('[VoucherUpload] Error:', error)
        return NextResponse.json({ error: 'Failed to process upload' }, { status: 500 })
    }
}
