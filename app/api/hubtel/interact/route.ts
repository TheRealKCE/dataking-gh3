import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { waitUntil } from '@vercel/functions';

/**
 * Hubtel Programmable Services — Service Interaction URL
 *
 * Hubtel POSTs a Push Request here on every USSD keypress (Type: Initiation |
 * Response | Timeout). We drive a server-side state machine and reply with a
 * Programmable Services response.
 *
 * IMPORTANT: We do NOT initiate payment ourselves. When the user confirms, we
 * return a `Type: "AddToCart"` response with an Item — Hubtel then charges the
 * customer and POSTs the result to our Service Fulfilment URL
 * (/api/hubtel/fulfill).
 *
 * Docs: https://developers.hubtel.com — Programmable Services API
 */

// USSD callbacks are latency-sensitive: Hubtel times out if we respond slowly.
// Never cache/prerender. We also use the Edge runtime to completely eliminate
// cold-start latency, which is the #1 cause of Hubtel USSD timeouts.
export const dynamic = 'force-dynamic';
export const runtime = 'edge';

// Service-role client to bypass RLS for USSD interactions
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Keep-warm ping. A Vercel Cron GET keeps this exact function instance hot so a
 * real USSD initiation never pays a cold-start (which can exceed Hubtel's
 * timeout). Returns immediately with no DB work.
 */
export async function GET() {
    return NextResponse.json({ ok: true, warm: true, ts: Date.now() });
}

