/**
 * Validates and prices one utility bill purchase.
 *
 * Shared by the wallet path (/api/utilities/create) and the direct-MoMo path
 * (/api/utilities/gateway-init) so the two cannot drift on what a bill costs or on
 * which account is about to be paid — a divergence there would mean the price the
 * customer sees depends on how they choose to pay.
 *
 * Unlike airtime there is no "exact vs inclusive" mode. A bill amount is the amount
 * the customer wants on their meter or decoder, so the fee always goes ON TOP:
 *
 *     bill_amount = what the customer typed
 *     fee_amount  = bill_amount × fee_rate%
 *     total_paid  = bill_amount + fee_amount
 *
 * Everything here is server-side by design. The browser sends an account number, an
 * amount and (for Ghana Water) a session it looked up earlier; none of that is
 * trusted. The account is re-queried against the provider before a charge is priced,
 * the resolved name is taken from THAT response, and the fee comes from
 * admin_settings. See queryUtilityAccount() for why the re-query is the important
 * part: it is the only thing standing between a mistyped digit and a stranger's bill.
 */
import {
    queryUtilityAccount,
    resolveDestination,
    UTILITY_SERVICES,
    isUtilityService,
    type UtilityService,
} from '@/lib/hubtel-utility-service'

export interface UtilityIntentInput {
    service: unknown
    accountNumber: unknown
    amount: unknown
    phone?: unknown
    email?: unknown
}

export interface UtilityIntent {
    service: UtilityService
    label: string
    accountNumber: string
    accountName: string | null
    destination: string
    customerPhone: string | null
    customerEmail: string | null
    /** Fresh from the provider. Ghana Water only; single-use. */
    sessionId: string | null
    billAmount: number
    feeRate: number
    feeAmount: number
    totalPaid: number
    amountDue?: number
}

export type UtilityIntentResult =
    | { ok: true; intent: UtilityIntent }
    | { ok: false; status: number; error: string }

function round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * @param settings  admin_settings rows already loaded by the caller, keyed by name.
 * @param userRole  'agent' or 'customer' — decides which fee rate applies.
 */
export async function buildUtilityIntent(
    input: UtilityIntentInput,
    settings: Record<string, string>,
    userRole: 'agent' | 'customer'
): Promise<UtilityIntentResult> {
    // ── Service ──────────────────────────────────────────────────────────────
    if (!isUtilityService(input.service)) {
        return { ok: false, status: 400, error: 'Unknown utility service' }
    }
    const service = input.service
    const def = UTILITY_SERVICES[service]

    if (settings[`utility_enabled_${service}`] === 'false') {
        return { ok: false, status: 400, error: `${def.label} payments are currently unavailable. Please try again later.` }
    }

    // ── Account + phone + email ──────────────────────────────────────────────
    const accountNumber = String(input.accountNumber ?? '').replace(/\s+/g, '')
    if (!def.accountPattern.test(accountNumber)) {
        return { ok: false, status: 400, error: `Enter a valid ${def.accountLabel}.` }
    }

    const phoneRaw = String(input.phone ?? '').replace(/\s+/g, '')
    if (def.requiresPhone && !/^0\d{9}$/.test(phoneRaw)) {
        return { ok: false, status: 400, error: 'Enter a valid Ghana phone number: 0XXXXXXXXX (10 digits starting with 0)' }
    }

    const email = String(input.email ?? '').trim()
    if (def.requiresEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        return { ok: false, status: 400, error: `${def.label} requires a valid email address for the receipt.` }
    }

    // ── Amount ───────────────────────────────────────────────────────────────
    const billAmount = round2(Number(input.amount))
    const minAmount = parseFloat(settings[`utility_min_amount_${service}`] || '1')
    const maxAmount = parseFloat(settings[`utility_max_amount_${service}`] || '2000')

    if (!Number.isFinite(billAmount) || billAmount < minAmount) {
        return { ok: false, status: 400, error: `Minimum ${def.label} payment is GHS ${minAmount.toFixed(2)}` }
    }
    if (billAmount > maxAmount) {
        return { ok: false, status: 400, error: `Maximum ${def.label} payment is GHS ${maxAmount.toFixed(2)}` }
    }

    // ── Verify the account against the provider ──────────────────────────────
    // Deliberately after the cheap checks and before any money maths: it is a
    // network round trip, and there is no point spending it on a malformed input.
    const lookup = await queryUtilityAccount({
        service,
        accountNumber,
        phone: def.requiresPhone ? phoneRaw : undefined,
    })

    if (!lookup.success) {
        return { ok: false, status: 400, error: lookup.error || `That ${def.accountLabel} could not be verified.` }
    }

    // ECG answers with every meter on the phone number rather than confirming the
    // one asked for, so the check is that the requested meter is actually in the list.
    if (def.kind === 'meter-by-phone') {
        const match = (lookup.meters || []).find(
            m => m.meterNumber.replace(/\s+/g, '').toLowerCase() === accountNumber.toLowerCase()
        )
        if (!match) {
            return {
                ok: false,
                status: 400,
                error: `Meter ${accountNumber} is not linked to ${phoneRaw}. Look up the number again and pick a meter from the list.`,
            }
        }
    }

    // ── Fee ──────────────────────────────────────────────────────────────────
    const feeRate = parseFloat(settings[`utility_fee_${service}_${userRole}`] || '2')
    const feeAmount = round2(billAmount * (feeRate / 100))
    const totalPaid = round2(billAmount + feeAmount)

    return {
        ok: true,
        intent: {
            service,
            label: def.label,
            accountNumber,
            accountName: lookup.accountName ?? null,
            destination: resolveDestination(service, accountNumber, phoneRaw || null),
            customerPhone: phoneRaw || null,
            customerEmail: def.requiresEmail ? email : (email || null),
            sessionId: lookup.sessionId ?? null,
            billAmount,
            feeRate,
            feeAmount,
            totalPaid,
            amountDue: lookup.amountDue,
        },
    }
}

/** The admin_settings keys buildUtilityIntent() reads, for the caller's `.in()` query. */
export function utilitySettingKeys(service: string): string[] {
    return [
        `utility_enabled_${service}`,
        `utility_fee_${service}_customer`,
        `utility_fee_${service}_agent`,
        `utility_min_amount_${service}`,
        `utility_max_amount_${service}`,
    ]
}
