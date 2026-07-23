import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { fulfillUSSDRCBySession } from '@/lib/ussd-rc-fulfillment';
import { getDispatcher } from '@/lib/hubtel-payment-service';

/**
 * Hubtel Programmable Services — Service Fulfilment URL
 *
 * Hubtel POSTs here after the customer has paid for a service initiated via the
 * AddToCart response in /api/hubtel/interact. We render the value (assign a
 * result-checker voucher + SMS) and then POST an acknowledgement back to
 * Hubtel's gs-callback within one hour.
 *
 * Fulfilment payload shape (see docs):
 *   { SessionId, OrderId, OrderInfo: { Status, Payment: { IsSuccessful, AmountPaid }, Items: [...] } }
 *
 * The gs-callback endpoint is IP-whitelisted, so the ack is sent through the
 * Fixie static proxy (same dispatcher used for all Hubtel API traffic).
 */

export const runtime = 'nodejs';
export const maxDuration = 45; // 45 seconds for the sequential fulfillment chain (voucher assign, SMS, ack)

const GS_CALLBACK_URL = 'https://gs-callback.hubtel.com:9055/callback';

export async function POST(req: Request) {
    let sessionId: string | undefined;
    let orderId: string | undefined;

    try {
        const body = await req.json();
        console.log('[Hubtel Fulfill] Service fulfilment received:', JSON.stringify(body));

        sessionId = body.SessionId;
        orderId = body.OrderId;
        const orderInfo = body.OrderInfo || {};
        const payment = orderInfo.Payment || {};

        if (!sessionId || !orderId) {
            console.error('[Hubtel Fulfill] Missing SessionId or OrderId.');
            return NextResponse.json({ message: 'Invalid fulfilment payload.' }, { status: 400 });
        }

        // Only fulfil a genuinely-paid order.
        const paid =
            payment.IsSuccessful === true ||
            String(orderInfo.Status || '').toLowerCase() === 'paid';

        if (!paid) {
            console.warn('[Hubtel Fulfill] Order not paid, skipping fulfilment:', orderId, orderInfo.Status);
            // Ack Hubtel so it stops retrying; nothing to render for an unpaid order.
            await sendServiceCallback(sessionId, orderId, 'failed');
            return NextResponse.json({ message: 'Order not paid.' });
        }

        const amountPaid = parseFloat(
            String(payment.AmountAfterCharges ?? payment.AmountPaid ?? orderInfo.Subtotal ?? 0)
        );

        // Fulfil: assign voucher, send SMS (idempotent on OrderId).
        // Pass a callback for non-critical tasks to defer (admin push, session cleanup).
        const deferredWork: Array<() => Promise<void>> = [];
        const result = await fulfillUSSDRCBySession({
            sessionId,
            referenceCode: orderId,
            amountPaid,
            deferredWork,
        });

        // Report the outcome to Hubtel immediately. "success" only when value was rendered.
        await sendServiceCallback(sessionId, orderId, result.success ? 'success' : 'failed');

        // Fire-and-forget the deferred work (admin push, session cleanup) so it doesn't
        // block the Hubtel callback response.
        if (deferredWork.length > 0) {
            waitUntil(Promise.all(deferredWork.map((fn) => fn().catch(() => {}))));
        }

        if (!result.success) {
            console.error('[Hubtel Fulfill] Fulfilment failed:', result.error);
        }

        return NextResponse.json({ message: result.success ? 'Fulfilled.' : 'Fulfilment failed.' });
    } catch (error) {
        console.error('[Hubtel Fulfill] Unhandled error:', error);
        // Best-effort failure ack so Hubtel is not left waiting.
        if (sessionId && orderId) {
            await sendServiceCallback(sessionId, orderId, 'failed').catch(() => {});
        }
        return NextResponse.json({ message: 'Internal error. Order logged for manual review.' });
    }
}

/**
 * POSTs the Service Fulfilment acknowledgement to Hubtel's gs-callback.
 * Routed through the Fixie static proxy because the endpoint is IP-whitelisted.
 */
async function sendServiceCallback(
    sessionId: string,
    orderId: string,
    serviceStatus: 'success' | 'failed'
): Promise<void> {
    try {
        const res = await fetch(GS_CALLBACK_URL, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
            },
            body: JSON.stringify({
                SessionId: sessionId,
                OrderId: orderId,
                ServiceStatus: serviceStatus,
                MetaData: null,
            }),
            // @ts-ignore — undici dispatcher for static IP routing
            dispatcher: getDispatcher(),
        });
        console.log(`[Hubtel Fulfill] gs-callback (${serviceStatus}) -> HTTP ${res.status}`);
    } catch (err: any) {
        console.error('[Hubtel Fulfill] gs-callback POST failed:', err?.message);
    }
}