export async function POST(req: Request) {
    const requestStartTime = Date.now();
    try {
        const body = await req.json();
        const { Mobile, SessionId, Type: RequestType, Message, Operator } = body;

        // Hubtel sends Type capitalised ("Initiation" | "Response" | "Timeout").
        const requestType = String(RequestType || '').toLowerCase();

        if (!SessionId || !Mobile) {
            return respond(SessionId, 'release', 'Invalid USSD request. Missing session data.');
        }

        // Timeout — user cancelled the session. Clean up and end.
        if (requestType === 'timeout') {
            await supabaseAdmin.from('hubtel_sessions').delete().eq('session_id', SessionId);
            return respond(SessionId, 'release', 'Session timed out. Thank you for using ARHMS.');
        }

        // FAST PATH: On initiation, respond immediately (<10ms) and defer ALL DB work.
        // This ensures we never timeout on the first hit, no matter how slow Supabase is.
        if (requestType === 'initiation') {
            console.log('[Hubtel Interact] Initiation from', Mobile, 'SessionId:', SessionId);

            // Respond immediately — this response completes before Hubtel's timeout
            const response = respond(
                SessionId,
                'response',
                'Welcome to ARHMS TECHNOLOGIES\n1. Buy Result Checker\n0. Exit',
                { label: 'Welcome' }
            );

            // Fire-and-forget: create session async after responding
            waitUntil((async () => {
                try {
                    await supabaseAdmin.from('hubtel_sessions').upsert({
                        session_id: SessionId,
                        mobile: Mobile,
                        current_step: 'choose_action',
                        data: { operator: (Operator || 'mtn').toLowerCase() },
                        updated_at: new Date().toISOString(),
                    });
                } catch (err) {
                    console.error('[Hubtel Interact] Initiation session creation error:', err);
                }
            })());

            return response;
        }

        // 1. Fetch existing session for a continuation request
        // Use a 9-second timeout — aggressive but leaves 1s buffer before Hubtel's timeout
        const sessionFetchStart = Date.now();
        let session: any = null;
        let sessionError: any = null;
        try {
            const sessionFetchPromise = supabaseAdmin
                .from('hubtel_sessions')
                .select('*')
                .eq('session_id', SessionId)
                .single();
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Session fetch timeout')), 9000)
            );
            const result = await Promise.race([sessionFetchPromise, timeoutPromise]) as any;
            session = result.data;
            sessionError = result.error;
        } catch (e: any) {
            sessionError = e;
        }
        const sessionFetchDuration = Date.now() - sessionFetchStart;

        if (sessionError && sessionError.code !== 'PGRST116') {
            console.error('[Hubtel Interact] Session fetch error (took', sessionFetchDuration, 'ms):', sessionError);
            return respond(SessionId, 'release', 'System error. Please try again.');
        }

        if (!session) {
            // Session missing (expired/cleaned) — restart from the menu.
            console.log('[Hubtel Interact] Session not found (fetch took', sessionFetchDuration, 'ms) for SessionId:', SessionId);
            return respond(SessionId, 'release', 'Session expired. Please dial again.');
        }

        if (sessionFetchDuration > 3000) {
            console.warn('[Hubtel Interact] Slow session fetch (', sessionFetchDuration, 'ms) for SessionId:', SessionId, 'Type:', requestType);
        }

        // 2. State machine
        let currentStep = session.current_step;
        let sessionData = session.data || {};
        const userInput = Message?.trim();

        // Global "0" = Back to main menu (or Exit at the main menu)
        if (requestType !== 'initiation' && userInput === '0') {
            if (currentStep === 'choose_action') {
                // Fire-and-forget: delete session async, respond immediately
                waitUntil((async () => {
                    const { error } = await supabaseAdmin.from('hubtel_sessions').delete().eq('session_id', SessionId);
                    if (error) console.error('[Hubtel Interact] Session delete error:', error);
                })());
                return respond(SessionId, 'release', 'Thank you for using ARHMS. Goodbye.');
            }
            currentStep = 'initiation';
        }

        switch (currentStep) {
            case 'initiation':
                // Fire-and-forget: respond without blocking on the DB write
                saveAsync(SessionId, 'choose_action', sessionData);
                return respond(
                    SessionId,
                    'response',
                    'Welcome to ARHMS TECHNOLOGIES\n1. Buy Result Checker\n0. Exit',
                    { label: 'Welcome' }
                );

            case 'choose_action': {
                if (userInput !== '1') {
                    // No state change needed — don't write to DB at all
                    return respond(
                        SessionId,
                        'response',
                        'Invalid input.\n1. Buy Result Checker\n0. Exit',
                        { label: 'Welcome' }
                    );
                }

                // Fetch checker types with a 8-second timeout to fail fast
                let activeTypes: any[] | null = null;
                let typesError: any = null;
                try {
                    const typesPromise = supabaseAdmin
                        .from('results_checker_types')
                        .select('id, name, customer_price')
                        .eq('is_active', true)
                        .order('display_order', { ascending: true });
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Types fetch timeout')), 8000)
                    );
                    const result = await Promise.race([typesPromise, timeoutPromise]) as any;
                    activeTypes = result.data;
                    typesError = result.error;
                } catch (e: any) {
                    typesError = e;
                }

                if (typesError || !activeTypes || activeTypes.length === 0) {
                    return respond(
                        SessionId,
                        'release',
                        'Result checkers are currently unavailable. Please try again later.'
                    );
                }

                sessionData.availableCheckers = activeTypes;
                // Fire-and-forget the DB write, respond immediately
                saveAsync(SessionId, 'select_checker_type', sessionData);
                return respond(SessionId, 'response', renderCheckerMenu(activeTypes), {
                    label: 'Select Checker',
                });
            }

            case 'select_checker_type': {
                const availableCheckers = sessionData.availableCheckers || [];
                const selectionIndex = parseInt(userInput) - 1;

                if (isNaN(selectionIndex) || selectionIndex < 0 || selectionIndex >= availableCheckers.length) {
                    await save(SessionId, 'select_checker_type', sessionData);
                    return respond(
                        SessionId,
                        'response',
                        'Invalid selection.\n' + renderCheckerMenu(availableCheckers),
                        { label: 'Select Checker' }
                    );
                }

                const selected = availableCheckers[selectionIndex];
                sessionData.selectedCheckerId = selected.id;
                sessionData.selectedCheckerName = selected.name;
                sessionData.selectedCheckerPrice = selected.customer_price;

                saveAsync(SessionId, 'enter_phone', sessionData);
                return respond(
                    SessionId,
                    'response',
                    'Enter recipient number (for SMS delivery):\n(leave blank/send 1 to use your current number)',
                    { label: 'Recipient number', fieldType: 'phone' }
                );
            }

            case 'enter_phone': {
                let recipientMobile = userInput;
                if (!recipientMobile || recipientMobile === '1' || recipientMobile.trim() === '') {
                    recipientMobile = Mobile;
                }
                sessionData.recipientMobile = recipientMobile;

                saveAsync(SessionId, 'confirm', sessionData);
                const price = formatGhs(sessionData.selectedCheckerPrice);
                return respond(
                    SessionId,
                    'response',
                    `Confirm Order:\n${sessionData.selectedCheckerName} x1\nCost: GHS ${price}\nTo: ${recipientMobile}\n\n1. Confirm & Pay\n0. Cancel`,
                    { label: 'Confirm order' }
                );
            }

            case 'confirm': {
                if (userInput !== '1') {
                    // Fire-and-forget: delete session async
                    waitUntil((async () => {
                        const { error } = await supabaseAdmin.from('hubtel_sessions').delete().eq('session_id', SessionId);
                        if (error) console.error('[Hubtel Interact] Session delete error:', error);
                    })());
                    return respond(SessionId, 'release', 'Order cancelled. Thank you for using ARHMS.');
                }

                const price = parseFloat(String(sessionData.selectedCheckerPrice || '0'));

                // Persist so the fulfilment callback can reconcile the amount.
                // This one IS awaited: the fulfill route needs this state written before
                // Hubtel calls /fulfill. In practice Hubtel waits for payment confirmation
                // (seconds to minutes) before calling fulfill, so this is safe.
                // Use a 8-second timeout instead of exhausting Hubtel's window.
                sessionData.chargedAmount = price;
                const confirmSaveStart = Date.now();
                try {
                    const confirmSavePromise = save(SessionId, 'awaiting_payment', sessionData);
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Confirm save timeout')), 8000)
                    );
                    await Promise.race([confirmSavePromise, timeoutPromise]);
                } catch (confirmError: any) {
                    console.error('[Hubtel Interact] Confirm save timeout/error:', confirmError?.message);
                    return respond(SessionId, 'release', 'Payment confirmation failed. Please try again.');
                }
                const confirmSaveDuration = Date.now() - confirmSaveStart;
                console.log('[Hubtel Interact] Confirm save took', confirmSaveDuration, 'ms for SessionId:', SessionId);

                // AddToCart hands the cart to Hubtel, which prompts the user to pay.
                // On success Hubtel POSTs to our Service Fulfilment URL.
                return respond(
                    SessionId,
                    'AddToCart',
                    'The request has been submitted. Please wait for a payment prompt soon.',
                    {
                        label: 'The request has been submitted. Please wait for a payment prompt soon.',
                        dataType: 'display',
                        item: {
                            ItemName: sessionData.selectedCheckerName,
                            Qty: 1,
                            Price: price,
                        },
                    }
                );
            }

            default:
                return respond(SessionId, 'release', 'Session expired or invalid state.');
        }
    } catch (error) {
        const totalDuration = Date.now() - requestStartTime;
        console.error('[Hubtel Interact] Unhandled error (took', totalDuration, 'ms):', error);
        // No SessionId available in the catch scope; reply with a bare release.
        return NextResponse.json({
            Type: 'Release',
            Message: 'An unexpected error occurred.',
            Label: 'Error',
            DataType: 'display',
            FieldType: 'text',
        });
    }
}

