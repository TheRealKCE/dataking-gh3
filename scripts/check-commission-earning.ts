/**
 * Proves the commission credit pays exactly once.
 *
 * The property worth testing is not "does it add money" — it is "does a callback
 * racing the reconciliation cron add it twice". finalizeUtilityOrder and
 * finalizeAirtimeOrder are both reachable from three directions at the same moment,
 * so this drives creditCommissionForOrder concurrently AND sequentially against a
 * real order and asserts the wallet moved once.
 *
 * Usage — needs a COMPLETED order that was placed with a commission key:
 *
 *   npx tsx --env-file=.env.local scripts/check-commission-earning.ts utility <order-id>
 *   npx tsx --env-file=.env.local scripts/check-commission-earning.ts airtime <order-id>
 *
 * Unlike check-utility-normalizer.ts this one really does touch the database, and it
 * writes: it moves the commission wallet. Point it at a test order.
 *
 * Pass --reset to clear commission_credited_at and the ledger row first, so the same
 * order can be re-tested. It does NOT reverse the wallet balance — the delta this
 * prints is what matters, not the absolute figure.
 */
import { createServerClient } from '../lib/supabase'
import { creditCommissionForOrder, type CommissionSource } from '../lib/commission-earning'

const TABLE: Record<CommissionSource, string> = {
    airtime: 'airtime_orders',
    utility: 'utility_orders',
}

function fail(message: string): never {
    console.error(`\n  FAIL  ${message}\n`)
    process.exit(1)
}

async function main() {
    const [, , sourceArg, orderId, ...rest] = process.argv
    const reset = rest.includes('--reset')

    if (sourceArg !== 'airtime' && sourceArg !== 'utility') {
        fail('First argument must be "airtime" or "utility".')
    }
    if (!orderId) fail('Second argument must be an order id.')

    const source = sourceArg as CommissionSource
    const supabase = createServerClient() as any

    const { data: order } = await supabase
        .from(TABLE[source])
        .select('*')
        .eq('id', orderId)
        .maybeSingle()

    if (!order) fail(`No ${source} order with id ${orderId}.`)

    console.log(`\n  Order    ${order.reference_code}`)
    console.log(`  Status   ${order.status}`)
    console.log(`  Key      ${order.api_key_id ?? '(none — placed outside the API)'}`)

    if (!order.api_key_id) {
        fail('This order has no api_key_id, so it can never earn. Place one through /api/v2 with a commission key.')
    }
    if (order.status !== 'completed') {
        console.warn(`  NOTE     status is "${order.status}"; the real callers only credit on "completed".`)
    }

    if (reset) {
        await supabase.from(TABLE[source]).update({ commission_credited_at: null }).eq('id', orderId)
        await supabase.from('commission_transactions').delete().eq('source', source).eq('order_id', orderId)
        console.log('  Reset    cleared the latch and any existing ledger row.')
    }

    const readWallet = async (): Promise<number> => {
        const { data } = await supabase
            .from('commission_wallets')
            .select('balance')
            .eq('owner_id', order.user_id)
            .maybeSingle()
        return Number(data?.balance ?? 0)
    }

    const countLedger = async (): Promise<number> => {
        const { count } = await supabase
            .from('commission_transactions')
            .select('id', { count: 'exact', head: true })
            .eq('source', source)
            .eq('order_id', orderId)
        return count ?? 0
    }

    const before = await readWallet()
    console.log(`\n  Balance before  GHS ${before.toFixed(2)}`)

    // Concurrent: the callback-vs-cron race the latch exists for.
    await Promise.all([
        creditCommissionForOrder({ source, orderId }),
        creditCommissionForOrder({ source, orderId }),
        creditCommissionForOrder({ source, orderId }),
    ])

    // Sequential: a later retry must not top it up again either.
    await creditCommissionForOrder({ source, orderId })

    const after = await readWallet()
    const rows = await countLedger()
    const delta = Number((after - before).toFixed(2))

    console.log(`  Balance after   GHS ${after.toFixed(2)}`)
    console.log(`  Credited        GHS ${delta.toFixed(2)}`)
    console.log(`  Ledger rows     ${rows}`)

    if (rows > 1) fail(`Paid ${rows} times. The commission_credited_at latch is not holding.`)
    if (rows === 0 && delta === 0) {
        console.log('\n  OK    Nothing credited — expected when the key is not a commission key, ')
        console.log('        the share resolves to zero, or the order was already paid without --reset.\n')
        return
    }
    if (rows !== 1) fail(`Expected exactly 1 ledger row, found ${rows}.`)

    const { data: tx } = await supabase
        .from('commission_transactions')
        .select('amount, description')
        .eq('source', source)
        .eq('order_id', orderId)
        .maybeSingle()

    if (Math.abs(Number(tx.amount) - delta) > 0.005) {
        fail(`Ledger says GHS ${Number(tx.amount).toFixed(2)} but the wallet moved GHS ${delta.toFixed(2)}.`)
    }

    console.log(`\n  PASS  Four calls, one payment of GHS ${delta.toFixed(2)}.`)
    console.log(`        "${tx.description}"\n`)
}

main().catch(err => {
    console.error(err)
    process.exit(1)
})
