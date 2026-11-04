/**
 * Airtime over USSD, for main-site users and for shops that have priced it.
 *
 * A shop's airtime (quoteShopAirtime) is priced by the shop's own fees and settled as a
 * shop sale through lib/ussd-shop-airtime-fulfillment.ts; everything below about the
 * wallet_payments row is the main-site path.
 *
 * The caller names the number to top up (their own by default) and an amount. The network is
 * read off the number, and the beneficiary receives exactly the amount typed — the platform
 * fee is added on top. That is the website's "pay the fee separately" mode, which the
 * dashboard now requires, and it is also the mode that cannot trip the provider's minimum: the
 * old "fee comes out of the amount" mode sent GHS 0.95 for a GHS 1.00 charge, which the
 * provider refused after the money had been taken.
 *
 * Unlike a utility bill there is no provider lookup to make while pricing — the price is the
 * amount plus a percentage from admin_settings — so all of it runs inside the USSD keypress.
 *
 * The payment is recorded as the same pending wallet_payments row /api/airtime/gateway-init
 * writes (kind 'airtime_order'), and settled by the website's processAirtimeDirectOrder: see
 * lib/ussd-airtime-settle.ts.
 *
 * EDGE-SAFE: pure functions and PostgREST reads/writes only.
 */
import { validateGhanaianPhone } from '@/lib/phone-validation'

export const AIRTIME_ITEM_NAME = 'Airtime'

/**
 * The smallest top-up the provider accepts (MIN_DELIVERABLE_AIRTIME_GHS in
 * lib/kingflexy-airtime-service.ts, which this file may not import: that module is not
 * edge-safe). A test pins the two together.
 */
export const MIN_AIRTIME_GHS = 1

export const AIR_PHONE_PROMPT = 'Enter the number to top up:\n(or send 1 for your own number)'
export const AIR_AMOUNT_PROMPT = 'Enter airtime amount in GHS:'

export type AirtimeNetwork = 'MTN' | 'Telecel' | 'AT'

/** phone-validation names AT "AirtelTigo"; the airtime catalogue, the settings keys and the provider say "AT". */
const NETWORK_OF: Record<string, AirtimeNetwork> = { MTN: 'MTN', Telecel: 'Telecel', AirtelTigo: 'AT' }
const KEY_OF: Record<AirtimeNetwork, string> = { MTN: 'mtn', Telecel: 'telecel', AT: 'at' }

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export interface AirtimeNumber {
    ok: boolean
    phone?: string
    network?: AirtimeNetwork
    error?: string
}

/**
 * The number to top up and its network. `1` means the caller's own number.
 * Uses the platform's phone validator rather than the menu's stricter one, so a number the
 * website accepts (098 on MTN, for one) is accepted here too.
 */
export function readAirtimeNumber(input: string, ownMobile: string): AirtimeNumber {
    const raw = String(input ?? '').trim()
    const candidate = raw === '1' ? ownMobile : raw
    const v = validateGhanaianPhone(candidate)
    const network = v.network ? NETWORK_OF[v.network] : undefined
    if (!v.isValid || !network) return { ok: false, error: 'Invalid number.' }
    return { ok: true, phone: v.normalizedNumber, network }
}

export interface AirtimeQuote {
    network: AirtimeNetwork
    phone: string
    airtimeAmount: number
    feeRate: number
    feeAmount: number
    total: number
    /** 'agent' or 'customer': which fee band applied. */
    band: 'agent' | 'customer'
}

export interface AirtimeMember {
    userId: string
    role: string
}

/**
 * Prices a top-up from admin_settings: the website's own keys, so the price on a handset is
 * the price on the dashboard. Called twice — when the amount is entered, and again when the
 * caller confirms, so a fee changed in between is never charged silently.
 */
