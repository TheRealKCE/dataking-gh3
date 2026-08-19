/**
 * Checks normalizeUtilityQueryResponse() against the sample responses in Hubtel's
 * Commission Services integration guide — verbatim, including the leading spaces
 * ECG puts in its Display and Value fields.
 *
 * Run:  npx tsx --env-file=.env.local scripts/check-utility-normalizer.ts
 *
 * The env file is only needed because importing the service pulls in the Supabase
 * client transitively; nothing here reads it. No network calls are made.
 *
 * Pure and offline. The three query shapes (pay-TV, ECG's meter list, Ghana Water's
 * single-use session) are the part of this integration most likely to be silently
 * wrong, and a mistake shows up mid-payment rather than at build time.
 */
import { normalizeUtilityQueryResponse } from '../lib/hubtel-utility-service'

let failures = 0

function check(name: string, actual: unknown, expected: unknown) {
    const a = JSON.stringify(actual)
    const e = JSON.stringify(expected)
    if (a === e) {
        console.log(`  ok   ${name}`)
    } else {
        failures++
        console.error(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`)
    }
}

// ── DSTV ─────────────────────────────────────────────────────────────────────
console.log('DSTV account query')
{
    const r = normalizeUtilityQueryResponse('dstv', {
        ResponseCode: '0000',
        Message: 'Successful',
        Label: '',
        Data: [
            { Display: 'name', Value: 'John Barnes', Amount: 0.0 },
            { Display: 'amountDue', Value: '0.00', Amount: 0.0 },
            { Display: 'account', Value: '7029864396', Amount: 0.0 },
        ],
    })
    check('success', r.success, true)
    check('accountName', r.accountName, 'John Barnes')
    check('amountDue', r.amountDue, 0)
    check('no meters', r.meters, undefined)
}

// ── GOtv (negative amountDue = the account is in credit) ─────────────────────
console.log('GOtv account query')
{
    const r = normalizeUtilityQueryResponse('gotv', {
        ResponseCode: '0000',
        Message: 'Successful',
        Label: '',
        Data: [
            { Display: 'name', Value: 'Senya Duku', Amount: 0.0 },
            { Display: 'amountDue', Value: '-201.00', Amount: 0.0 },
            { Display: 'account', Value: '7032371505', Amount: 0.0 },
        ],
    })
    check('success', r.success, true)
    check('accountName', r.accountName, 'Senya Duku')
    // Amount is 0 here, so the figure has to come off the Value string — and the
    // minus sign has to survive, or a credited account reads as owing 201.
    check('amountDue', r.amountDue, -201)
}

// ── StarTimes (capitalised, spaced Display keys) ─────────────────────────────
console.log('StarTimes account query')
{
    const r = normalizeUtilityQueryResponse('startimes', {
        ResponseCode: '0000',
        Message: 'Successful',
        Label: 'Successful',
        Data: [
            { Display: 'Name', Value: 'Joe Nti', Amount: 0.0 },
            { Display: 'Account Number', Value: '02190617357', Amount: 0.0 },
            { Display: 'Bouquet', Value: 'DTH_Super ', Amount: 0.0 },
        ],
    })
    check('success', r.success, true)
    // 'Name' not 'name' — the match has to be case-insensitive.
    check('accountName', r.accountName, 'Joe Nti')
    check('amountDue', r.amountDue, undefined)
    check('bouquet preserved in details', r.details?.[2]?.value, 'DTH_Super')
}

// ── ECG (the Data array IS the meter list) ───────────────────────────────────
console.log('ECG meter query')
{
    const r = normalizeUtilityQueryResponse('ecg', {
        ResponseCode: '0000',
        Message: 'Successful',
        Label: 'Successful',
        Data: [
            { Display: ' THOMAS ANANE (G131099826)', Value: ' G131099826', Amount: -1.1432 },
            { Display: ' ADEMAU LYDIA (24911947992)', Value: ' 24911947992', Amount: 0 },
        ],
    })
    check('success', r.success, true)
    check('meter count', r.meters?.length, 2)
    // The leading space must be gone, or the meter number goes to Hubtel with it.
    check('first meter number', r.meters?.[0]?.meterNumber, 'G131099826')
    check('second meter number', r.meters?.[1]?.meterNumber, '24911947992')
    check('first meter balance', r.meters?.[0]?.balance, -1.1432)
    // The name is inside the label, not a separate row.
    check('accountName', r.accountName, 'THOMAS ANANE')
}

console.log('ECG with no linked meters')
{
    const r = normalizeUtilityQueryResponse('ecg', { ResponseCode: '0000', Data: [] })
    check('rejected', r.success, false)
}

// ── Ghana Water (single-use sessionId) ───────────────────────────────────────
console.log('Ghana Water meter query')
{
    const r = normalizeUtilityQueryResponse('ghanawater', {
        ResponseCode: '0000',
        Message: 'Successful',
        Label: 'Successful',
        Data: [
            { Display: 'name', Value: 'AMAKYE FREMPONG', Amount: 0.0 },
            { Display: 'amountDue', Value: '371.89', Amount: 371.89 },
            { Display: 'sessionId', Value: '3792660ccf0e687b64cdb3f776fd6e368ca4260d', Amount: 0.0 },
        ],
    })
    check('success', r.success, true)
    check('accountName', r.accountName, 'AMAKYE FREMPONG')
    check('amountDue', r.amountDue, 371.89)
    check('sessionId', r.sessionId, '3792660ccf0e687b64cdb3f776fd6e368ca4260d')
}

console.log('Ghana Water with no session')
{
    // A payment built on this would be rejected by the provider, so the query has
    // to fail here instead of letting the charge through.
    const r = normalizeUtilityQueryResponse('ghanawater', {
        ResponseCode: '0000',
        Data: [{ Display: 'name', Value: 'AMAKYE FREMPONG', Amount: 0.0 }],
    })
    check('rejected', r.success, false)
}

// ── Provider-side rejection ──────────────────────────────────────────────────
console.log('Non-0000 response')
{
    const r = normalizeUtilityQueryResponse('dstv', { ResponseCode: '2001', Message: 'Invalid account' })
    check('rejected', r.success, false)
    check('message surfaced', r.error, 'Invalid account')
    check('responseCode kept', r.responseCode, '2001')
}

console.log('')
if (failures > 0) {
    console.error(`${failures} check(s) failed.`)
    process.exit(1)
}
console.log('All normalizer checks passed.')