/** Renders the numbered checker list with inline prices, e.g. "1. BECE (18 GHS)". */
function renderCheckerMenu(types: Array<{ name: string; customer_price: any }>): string {
    let msg = 'Select Checker Type:\n';
    types.forEach((t, i) => {
        msg += `${i + 1}. ${t.name} (${formatGhs(t.customer_price)} GHS)\n`;
    });
    msg += '0. Back';
    return msg;
}

/** Formats a GHS amount without trailing zeros: 18 -> "18", 0.01 -> "0.01", 18.5 -> "18.5" */
function formatGhs(price: any): string {
    const n = parseFloat(String(price ?? 0));
    if (isNaN(n)) return '0';
    return n.toFixed(2).replace(/\.?0+$/, '');
}

/** Persists the session's next step and data (awaited — use when ordering matters). */
async function save(sessionId: string, nextStep: string, data: any) {
    const { error } = await supabaseAdmin
        .from('hubtel_sessions')
        .update({ current_step: nextStep, data, updated_at: new Date().toISOString() })
        .eq('session_id', sessionId);
    if (error) console.error('[Hubtel Interact] Session update error:', error);
}

/**
 * Fire-and-forget session save — responds to Hubtel immediately without blocking
 * on the DB write. Errors are logged but never surfaced to the user.
 * Use this for every step except the final `awaiting_payment` transition, where
 * the fulfill route needs the state persisted before it is called by Hubtel.
 */
function saveAsync(sessionId: string, nextStep: string, data: any): void {
    waitUntil((async () => {
        const { error } = await supabaseAdmin
            .from('hubtel_sessions')
            .update({ current_step: nextStep, data, updated_at: new Date().toISOString() })
            .eq('session_id', sessionId);
        if (error) console.error('[Hubtel Interact] Async session update error:', error);
    })());
}

interface RespondOpts {
    label?: string;
    /** "input" (default) or "display" */
    dataType?: 'input' | 'display';
    /** "text" (default) | "phone" | "decimal" | "number" | "email" | "textarea" */
    fieldType?: 'text' | 'phone' | 'decimal' | 'number' | 'email' | 'textarea';
    /** AddToCart cart item */
    item?: { ItemName: string; Qty: number; Price: number };
}

/**
 * Builds a Programmable Services response with all mandatory fields
 * (SessionId, Type, Message, Label, DataType, FieldType). A missing field
 * makes Hubtel reject the response with "Error: UUE".
 */
function respond(
    sessionId: string,
    type: 'response' | 'release' | 'AddToCart',
    message: string,
    opts: RespondOpts = {}
) {
    const isAddToCart = type === 'AddToCart';
    // Hubtel Programmable Services requires the Type value capitalised
    // ("Response" | "Release" | "AddToCart"). Sending lowercase makes the
    // gateway fail to render the next screen and the handset shows
    // "Error Service Timeout". Normalise here so call sites can stay lowercase.
    const TYPE_MAP = { response: 'Response', release: 'Release', AddToCart: 'AddToCart' } as const;
    const payload: Record<string, any> = {
        SessionId: sessionId,
        Type: TYPE_MAP[type],
        Message: message,
        Label: opts.label || message.split('\n')[0].slice(0, 60),
        DataType: opts.dataType || (type === 'response' ? 'input' : 'display'),
        FieldType: opts.fieldType || 'text',
    };
    if (isAddToCart && opts.item) {
        payload.Item = opts.item;
    }
    return NextResponse.json(payload);
}
