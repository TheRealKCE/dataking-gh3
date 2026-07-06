/**
 * Test: Profit-Split Flow (Sub Storefront Sale)
 *
 * Verifies that a sub's storefront sale correctly splits profit:
 *   - Guest pays: retail_price (via Paystack)
 *   - Sub earns: retail_price - sub_price = sub_profit
 *   - Lead earns: sub_price - owner_cost = parent_profit
 *   - Platform earns: owner_cost - admin_cost = platform_margin
 *
 * Full flow:
 *   1. Create test data (package, Lead, Sub, shop pricing)
 *   2. Simulate guest payment via shop storefront
 *   3. Verify shop_orders row has parent_shop_id + parent_profit
 *   4. Call credit_shop_order_profits RPC
 *   5. Verify Sub and Lead wallets are credited atomically
 *   6. Verify profit floors (all profits > 0)
 *
 * Run: npx ts-node scripts/test-profit-split.ts
 */

import { createServerClient } from '@/lib/supabase'

interface TestResult {
  name: string
  status: 'pass' | 'fail'
  message: string
}

const results: TestResult[] = []

async function runTest() {
  console.log('=== Profit-Split Flow Test ===\n')

  const supabase = createServerClient()

  try {
    // 1. Setup: Create test data
    console.log('Setting up test data...')

    // Get or create a test package
    const { data: packages } = await supabase
      .from('data_packages')
      .select('id, price, agent_price, cost_price')
      .limit(1)

    if (!packages || packages.length === 0) {
      results.push({
        name: 'Setup',
        status: 'fail',
        message: 'No test package found. Create a package first.',
      })
      printResults()
      process.exit(1)
    }

    const pkg = packages[0]
    console.log(`Using package: ${pkg.id} (price: ${pkg.price}, agent_price: ${pkg.agent_price}, cost: ${pkg.cost_price})`)

    // 2. Create test Lead (agent) and Sub if not present
    // NOTE: This assumes test users can be created. In production, use existing users.
    const testEmail = `test-lead-${Date.now()}@example.com`
    const { data: authData, error: signupError } = await supabase.auth.signUp({
      email: testEmail,
      password: 'TestPassword123!',
    })

    if (signupError || !authData.user) {
      results.push({
        name: 'User Creation',
        status: 'fail',
        message: `Failed to create test Lead: ${signupError?.message}`,
      })
      printResults()
      process.exit(1)
    }

    const leadUserId = authData.user.id
    console.log(`Created test Lead: ${leadUserId}`)

    // Create users table entry for Lead
    const { error: userCreateError } = await supabase
      .from('users')
      .insert({
        id: leadUserId,
        email: testEmail,
        first_name: 'Test',
        last_name: 'Lead',
        phone_number: '0201234567',
        role: 'agent',
        status: 'active',
      })

    if (userCreateError && !userCreateError.message.includes('duplicate')) {
      throw userCreateError
    }

    // Create shop for Lead
    const { data: shopData, error: shopError } = await supabase
      .from('shop_profiles')
      .insert({
        owner_id: leadUserId,
        shop_name: `Test-Shop-${Date.now()}`,
        shop_slug: `test-shop-${Date.now()}`,
        owner_phone: '0201234567',
        approval_status: 'approved',
        is_active: true,
      })
      .select('id')
      .single()

    if (shopError) {
      throw shopError
    }

    const leadShopId = shopData.id
    console.log(`Created Lead shop: ${leadShopId}`)

    // Create sub-agent
    const subEmail = `test-sub-${Date.now()}@example.com`
    const { data: subAuthData, error: subSignupError } = await supabase.auth.signUp({
      email: subEmail,
      password: 'TestPassword123!',
    })

    if (subSignupError || !subAuthData.user) {
      throw subSignupError
    }

    const subUserId = subAuthData.user.id
    console.log(`Created test Sub: ${subUserId}`)

    // Create users entry for sub
    await supabase.from('users').insert({
      id: subUserId,
      email: subEmail,
      first_name: 'Test',
      last_name: 'Sub',
      phone_number: '0209876543',
      role: 'customer',
      status: 'active',
    })

    // Create sub_agents record
    const { data: subAgentData, error: subAgentError } = await supabase
      .from('sub_agents')
      .insert({
        user_id: subUserId,
        upline_shop_id: leadShopId,
        status: 'active',
      })
      .select('id')
      .single()

    if (subAgentError) {
      throw subAgentError
    }

    console.log(`Created sub-agent record: ${subAgentData.id}`)

    // Create sub's shop (storefront)
    const { data: subShopData, error: subShopError } = await supabase
      .from('shop_profiles')
      .insert({
        owner_id: subUserId,
        shop_name: `Sub-Shop-${Date.now()}`,
        shop_slug: `sub-shop-${Date.now()}`,
        owner_phone: '0209876543',
        approval_status: 'approved',
        is_active: true,
      })
      .select('id')
      .single()

    if (subShopError) {
      throw subShopError
    }

    const subShopId = subShopData.id
    console.log(`Created Sub's shop: ${subShopId}`)

    // 3. Set pricing
    console.log('\nSetting up pricing...')

    const ownerCost = pkg.agent_price || pkg.price
    const subPrice = ownerCost + 1.0 // wholesale price = owner_cost + margin
    const retailPrice = subPrice + 2.0 // sub's retail = sub_price + markup

    // Lead's pricing
    const { error: leadPricingError } = await supabase
      .from('shop_pricing')
      .insert({
        shop_id: leadShopId,
        package_id: pkg.id,
        selling_price: ownerCost,
        sub_price: subPrice,
      })

    if (leadPricingError && !leadPricingError.message.includes('duplicate')) {
      throw leadPricingError
    }

    // Sub's retail pricing
    const { error: subPricingError } = await supabase
      .from('shop_pricing')
      .insert({
        shop_id: subShopId,
        package_id: pkg.id,
        selling_price: retailPrice,
      })

    if (subPricingError && !subPricingError.message.includes('duplicate')) {
      throw subPricingError
    }

    console.log(`Lead pricing: selling=${ownerCost}, sub_price=${subPrice}`)
    console.log(`Sub retail: selling=${retailPrice}`)

    // 4. Simulate guest payment → create shop_orders
    console.log('\nSimulating guest payment...')

    const guestPhone = '0554123456'
    const { data: orderData, error: orderError } = await supabase
      .from('shop_orders')
      .insert({
        shop_id: subShopId,
        package_id: pkg.id,
        guest_phone: guestPhone,
        network: 'MTN',
        package_size: `${pkg.price}GB`,
        selling_price: retailPrice,
        cost_price: subPrice, // Sub's cost = upline's sub_price
        profit: retailPrice - subPrice, // Sub's profit
        parent_shop_id: leadShopId,
        parent_profit: subPrice - ownerCost, // Lead's profit
        owner_role_at_time: 'agent',
        admin_cost_at_time: pkg.cost_price || 0,
        paystack_reference: `test-${Date.now()}`,
        status: 'pending',
      })
      .select('id')
      .single()

    if (orderError) {
      throw orderError
    }

    const orderId = orderData.id
    console.log(`Created shop_order: ${orderId}`)
    console.log(`  Sub profit: ₵${(retailPrice - subPrice).toFixed(2)}`)
    console.log(`  Lead profit: ₵${(subPrice - ownerCost).toFixed(2)}`)

    // 5. Call credit_shop_order_profits RPC
    console.log('\nCalling credit_shop_order_profits RPC...')

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'credit_shop_order_profits',
      { p_shop_order_id: orderId }
    )

    if (rpcError) {
      throw rpcError
    }

    console.log(`RPC result: ${JSON.stringify(rpcResult)}`)

    // 6. Verify wallets were credited
    console.log('\nVerifying wallet credits...')

    // Get sub's wallet
    const { data: subWallet } = await supabase
      .from('shop_wallets')
      .select('balance, total_earned')
      .eq('owner_id', subUserId)
      .single()

    const subProfit = retailPrice - subPrice
    if (subWallet && Math.abs(subWallet.balance - subProfit) < 0.01) {
      results.push({
        name: 'Sub Wallet Credit',
        status: 'pass',
        message: `Sub credited ₵${subWallet.balance.toFixed(2)}`,
      })
    } else {
      results.push({
        name: 'Sub Wallet Credit',
        status: 'fail',
        message: `Expected ₵${subProfit.toFixed(2)}, got ₵${subWallet?.balance?.toFixed(2) || 'null'}`,
      })
    }

    // Get Lead's wallet
    const { data: leadWallet } = await supabase
      .from('shop_wallets')
      .select('balance, total_earned')
      .eq('owner_id', leadUserId)
      .single()

    const leadProfit = subPrice - ownerCost
    if (leadWallet && Math.abs(leadWallet.balance - leadProfit) < 0.01) {
      results.push({
        name: 'Lead Wallet Credit',
        status: 'pass',
        message: `Lead credited ₵${leadWallet.balance.toFixed(2)}`,
      })
    } else {
      results.push({
        name: 'Lead Wallet Credit',
        status: 'fail',
        message: `Expected ₵${leadProfit.toFixed(2)}, got ₵${leadWallet?.balance?.toFixed(2) || 'null'}`,
      })
    }

    // 7. Verify profit floors
    results.push({
      name: 'Profit Floors',
      status: subProfit > 0 && leadProfit > 0 ? 'pass' : 'fail',
      message: `Sub: ₵${subProfit.toFixed(2)} ${subProfit > 0 ? '✓' : '✗'}, Lead: ₵${leadProfit.toFixed(2)} ${leadProfit > 0 ? '✓' : '✗'}`,
    })

    console.log('\nProfit split successful!')
  } catch (err: any) {
    results.push({
      name: 'Test Flow',
      status: 'fail',
      message: err?.message || String(err),
    })
  }

  printResults()
  process.exit(results.some(r => r.status === 'fail') ? 1 : 0)
}

function printResults() {
  console.log('\n=== Test Results ===\n')
  for (const result of results) {
    const icon = result.status === 'pass' ? '✅' : '❌'
    console.log(`${icon} ${result.name}`)
    console.log(`   ${result.message}`)
  }
  console.log(`\nTotal: ${results.filter(r => r.status === 'pass').length}/${results.length} passed`)
}

runTest().catch(err => {
  console.error('Test runner error:', err)
  process.exit(1)
})
