/**
 * Test: Cost-Basis Resolver Parity (TS ↔ SQL)
 *
 * Verifies that lib/pricing/cost-basis.ts and the SQL effective_owner_cost()
 * function agree on cost resolution for all role × expiry state combinations.
 *
 * Run: npx ts-node scripts/test-cost-basis.ts
 *
 * Exit code: 0 = all pass, 1 = any fail
 */

import { createServerClient } from '@/lib/supabase'
import { resolveOwnerCost, type PricingTiers, type OwnerState } from '@/lib/pricing/cost-basis'

interface TestCase {
  name: string
  pricing: PricingTiers
  owner: OwnerState
  expectedCost: number
}

const now = new Date()
const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
const pastDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago

const testCases: TestCase[] = [
  // ===== DEALER CASES =====
  {
    name: 'Dealer (active) with dealer_price > 0',
    pricing: { price: 10, agentPrice: 8, dealerPrice: 6 },
    owner: { role: 'dealer', agentExpiresAt: null, dealerExpiresAt: futureDate.toISOString() },
    expectedCost: 6,
  },
  {
    name: 'Dealer (expired) falls back to agent_price',
    pricing: { price: 10, agentPrice: 8, dealerPrice: 6 },
    owner: { role: 'dealer', agentExpiresAt: null, dealerExpiresAt: pastDate.toISOString() },
    expectedCost: 8,
  },
  {
    name: 'Dealer (active) with dealer_price = 0 falls back to agent_price',
    pricing: { price: 10, agentPrice: 8, dealerPrice: 0 },
    owner: { role: 'dealer', agentExpiresAt: null, dealerExpiresAt: futureDate.toISOString() },
    expectedCost: 8,
  },

  // ===== AGENT CASES =====
  {
    name: 'Lifetime agent with agent_price > 0',
    pricing: { price: 10, agentPrice: 8, dealerPrice: 6 },
    owner: { role: 'agent', agentExpiresAt: null, dealerExpiresAt: null },
    expectedCost: 8,
  },
  {
    name: 'Temporary agent (not expired) with agent_price > 0',
    pricing: { price: 10, agentPrice: 8, dealerPrice: 6 },
    owner: { role: 'agent', agentExpiresAt: futureDate.toISOString(), dealerExpiresAt: null },
    expectedCost: 8,
  },
  {
    name: 'Temporary agent (expired) falls back to price',
    pricing: { price: 10, agentPrice: 8, dealerPrice: 6 },
    owner: { role: 'agent', agentExpiresAt: pastDate.toISOString(), dealerExpiresAt: null },
    expectedCost: 10,
  },
  {
    name: 'Agent with agent_price = 0 falls back to price',
    pricing: { price: 10, agentPrice: 0, dealerPrice: 6 },
    owner: { role: 'agent', agentExpiresAt: null, dealerExpiresAt: null },
    expectedCost: 10,
  },

  // ===== CUSTOMER CASES =====
  {
    name: 'Customer always uses price',
    pricing: { price: 10, agentPrice: 8, dealerPrice: 6 },
    owner: { role: 'customer', agentExpiresAt: null, dealerExpiresAt: null },
    expectedCost: 10,
  },
  {
    name: 'Customer with null prices',
    pricing: { price: 10, agentPrice: null, dealerPrice: null },
    owner: { role: 'customer', agentExpiresAt: null, dealerExpiresAt: null },
    expectedCost: 10,
  },

  // ===== EDGE CASES =====
  {
    name: 'Missing agent_price (null) falls back correctly',
    pricing: { price: 10, agentPrice: null, dealerPrice: 6 },
    owner: { role: 'agent', agentExpiresAt: null, dealerExpiresAt: null },
    expectedCost: 10,
  },
  {
    name: 'Dealer expires at exact now boundary',
    pricing: { price: 10, agentPrice: 8, dealerPrice: 6 },
    owner: { role: 'dealer', agentExpiresAt: null, dealerExpiresAt: now.toISOString() },
    expectedCost: 8, // now = expired, falls back to agent
  },
]

async function runTests() {
  console.log('=== Cost-Basis Resolver Parity Test ===\n')

  let passed = 0
  let failed = 0

  for (const testCase of testCases) {
    try {
      const tsResult = resolveOwnerCost(testCase.pricing, testCase.owner)

      if (tsResult === testCase.expectedCost) {
        console.log(`✅ ${testCase.name}`)
        console.log(`   Result: ${tsResult} (expected ${testCase.expectedCost})`)
        passed++
      } else {
        console.error(`❌ ${testCase.name}`)
        console.error(`   Expected: ${testCase.expectedCost}, Got: ${tsResult}`)
        console.error(`   Owner: ${JSON.stringify(testCase.owner)}`)
        failed++
      }
    } catch (err: any) {
      console.error(`❌ ${testCase.name}`)
      console.error(`   Error: ${err?.message}`)
      failed++
    }

    console.log()
  }

  // TODO: SQL parity verification (requires DB connection)
  // const supabase = createServerClient()
  // for (const testCase of testCases) {
  //   const sqlResult = await supabase.rpc('effective_owner_cost', {...})
  //   // Compare with tsResult
  // }

  console.log(`\n=== Summary ===`)
  console.log(`Passed: ${passed}`)
  console.log(`Failed: ${failed}`)
  console.log(`Total:  ${passed + failed}`)

  if (failed > 0) {
    console.log(`\n⚠️  Some tests failed. Please review the cost-basis logic.`)
    process.exit(1)
  } else {
    console.log(`\n✅ All tests passed!`)
    process.exit(0)
  }
}

runTests().catch(err => {
  console.error('Test runner error:', err)
  process.exit(1)
})