export async function quoteAirtime(
    db: any,
    member: AirtimeMember,
    params: { phone: string; network: AirtimeNetwork; amount: number }
): Promise<{ ok: boolean; error?: string; quote?: AirtimeQuote }> {
    const { phone, network, amount } = params
    const key = KEY_OF[network]
    if (!key) return { ok: false, error: 'That network is not supported.' }

    const { data } = await db
        .from('admin_settings')
        .select('key, value')
        .in('key', [
            `airtime_enabled_${key}`,
            `airtime_fee_${key}_customer`,
            `airtime_fee_${key}_agent`,
            'airtime_min_amount',
            'airtime_max_amount',
        ])
    const settings: Record<string, string> = {}
    for (const row of (data || []) as any[]) settings[row.key] = row.value

    if (settings[`airtime_enabled_${key}`] === 'false') {
        return { ok: false, error: `${network} airtime is unavailable right now.` }
    }

    // Never below what the provider will deliver, whatever the admin's minimum says.
    const min = Math.max(parseFloat(settings.airtime_min_amount || '1') || 1, MIN_AIRTIME_GHS)
    const max = parseFloat(settings.airtime_max_amount || '500') || 500
    if (!Number.isFinite(amount) || amount < min) return { ok: false, error: `Minimum is GHS ${min.toFixed(2)}.` }
    if (amount > max) return { ok: false, error: `Maximum is GHS ${max.toFixed(2)}.` }

    const band: 'agent' | 'customer' = member.role === 'agent' ? 'agent' : 'customer'
    // 5 is the website's own fallback when a fee row is missing.
    const parsedRate = parseFloat(settings[`airtime_fee_${key}_${band}`] || '5')
    const feeRate = Number.isFinite(parsedRate) && parsedRate >= 0 ? parsedRate : 5
    const feeAmount = round2(amount * (feeRate / 100))

    return {
        ok: true,
        quote: {
            network,
            phone,
            airtimeAmount: round2(amount),
            feeRate,
            feeAmount,
            total: round2(amount + feeAmount),
            band,
        },
    }
}

/** The shop_profiles columns a shop prices airtime with, one percentage per network. */
export interface ShopAirtimeFees {
    airtime_fee_mtn?: number | string | null
    airtime_fee_telecel?: number | string | null
    airtime_fee_at?: number | string | null
}

/**
 * The networks a shop sells airtime on: those it has set a margin for. A margin of 0 is
 * not a price — the storefront's processor rejects a sale with no profit — so a shop
 * that has priced nothing does not list airtime at all.
 */
export function shopAirtimeNetworks(shop: ShopAirtimeFees): AirtimeNetwork[] {
    return (['MTN', 'Telecel', 'AT'] as AirtimeNetwork[])
        .filter((n) => Number((shop as any)[`airtime_fee_${KEY_OF[n]}`]) > 0)
}

/**
 * Prices a shop's top-up exactly as lib/shop-order-processor.ts will re-price it at
 * settlement (it refuses a payment more than five pesewas off): the shop's own fee for the
 * network plus the platform fee for the owner's role, both percentages of the amount, on
 * top of the amount — the storefront's exact-amount mode. The admin fee keys are the three
 * the processor reads (customer, agent, dealer); any other role pays no platform fee there,
 * so none here either.
 *
 * Called when the amount is entered and again at confirm, like quoteAirtime.
 */
