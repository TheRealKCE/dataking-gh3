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
 * Every session opens by asking for a SHORT CODE — the 4-character identifier a
 * shop buys once and keeps for life. It resolves to a shop, and the rest of the
 * session sells that shop's catalogue at that shop's prices. One reserved house
 * short code (admin_settings.ussd_house_code) keeps ARHMS' own platform-direct
 * sales working exactly as before.
 *
 * IMPORTANT: We do NOT initiate payment ourselves. When the user confirms, we
 * return a `Type: "AddToCart"` response with an Item — Hubtel then charges the
 * customer and POSTs the result to our Service Fulfilment URL
 * (/api/hubtel/fulfill).
 *
 * Docs: https://developers.hubtel.com — Programmable Services API
 */

// Never cache/prerender.
export const dynamic = 'force-dynamic';
export const runtime = 'edge';

/** Bundles shown per USSD screen. A screen is ~160 chars, so five is the safe ceiling. */
const PAGE_SIZE = 5;
/** Wrong short codes tolerated before we hang up, so a wrong-number dialler can't loop forever. */
const MAX_CODE_ATTEMPTS = 3;

// Lazy-load Supabase client to avoid blocking on module import
let supabaseAdmin: any = null;
function getSupabaseAdmin() {
    if (!supabaseAdmin) {
        supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
    }
    return supabaseAdmin;
}

/**
 * Keep-warm ping. A Vercel Cron GET keeps this exact function instance hot so a
 * real USSD initiation never pays a cold-start (which can exceed Hubtel's
 * timeout). Returns immediately with no DB work.
 */
export async function GET() {
    return NextResponse.json({ ok: true, warm: true, ts: Date.now() });
}

const WELCOME_MESSAGE = 'Welcome to ARHMS\nEnter short code to continue:';

