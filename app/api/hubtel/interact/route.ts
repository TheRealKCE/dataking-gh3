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

        // FAST PATH: On initiation (Hubtel's first, latency-sensitive hit) a
        // session cannot already exist, so skip the SELECT. Write the session
        // already advanced to 'choose_action' in a single upsert, then respond.
        // This collapses 3 sequential DB round-trips (select+upsert+update) to 1.
        if (requestType === 'initiation') {
            // Fire-and-forget: respond immediately; DB write completes async.
            // Wrapped in waitUntil so Vercel doesn't freeze the container.
            waitUntil((async () => {
                const { error } = await supabaseAdmin
                    .from('hubtel_sessions')
                    .upsert({
                        session_id: SessionId,
                        mobile: Mobile,
                        current_step: 'choose_action',
                        data: { operator: (Operator || 'mtn').toLowerCase() },
                        updated_at: new Date().toISOString(),
                    });
                if (error) console.error('[Hubtel Interact] Session upsert error:', error);
            })());

            return respond(
                SessionId,
                'response',
                'Welcome to ARHMS TECHNOLOGIES\n1. Buy Result Checker\n0. Exit',
                { label: 'Welcome' }
            );
        }

        // 1. Fetch existing session for a continuation request
        let { data: session, error: sessionError } = await supabaseAdmin
            .from('hubtel_sessions')
            .select('*')
            .eq('session_id', SessionId)
            .single();

        if (sessionError && sessionError.code !== 'PGRST116') {
            console.error('[Hubtel Interact] Session fetch error:', sessionError);
            return respond(SessionId, 'release', 'System error. Please try again.');
        }

        if (!session) {
            // Session missing (expired/cleaned) — restart from the menu.
            return respond(SessionId, 'release', 'Session expired. Please dial again.');
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

                // Fetch checker types with a 4-second timeout to fail fast
                const controller = new AbortController();
                const fetchTimeout = setTimeout(() => controller.abort(), 4000);
                let activeTypes: any[] | null = null;
                let typesError: any = null;
                try {
                    const result = await supabaseAdmin
                        .from('results_checker_types')
                        .select('id, name, customer_price')
                        .eq('is_active', true)
                        .order('display_order', { ascending: true })
                        .abortSignal(controller.signal);
                    activeTypes = result.data;
                    typesError = result.error;
                } catch (e: any) {
                    typesError = e;
                } finally {
                    clearTimeout(fetchTimeout);
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
                sessionData.chargedAmount = price;
                await save(SessionId, 'awaiting_payment', sessionData);

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
        console.error('[Hubtel Interact] Unhandled error:', error);
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