export async function quoteShopAirtime(
    db: any,
    shopId: string,
    params: { phone: string; network: AirtimeNetwork; amount: number }
): Promise<{ ok: boolean; error?: string; quote?: AirtimeQuote }> {
    const { phone, network, amount } = params
    const key = KEY_OF[network]
    if (!key) return { ok: false, error: 'That network is not supported.' }

    const [{ data: shop }, { data: settingsRows }] = await Promise.all([
        db.from('shop_profiles').select('owner_id, airtime_fee_mtn, airtime_fee_telecel, airtime_fee_at').eq('id', shopId).maybeSingle(),
        db.from('admin_settings').select('key, value').in('key', [
            'storefront_airtime_enabled',
            `airtime_enabled_${key}`,
            `airtime_fee_${key}_customer`,
            `airtime_fee_${key}_agent`,
            `airtime_fee_${key}_dealer`,
            'airtime_min_amount',
            'airtime_max_amount',
        ]),
    ])
    const settings: Record<string, string> = {}
    for (const row of (settingsRows || []) as any[]) settings[row.key] = row.value

    if (!shop) return { ok: false, error: 'Airtime is unavailable right now.' }
    if (settings.storefront_airtime_enabled === 'false' || settings[`airtime_enabled_${key}`] === 'false') {
        return { ok: false, error: `${network} airtime is unavailable right now.` }
    }

    const shopFee = Number(shop[`airtime_fee_${key}`]) || 0
    if (!(shopFee > 0)) return { ok: false, error: `${network} airtime is not sold here.` }

    const { data: owner } = await db.from('users').select('role').eq('id', shop.owner_id).maybeSingle()
    const ownerRole = owner?.role || 'customer'
    const adminFee = parseFloat(settings[`airtime_fee_${key}_${ownerRole}`] || '0') || 0

    // The storefront's own cap: it refuses the sale outright rather than charge more.
    if (shopFee + adminFee > 10) return { ok: false, error: `${network} airtime is unavailable right now.` }

    const min = Math.max(parseFloat(settings.airtime_min_amount || '1') || 1, MIN_AIRTIME_GHS)
    const max = parseFloat(settings.airtime_max_amount || '500') || 500
    if (!Number.isFinite(amount) || amount < min) return { ok: false, error: `Minimum is GHS ${min.toFixed(2)}.` }
    if (amount > max) return { ok: false, error: `Maximum is GHS ${max.toFixed(2)}.` }

    const airtimeAmount = round2(amount)
    const feeRate = shopFee + adminFee
    // The processor's arithmetic, to the pesewa: Math.round((amount + amount × rate) × 100).
    const total = Math.round((airtimeAmount + airtimeAmount * (feeRate / 100)) * 100) / 100

    return {
        ok: true,
        quote: {
            network,
            phone,
            airtimeAmount,
            feeRate,
            feeAmount: round2(total - airtimeAmount),
            total,
            // The caller is a shop's customer; the band only labels the quote.
            band: 'customer',
        },
    }
}

/**
 * Records the top-up as a pending wallet payment BEFORE the charge goes out: the same row,
 * in the same shape, as /api/airtime/gateway-init. Whatever settles it — the Paystack
 * webhook or the sweep — finds the order in the row, with no session to read.
 */
export async function recordAirtimePayment(
    db: any,
    member: AirtimeMember,
    params: { reference: string; quote: AirtimeQuote; payerMsisdn: string; sessionId: string }
): Promise<void> {
    const { reference, quote, payerMsisdn, sessionId } = params

    let { data: wallet } = await db.from('wallets').select('id').eq('user_id', member.userId).maybeSingle()
    if (!wallet) {
        const created = await db.from('wallets').insert({ user_id: member.userId }).select().single()
        wallet = created.data
    }
    if (!wallet?.id) throw new Error('Member has no wallet')

    // The caller is charged exactly the quote: no gateway fee on USSD, the gateway absorbs
    // its cut at settlement, as for every other USSD sale.
    const { error } = await db.from('wallet_payments').insert({
        user_id: member.userId,
        wallet_id: wallet.id,
        amount: quote.total,
        fee: 0,
        total_amount: quote.total,
        reference,
        provider: 'paystack_momo',
        status: 'pending',
        metadata: {
            kind: 'airtime_order',
            user_id: member.userId,
            role: quote.band,
            beneficiary_phone: quote.phone,
            network: quote.network,
            airtime_amount: quote.airtimeAmount,
            fee_rate: quote.feeRate,
            fee_amount: quote.feeAmount,
            use_exact_amount: true,
            type: 'airtime',
            bundle_preference: null,
            // How this payment is recognised as a USSD one, and who to tell about it.
            channel: 'ussd',
            session_id: sessionId,
            payer_msisdn: payerMsisdn,
        },
    })
    if (error) throw error
}
