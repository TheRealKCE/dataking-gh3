import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendHubtelSMS } from '@/lib/hubtel-sms-service';
import { sendPushToAdmins } from '@/lib/web-push';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { SessionId, Mobile, TransactionId, Amount, ClientReference } = body;

        console.log('[Hubtel Fulfill] Callback received:', JSON.stringify(body));

        if (!SessionId || !Mobile) {
            console.error('[Hubtel Fulfill] Missing SessionId or Mobile in callback.');
            return NextResponse.json({ message: 'Invalid callback payload.' }, { status: 400 });
        }

        // 1. Fetch the pending session
        const { data: session, error: sessionError } = await supabaseAdmin
            .from('hubtel_sessions')
            .select('*')
            .eq('session_id', SessionId)
            .single();

        if (sessionError || !session) {
            console.error('[Hubtel Fulfill] Session not found for SessionId:', SessionId, sessionError);
            // Respond 200 to Hubtel so it doesn't retry indefinitely
            return NextResponse.json({ message: 'Session not found, cannot fulfill.' });
        }

        const sessionData = session.data || {};
        const { selectedCheckerId, selectedCheckerName, selectedCheckerPrice, recipientMobile } = sessionData;

        if (!selectedCheckerId || !selectedCheckerName) {
            console.error('[Hubtel Fulfill] Incomplete session data:', sessionData);
            return NextResponse.json({ message: 'Incomplete session data, cannot fulfill.' });
        }

        // 2. Idempotency — check if there is already a completed order for this session/TransactionId
        const { data: existingOrder } = await supabaseAdmin
            .from('results_checker_orders')
            .select('id, status')
            .eq('reference_code', TransactionId || ClientReference)
            .maybeSingle();

        if (existingOrder?.status === 'completed') {
            console.log('[Hubtel Fulfill] Already fulfilled for TransactionId:', TransactionId);
            return NextResponse.json({ message: 'Already fulfilled.' });
        }

        // 3. Create a pending order record
        const orderId = crypto.randomUUID();
        const referenceCode = TransactionId || ClientReference || `USSD-${Date.now()}`;

        await supabaseAdmin
            .from('results_checker_orders')
            .insert({
                id: orderId,
                user_id: null,
                customer_phone: recipientMobile || Mobile,
                type_id: selectedCheckerId,
                type_name: selectedCheckerName,
                quantity: 1,
                unit_price: selectedCheckerPrice || Amount,
                total_paid: Amount,
                status: 'pending',
                payment_status: 'completed',
                reference_code: referenceCode,
            });

        // 4. Lock a voucher using the existing RPC
        const { data: reserved, error: reserveErr } = await supabaseAdmin
            .rpc('assign_results_checker_vouchers', {
                p_type_id: selectedCheckerId,
                p_quantity: 1,
                p_order_id: orderId,
            });

        if (reserveErr || !reserved || reserved.length === 0) {
            console.error('[Hubtel Fulfill] assign_results_checker_vouchers failed:', reserveErr);

            // Mark the order as failed
            await supabaseAdmin
                .from('results_checker_orders')
                .update({ status: 'failed', updated_at: new Date().toISOString() })
                .eq('id', orderId);

            // Notify admin of stock issue
            await sendPushToAdmins({
                title: '⚠️ USSD Fulfillment Failed',
                body: `Out of stock: ${selectedCheckerName}. Order: ${referenceCode}. Hubtel TXN: ${TransactionId}`,
                url: '/admin/vouchers',
            }).catch(() => {});

            // Still respond 200 so Hubtel doesn't retry — handle manually
            return NextResponse.json({ message: 'Fulfillment failed: insufficient stock.' });
        }

        const voucher = reserved[0];

        // 5. Finalize the sale
        const { error: finalizeErr } = await supabaseAdmin
            .rpc('finalize_results_checker_sale', {
                p_order_id: orderId,
                p_user_id: null,
            });

        if (finalizeErr) {
            console.error('[Hubtel Fulfill] finalize_results_checker_sale failed:', finalizeErr);
        }

        // 6. Update order to completed
        await supabaseAdmin
            .from('results_checker_orders')
            .update({
                status: 'completed',
                payment_status: 'completed',
                inventory_ids: [voucher.id],
                fulfilled_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', orderId);

        // 7. Send SMS with PIN and Serial to recipient
        const recipientPhone = recipientMobile || Mobile;
        const smsMessage =
            `Your ${selectedCheckerName} Result Checker is ready!\n\n` +
            `PIN: ${voucher.pin}\n` +
            `Serial: ${voucher.serial_number}\n\n` +
            `Visit waecdirect.org to check your results.\n\nARHMS DATA`;

        const smsResult = await sendHubtelSMS({ recipient: recipientPhone, message: smsMessage });
        console.log('[Hubtel Fulfill] SMS result:', smsResult);

        // Update delivered_via field
        await supabaseAdmin
            .from('results_checker_orders')
            .update({ delivered_via: ['sms'] })
            .eq('id', orderId);

        // 8. Notify admins
        await sendPushToAdmins({
            title: '✅ USSD RC Sale',
            body: `${selectedCheckerName} sold via USSD to ${recipientPhone}. TXN: ${TransactionId}`,
            url: '/admin/vouchers',
        }).catch(() => {});

        // 9. Clean up the session
        await supabaseAdmin
            .from('hubtel_sessions')
            .delete()
            .eq('session_id', SessionId);

        console.log('[Hubtel Fulfill] Successfully fulfilled order:', orderId);

        return NextResponse.json({ message: 'Data bundle sent successfully' });

    } catch (error: any) {
        console.error('[Hubtel Fulfill] Unhandled error:', error);
        // Always respond 200 to prevent Hubtel retries on system errors
        return NextResponse.json({ message: 'Internal error. Order logged for manual review.' });
    }
}