export async function POST(req: Request) {
    const requestStartTime = Date.now();
    try {
        const body = await req.json();
        const { Mobile, SessionId, Type: RequestType, Message, Operator } = body;
        const requestType = String(RequestType || '').toLowerCase();

        // ULTRA-FAST PATH: Initiation — return hardcoded response, defer everything
        if (requestType === 'initiation' && SessionId) {
            const response = respond(SessionId, 'response', WELCOME_MESSAGE, {
                label: 'Short code',
            });

            // Defer Supabase init and session creation to background
            waitUntil((async () => {
                try {
                    const client = createClient(
                        process.env.NEXT_PUBLIC_SUPABASE_URL!,
                        process.env.SUPABASE_SERVICE_ROLE_KEY!
                    );
                    await client.from('hubtel_sessions').upsert({
                        session_id: SessionId,
                        mobile: Mobile || '',
                        current_step: 'enter_short_code',
                        data: { operator: (Operator || 'mtn').toLowerCase() },
                        updated_at: new Date().toISOString(),
                    });
                } catch (err) {
                    console.error('[Hubtel] Initiation session creation error:', err);
                }
            })());

            return response;
        }

        // For any other request type, we need the full client
        if (!SessionId || !Mobile) {
            return respond(SessionId, 'release', 'Invalid USSD request. Missing session data.');
        }

        // Timeout — user cancelled the session. Clean up and end.
        if (requestType === 'timeout') {
            await getSupabaseAdmin().from('hubtel_sessions').delete().eq('session_id', SessionId);
            return respond(SessionId, 'release', 'Session timed out. Thank you for using ARHMS.');
        }

        // 1. Fetch existing session for a continuation request
        // Use a 9-second timeout — aggressive but leaves 1s buffer before Hubtel's timeout
        const sessionFetchStart = Date.now();
        let session: any = null;
        let sessionError: any = null;
        try {
            const sessionFetchPromise = getSupabaseAdmin()
                .from('hubtel_sessions')
                .select('*')
                .eq('session_id', SessionId)
                .single();
            const result = await withTimeout(sessionFetchPromise, 9000, 'Session fetch timeout');
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
        const sessionData = session.data || {};
        let userInput = Message?.trim();

        // Global "0" = Back one step (or Exit at the first menu after the short code)
        if (requestType !== 'initiation' && userInput === '0') {
            const back = BACK_STEPS[currentStep];
            if (back === 'exit') {
                endSession(SessionId);
                return respond(SessionId, 'release', 'Thank you for using ARHMS. Goodbye.');
            }
            if (back) {
                currentStep = back;
                // Clearing the input makes the target step redraw its menu cleanly
                // instead of scolding the user for the "0" they pressed to get there.
                userInput = '';
            }
        }

        // Only an actual wrong keypress deserves the scold.
        const invalid = (what: string) => (userInput ? `Invalid ${what}.\n` : '');

        switch (currentStep) {
            // ── SHORT CODE ───────────────────────────────────────────────────────
            case 'enter_short_code': {
                const code = String(userInput || '').toUpperCase().replace(/\s+/g, '');

                if (!code) {
                    return respond(SessionId, 'response', WELCOME_MESSAGE, { label: 'Short code' });
                }

                // Both lookups fire together: this is the latency-critical keypress,
                // and running them in series would put two round trips inside
                // Hubtel's window for no reason.
                let houseCode: string | null = null;
                let shop: any = null;
                try {
                    const shopPromise = getSupabaseAdmin()
                        .from('shop_profiles')
                        .select('id, shop_name, owner_id')
                        .eq('ussd_code', code)
                        .eq('ussd_status', 'active')
                        .eq('approval_status', 'approved')
                        .eq('is_active', true)
                        .maybeSingle();

                    const [houseResult, shopResult] = await Promise.all([
                        getHouseCode(),
                        withTimeout(shopPromise, 8000, 'Shop lookup timeout'),
                    ]);
                    houseCode = houseResult;
                    shop = shopResult.data;
                } catch (e: any) {
                    console.error('[Hubtel Interact] Shop lookup failed:', e?.message);
                    return respond(SessionId, 'release', 'System busy. Please dial again.');
                }

                // The house short code is ARHMS selling direct: platform catalogue,
                // platform prices, no shop attribution. Unchanged from before.
                if (houseCode && code === houseCode) {
                    sessionData.mode = 'platform';
                    saveAsync(SessionId, 'choose_service', sessionData);
                    return respond(SessionId, 'response', renderServiceMenu('ARHMS'), {
                        label: 'Select service',
                    });
                }

                if (!shop) {
                    const attempts = (sessionData.codeAttempts || 0) + 1;
                    if (attempts >= MAX_CODE_ATTEMPTS) {
                        endSession(SessionId);
                        return respond(SessionId, 'release', 'Invalid short code. Please check with the shop and dial again.');
                    }
                    sessionData.codeAttempts = attempts;
                    saveAsync(SessionId, 'enter_short_code', sessionData);
                    return respond(
                        SessionId,
                        'response',
                        `Invalid short code.\nAttempt ${attempts} of ${MAX_CODE_ATTEMPTS}.\nEnter short code:`,
                        { label: 'Short code' }
                    );
                }

                sessionData.mode = 'shop';
                sessionData.shopId = shop.id;
                sessionData.shopName = shop.shop_name;
                sessionData.ownerId = shop.owner_id;
                sessionData.codeAttempts = 0;

                saveAsync(SessionId, 'choose_service', sessionData);
                return respond(SessionId, 'response', renderServiceMenu(shop.shop_name), {
                    label: 'Select service',
                });
            }

            // ── SERVICE ──────────────────────────────────────────────────────────
            case 'choose_service': {
                const shopLabel = sessionData.shopName || 'ARHMS';
                // Every re-render below has to persist the step it drew, otherwise a
                // back-navigation would leave the DB pointing at the step we left.
                const reprompt = (msg: string) => {
                    saveAsync(SessionId, 'choose_service', sessionData);
                    return respond(SessionId, 'response', msg, { label: 'Select service' });
                };

                if (userInput === '2') {
                    const checkers = await loadCheckers(sessionData);
                    if (!checkers.length) {
                        return reprompt(`Result checkers unavailable.\n${renderServiceMenu(shopLabel)}`);
                    }
                    sessionData.availableCheckers = checkers;
                    saveAsync(SessionId, 'select_checker_type', sessionData);
                    return respond(SessionId, 'response', renderCheckerMenu(checkers), {
                        label: 'Select Checker',
                    });
                }

                if (userInput === '1') {
                    // Platform mode has no data catalogue on USSD — only shops sell bundles.
                    if (sessionData.mode !== 'shop') {
                        return reprompt(`Data bundles unavailable.\n${renderServiceMenu(shopLabel)}`);
                    }

                    const bundles = await loadShopBundles(sessionData.shopId);
                    if (!bundles.length) {
                        return reprompt(`No bundles available.\n${renderServiceMenu(shopLabel)}`);
                    }

                    sessionData.allBundles = bundles;
                    const networks = uniqueNetworks(bundles);
                    sessionData.networks = networks;

                    saveAsync(SessionId, 'choose_network', sessionData);
                    return respond(SessionId, 'response', renderNetworkMenu(networks), {
                        label: 'Select network',
                    });
                }

                return reprompt(`${invalid('input')}${renderServiceMenu(shopLabel)}`);
            }

            // ── DATA: NETWORK ────────────────────────────────────────────────────
            case 'choose_network': {
                const networks: string[] = sessionData.networks || [];
                const idx = parseInt(userInput, 10) - 1;

                if (isNaN(idx) || idx < 0 || idx >= networks.length) {
                    saveAsync(SessionId, 'choose_network', sessionData);
                    return respond(SessionId, 'response', `${invalid('selection')}${renderNetworkMenu(networks)}`, {
                        label: 'Select network',
                    });
                }

                const network = networks[idx];
                sessionData.network = network;
                sessionData.bundles = (sessionData.allBundles || []).filter((b: any) => b.network === network);
                sessionData.bundlePage = 0;

                saveAsync(SessionId, 'select_bundle', sessionData);
                return respond(SessionId, 'response', renderBundleMenu(sessionData.bundles, 0), {
                    label: 'Select bundle',
                });
            }

            // ── DATA: BUNDLE (paginated) ─────────────────────────────────────────
            case 'select_bundle': {
                const bundles: any[] = sessionData.bundles || [];
                const page: number = sessionData.bundlePage || 0;
                const lastPage = Math.max(0, Math.ceil(bundles.length / PAGE_SIZE) - 1);

                if (userInput === '99') {
                    const nextPage = page < lastPage ? page + 1 : page;
                    sessionData.bundlePage = nextPage;
                    saveAsync(SessionId, 'select_bundle', sessionData);
                    return respond(SessionId, 'response', renderBundleMenu(bundles, nextPage), {
                        label: 'Select bundle',
                    });
                }

                if (userInput === '88') {
                    const prevPage = page > 0 ? page - 1 : 0;
                    sessionData.bundlePage = prevPage;
                    saveAsync(SessionId, 'select_bundle', sessionData);
                    return respond(SessionId, 'response', renderBundleMenu(bundles, prevPage), {
                        label: 'Select bundle',
                    });
                }

                // Numbering restarts at 1 on every page, so map it back through the offset.
                const withinPage = parseInt(userInput, 10) - 1;
                const idx = page * PAGE_SIZE + withinPage;

                if (isNaN(withinPage) || withinPage < 0 || withinPage >= PAGE_SIZE || idx >= bundles.length) {
                    saveAsync(SessionId, 'select_bundle', sessionData);
                    return respond(SessionId, 'response', `${invalid('selection')}${renderBundleMenu(bundles, page)}`, {
                        label: 'Select bundle',
                    });
                }

                const bundle = bundles[idx];
                sessionData.orderType = 'data';
                sessionData.selectedPackageId = bundle.id;
                sessionData.packageSize = bundle.size;
                sessionData.selectedPrice = bundle.price;
                sessionData.itemName = `${bundle.network} ${bundle.size}`;

                saveAsync(SessionId, 'enter_phone', sessionData);
                return respond(SessionId, 'response', 'Enter recipient number:\n(or send 1 for your own number)', {
                    label: 'Recipient number',
                    fieldType: 'phone',
                });
            }

            // ── RESULT CHECKER ───────────────────────────────────────────────────
            case 'select_checker_type': {
                const availableCheckers = sessionData.availableCheckers || [];
                const selectionIndex = parseInt(userInput, 10) - 1;

                if (isNaN(selectionIndex) || selectionIndex < 0 || selectionIndex >= availableCheckers.length) {
                    saveAsync(SessionId, 'select_checker_type', sessionData);
                    return respond(
                        SessionId,
                        'response',
                        invalid('selection') + renderCheckerMenu(availableCheckers),
                        { label: 'Select Checker' }
                    );
                }

                const selected = availableCheckers[selectionIndex];
                sessionData.orderType = 'rc';
                sessionData.selectedCheckerId = selected.id;
                sessionData.selectedCheckerName = selected.name;
                sessionData.selectedCheckerPrice = selected.price;
                sessionData.selectedPrice = selected.price;
                sessionData.itemName = selected.name;

                saveAsync(SessionId, 'enter_phone', sessionData);
                return respond(
                    SessionId,
                    'response',
                    'Enter recipient number:\n(or send 1 for your own number)',
                    { label: 'Recipient number', fieldType: 'phone' }
                );
            }

            // ── RECIPIENT ────────────────────────────────────────────────────────
            case 'enter_phone': {
                let recipientMobile: string;

                if (!userInput || userInput === '1') {
                    recipientMobile = normalizeGhanaPhone(Mobile) || Mobile;
                } else {
                    const normalized = normalizeGhanaPhone(userInput);
                    if (!normalized) {
                        saveAsync(SessionId, 'enter_phone', sessionData);
                        return respond(
                            SessionId,
                            'response',
                            'Invalid number.\nEnter recipient number:\n(or send 1 for your own number)',
                            { label: 'Recipient number', fieldType: 'phone' }
                        );
                    }
                    recipientMobile = normalized;
                }

                sessionData.recipientMobile = recipientMobile;

                saveAsync(SessionId, 'confirm', sessionData);
                return respond(
                    SessionId,
                    'response',
                    `Confirm Order:\n${sessionData.itemName} x1\nCost: GHS ${formatGhs(sessionData.selectedPrice)}\nTo: ${recipientMobile}\n\n1. Confirm & Pay\n0. Cancel`,
                    { label: 'Confirm order' }
                );
            }

            // ── CONFIRM ──────────────────────────────────────────────────────────
            case 'confirm': {
                if (userInput !== '1') {
                    endSession(SessionId);
                    return respond(SessionId, 'release', 'Order cancelled. Thank you for using ARHMS.');
                }

                const price = parseFloat(String(sessionData.selectedPrice || '0'));

                // Persist so the fulfilment callback can reconcile the amount.
                // This one IS awaited: the fulfill route needs this state written before
                // Hubtel calls /fulfill. In practice Hubtel waits for payment confirmation
                // (seconds to minutes) before calling fulfill, so this is safe.
                sessionData.chargedAmount = price;
                // The candidate lists are only needed while browsing; dropping them keeps
                // the persisted JSON small on the one write that blocks the response.
                delete sessionData.allBundles;
                delete sessionData.bundles;
                delete sessionData.availableCheckers;

                const confirmSaveStart = Date.now();
                try {
                    await withTimeout(save(SessionId, 'awaiting_payment', sessionData), 8000, 'Confirm save timeout');
                } catch (confirmError: any) {
                    console.error('[Hubtel Interact] Confirm save timeout/error:', confirmError?.message);
                    return respond(SessionId, 'release', 'Payment confirmation failed. Please try again.');
                }
                console.log('[Hubtel Interact] Confirm save took', Date.now() - confirmSaveStart, 'ms for SessionId:', SessionId);

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
                            ItemName: sessionData.itemName,
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
        return NextResponse.json({
            Type: 'Release',
            Message: 'An unexpected error occurred.'
        });
    }
}

/**
 * Where "0" goes from each step. 'exit' hangs up; anything else re-enters that
 * step, which re-renders its menu on the next keypress.
 */
const BACK_STEPS: Record<string, string> = {
    enter_short_code: 'exit',
    choose_service: 'exit',
    choose_network: 'choose_service',
    select_bundle: 'choose_network',
    select_checker_type: 'choose_service',
    enter_phone: 'choose_service',
};

/**
 * Races a query against a timeout so a slow DB can never eat Hubtel's window.
 * Returns `any` because Supabase query builders are thenables, not Promises,
 * and their resolved shape doesn't survive Promise.race's inference.
 */
function withTimeout(promise: PromiseLike<any>, ms: number, message: string): Promise<any> {
    return Promise.race([
        promise as Promise<any>,
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
    ]);
}

/** Fire-and-forget session delete for every terminal path. */
function endSession(sessionId: string): void {
    waitUntil((async () => {
        const { error } = await getSupabaseAdmin().from('hubtel_sessions').delete().eq('session_id', sessionId);
        if (error) console.error('[Hubtel Interact] Session delete error:', error);
    })());
}

async function getHouseCode(): Promise<string | null> {
    try {
        const promise = getSupabaseAdmin()
            .from('admin_settings')
            .select('value')
            .eq('key', 'ussd_house_code')
            .maybeSingle();
        const result = await withTimeout(promise, 4000, 'House code timeout');
        // admin_settings.value is JSONB, so this arrives already parsed. It should
        // be a string, but String() keeps a mis-seeded number or boolean from
        // throwing here and taking down every USSD session.
        return String(result.data?.value ?? '').toUpperCase() || null;
    } catch {
        // Losing the house code only costs ARHMS its own direct sales for this
        // session; shop short codes still resolve, so don't fail the call.
        return null;
    }
}

/**
 * The checker list for this session: a shop's own selling prices when a shop is
 * resolved, otherwise the platform's `ussd_price ?? customer_price`.
 */
async function loadCheckers(sessionData: any): Promise<Array<{ id: string; name: string; price: number }>> {
    try {
        const typesPromise = getSupabaseAdmin()
            .from('results_checker_types')
            .select('id, name, customer_price, ussd_price')
            .eq('is_active', true)
            .order('display_order', { ascending: true });
        const typesResult = await withTimeout(typesPromise, 8000, 'Types fetch timeout');
        const types = typesResult.data || [];
        if (!types.length) return [];

        // Price only — the shop's margin is derived at fulfilment from the DB, so
        // carrying a cost figure through the session would just be a second,
        // staler source of truth.
        if (sessionData.mode !== 'shop') {
            return types.map((t: any) => ({
                id: t.id,
                name: t.name,
                price: Number(t.ussd_price ?? t.customer_price ?? 0),
            }));
        }

        const pricingPromise = getSupabaseAdmin()
            .from('shop_rc_pricing')
            .select('rc_type_id, selling_price')
            .eq('shop_id', sessionData.shopId);
        const pricingResult = await withTimeout(pricingPromise, 8000, 'Shop RC pricing timeout');

        const priceByType: Record<string, number> = {};
        for (const row of (pricingResult.data || [])) {
            priceByType[row.rc_type_id] = Number(row.selling_price);
        }

        // A shop only sells the checkers it has priced — an unpriced type has no
        // margin and must not appear.
        return types
            .filter((t: any) => priceByType[t.id] > 0)
            .map((t: any) => ({
                id: t.id,
                name: t.name,
                price: priceByType[t.id],
            }));
    } catch (e: any) {
        console.error('[Hubtel Interact] loadCheckers failed:', e?.message);
        return [];
    }
}

/** The shop's priced, available data bundles. */
async function loadShopBundles(shopId: string): Promise<Array<{ id: string; network: string; size: string; price: number }>> {
    try {
        const promise = getSupabaseAdmin()
            .from('shop_pricing')
            .select('package_id, selling_price, data_packages!inner(id, network, size, is_available, sort_order)')
            .eq('shop_id', shopId)
            .eq('data_packages.is_available', true);
        const result = await withTimeout(promise, 8000, 'Shop bundles timeout');

        return (result.data || [])
            .map((row: any) => ({
                id: row.package_id,
                network: row.data_packages?.network,
                size: row.data_packages?.size,
                price: Number(row.selling_price),
                sort: row.data_packages?.sort_order ?? 0,
            }))
            .filter((b: any) => b.network && b.size && b.price > 0)
            .sort((a: any, b: any) => a.network.localeCompare(b.network) || a.sort - b.sort)
            .map(({ id, network, size, price }: any) => ({ id, network, size, price }));
    } catch (e: any) {
        console.error('[Hubtel Interact] loadShopBundles failed:', e?.message);
        return [];
    }
}

function uniqueNetworks(bundles: Array<{ network: string }>): string[] {
    const seen: string[] = [];
    for (const b of bundles) {
        if (!seen.includes(b.network)) seen.push(b.network);
    }
    return seen;
}

function renderServiceMenu(shopName: string): string {
    // Long shop names would push the menu past one screen.
    const name = shopName.length > 20 ? `${shopName.slice(0, 19)}.` : shopName;
    return `Welcome to ${name}\n1. Data Bundles\n2. Result Checker\n0. Exit`;
}

function renderNetworkMenu(networks: string[]): string {
    let msg = 'Select Network:\n';
    networks.forEach((n, i) => {
        msg += `${i + 1}. ${n}\n`;
    });
    msg += '0. Back';
    return msg;
}

/** One page of bundles, numbered from 1 on every page. */
function renderBundleMenu(bundles: Array<{ size: string; price: number }>, page: number): string {
    const start = page * PAGE_SIZE;
    const slice = bundles.slice(start, start + PAGE_SIZE);
    const lastPage = Math.max(0, Math.ceil(bundles.length / PAGE_SIZE) - 1);

    let msg = 'Select Bundle:\n';
    slice.forEach((b, i) => {
        msg += `${i + 1}. ${b.size} - GHS ${formatGhs(b.price)}\n`;
    });
    if (page < lastPage) msg += '99. Next\n';
    if (page > 0) msg += '88. Prev\n';
    msg += '0. Back';
    return msg;
}

/** Renders the numbered checker list with inline prices, e.g. "1. BECE (18 GHS)". */
function renderCheckerMenu(types: Array<{ name: string; price: number }>): string {
    let msg = 'Select Checker Type:\n';
    types.forEach((t, i) => {
        msg += `${i + 1}. ${t.name} (${formatGhs(t.price)} GHS)\n`;
    });
    msg += '0. Back';
    return msg;
}

/**
 * Normalises a Ghanaian MSISDN to local 0XXXXXXXXX form, or returns null when it
 * isn't one. The old flow accepted any string verbatim, which meant a typo was
 * only discovered after the customer had paid.
 */
function normalizeGhanaPhone(input: string): string | null {
    if (!input) return null;
    let digits = String(input).replace(/[^\d]/g, '');

    if (digits.startsWith('233') && digits.length === 12) {
        digits = `0${digits.slice(3)}`;
    } else if (digits.length === 9 && !digits.startsWith('0')) {
        digits = `0${digits}`;
    }

    return /^0[235]\d{8}$/.test(digits) ? digits : null;
}

/** Formats a GHS amount without trailing zeros: 18 -> "18", 0.01 -> "0.01", 18.5 -> "18.5" */
function formatGhs(price: any): string {
    const n = parseFloat(String(price ?? 0));
    if (isNaN(n)) return '0';
    return n.toFixed(2).replace(/\.?0+$/, '');
}

/** Persists the session's next step and data (awaited — use when ordering matters). */
async function save(sessionId: string, nextStep: string, data: any) {
    const { error } = await getSupabaseAdmin()
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
        const { error } = await getSupabaseAdmin()
            .from('hubtel_sessions')
            .update({ current_step: nextStep, data, updated_at: new Date().toISOString() })
            .eq('session_id', sessionId);
        if (error) console.error('[Hubtel Interact] Async session update error:', error);
    })());
}

interface RespondOpts {
    label?: string;
    /** "menu" | "input" (default) | "display" */
    dataType?: 'menu' | 'input' | 'display';
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
    const isRelease = type === 'release';
    // Hubtel Programmable Services requires every response to echo SessionId and
    // carry the display metadata (Label, DataType, FieldType). Omitting them makes
    // Hubtel reject the payload as incomplete ("missing sessionId and required parameters").
    const TYPE_MAP = { response: 'Response', release: 'Release', AddToCart: 'AddToCart' } as const;
    const payload: Record<string, any> = {
        SessionId: sessionId,
        Type: TYPE_MAP[type],
        Message: message,
        Label: opts.label || 'ARHMS',
        DataType: opts.dataType || (isAddToCart || isRelease ? 'display' : 'input'),
        FieldType: opts.fieldType || 'text',
    };
    if (isAddToCart && opts.item) {
        payload.Item = opts.item;
    }
    return NextResponse.json(payload);
}
