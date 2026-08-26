/**
 * Test: Chain Profit Split (three-level reseller network)
 *
 * splitChainProfit() is where the money is actually divided, so this pins the
 * property that matters most: the legs must sum to exactly what the customer
 * paid above the platform's cost — no pesewa invented, none lost.
 *
 * Pure arithmetic, no database. The DB-backed end of this lives in
 * scripts/test-profit-split.ts.
 *
 * Run: npx ts-node scripts/test-chain-split.ts
 *
 * Exit code: 0 = all pass, 1 = any fail
 */

import { splitChainProfit, type ChainLevel } from '@/lib/pricing/chain-cost'

interface TestCase {
    name: string
    sellingPrice: number
    levels: ChainLevel[]
    /** Expected seller leg, then one per ancestor, nearest upline first. */
    expected: number[] | null
    /** The root's cost — legs must sum to sellingPrice minus this. */
    rootCost?: number
}

/** Terse ChainLevel builder; only wholesale/cost affect the split. */
const level = (wholesale: number | null, cost: number | null, n = 'x'): ChainLevel => ({
    shopId: `shop-${n}`,
    ownerId: `owner-${n}`,
    depth: 0,
    isSub: false,
    wholesale,
    cost,
})

const testCases: TestCase[] = [
    // ===== TWO LEVELS (existing behaviour must not drift) =====
    {
        name: 'Lead → sub: sub keeps its markup, Lead keeps its margin',
        sellingPrice: 7.0,
        // Sub pays the Lead 6.00; the Lead pays the platform 4.50.
        levels: [level(6.0, 4.5, 'lead')],
        expected: [1.0, 1.5],
        rootCost: 4.5,
    },
    {
        name: 'Lead → sub: equal legs (the case amount-keyed idempotency collapsed)',
        sellingPrice: 6.0,
        levels: [level(5.0, 4.0, 'lead')],
        expected: [1.0, 1.0],
        rootCost: 4.0,
    },

    // ===== THREE LEVELS =====
    {
        name: 'Lead → sub → sub-of-sub: every level keeps its own spread',
        sellingPrice: 6.0,
        // L2 pays L1 5.40; L1 pays L0 5.00; L0 pays the platform 4.50.
        levels: [level(5.4, 5.0, 'l1'), level(5.0, 4.5, 'l0')],
        expected: [0.6, 0.4, 0.5],
        rootCost: 4.5,
    },
    {
        name: 'Three levels: a middle level that added no margin earns nothing',
        sellingPrice: 6.0,
        levels: [level(5.0, 5.0, 'l1'), level(5.0, 4.5, 'l0')],
        expected: [1.0, 0.0, 0.5],
        rootCost: 4.5,
    },

    // ===== CLAMPING =====
    {
        name: 'Seller priced below their own cost: seller earns 0, uplines still paid',
        sellingPrice: 5.2,
        levels: [level(5.4, 5.0, 'l1'), level(5.0, 4.5, 'l0')],
        // boundary clamps to 5.20, so L1 gets 0.20 not 0.40; L0 still gets 0.50.
        expected: [0, 0.2, 0.5],
        rootCost: 4.5,
    },
    {
        name: 'Selling price under the root cost: no leg goes negative',
        sellingPrice: 4.0,
        levels: [level(5.4, 5.0, 'l1'), level(5.0, 4.5, 'l0')],
        expected: [0, 0, 0],
    },

    // ===== DATA GAPS =====
    {
        name: 'Upline dropped the package: null rather than an invented split',
        sellingPrice: 6.0,
        levels: [level(null, 5.0, 'l1')],
        expected: null,
    },
    {
        name: 'Root cost missing: null rather than an invented split',
        sellingPrice: 6.0,
        levels: [level(5.4, 5.0, 'l1'), level(5.0, null, 'l0')],
        expected: null,
    },
]

let passed = 0
let failed = 0

console.log('=== Chain Profit Split Test ===\n')

for (const tc of testCases) {
    const split = splitChainProfit(tc.sellingPrice, tc.levels)

    if (tc.expected === null) {
        if (split === null) {
            console.log(`✅ ${tc.name}`)
            passed++
        } else {
            console.log(`❌ ${tc.name}\n   expected null, got ${JSON.stringify(split)}`)
            failed++
        }
        continue
    }

    if (split === null) {
        console.log(`❌ ${tc.name}\n   expected a split, got null`)
        failed++
        continue
    }

    const actual = [split.sellerProfit, ...split.ancestorProfits]
    const legsMatch =
        actual.length === tc.expected.length &&
        actual.every((v, i) => Math.abs(v - tc.expected![i]) < 0.001)

    if (!legsMatch) {
        console.log(
            `❌ ${tc.name}\n   expected legs [${tc.expected.join(', ')}], got [${actual.join(', ')}]`
        )
        failed++
        continue
    }

    // The property that matters: nothing invented, nothing lost.
    if (tc.rootCost !== undefined) {
        const sum = actual.reduce((a, b) => a + b, 0)
        const chainMargin = tc.sellingPrice - tc.rootCost
        if (Math.abs(sum - chainMargin) > 0.001) {
            console.log(
                `❌ ${tc.name}\n   legs sum to ${sum.toFixed(2)}, but the chain margin is ${chainMargin.toFixed(2)}`
            )
            failed++
            continue
        }
        if (Math.abs(split.totalMargin - chainMargin) > 0.001) {
            console.log(
                `❌ ${tc.name}\n   totalMargin ${split.totalMargin} != chain margin ${chainMargin}`
            )
            failed++
            continue
        }
    }

    console.log(`✅ ${tc.name}`)
    passed++
}

console.log(`\n=== ${passed} passed, ${failed} failed ===`)
process.exit(failed > 0 ? 1 : 0)
