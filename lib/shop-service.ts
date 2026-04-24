import { createServerClient } from './supabase'

/**
 * Syncs order status between mirrored main orders and original shop orders.
 * Also handles profit credit upon order completion.
 */
export async function syncShopOrderStatus(mainOrderId: string, status: string) {
    const supabase = createServerClient()
    const db = supabase as any

    console.log(`[ShopSync DEBUG] Starting sync for Order ${mainOrderId} -> Status: ${status}`)

    try {
        // 1. Fetch main order to see if it's linked to a shop order
        // NOTE: Including reference_code for fallback mapping
        const { data: order, error: orderError } = await db
            .from('orders')
            .select('id, shop_name, shop_order_id, reference_code, price, cost_price_at_time, status, phone_number')
            .eq('id', mainOrderId)
            .single()

        if (orderError) {
            console.error(`[ShopSync DEBUG] Error fetching main order:`, orderError)
            return
        }

        if (!order) {
            console.error(`[ShopSync DEBUG] Main order ${mainOrderId} not found`)
            return
        }

        console.log(`[ShopSync DEBUG] Fetched order:`, { shop_name: order.shop_name, shop_order_id: order.shop_order_id, ref: order.reference_code })

        // If it's not a shop order, skip
        if (!order.shop_order_id && !order.shop_name) {
            console.log(`[ShopSync] Order ${mainOrderId} is not a shop order, skipping sync.`)
            return
        }

        let shopOrderId = order.shop_order_id

        // Fallback: If shop_order_id is missing, try to find it via reference mapping
        // (Useful for existing orders tagged before we added shop_order_id col)
        if (!shopOrderId && order.reference_code?.startsWith('SHOP-')) {
            console.log(`[ShopSync DEBUG] Attempting fallback lookup via reference...`)
            const refSuffix = order.reference_code.replace('SHOP-', '')
            const { data: sOrder, error: lookupError } = await db
                .from('shop_orders')
                .select('id')
                .ilike('paystack_reference', `%${refSuffix}`)
                .single()

            if (lookupError) {
                console.error(`[ShopSync DEBUG] Fallback lookup failed:`, lookupError)
            }

            if (sOrder) {
                shopOrderId = sOrder.id
                console.log(`[ShopSync] Found matching shop order ${shopOrderId} via reference ${order.reference_code}`)
                // Self-heal: update the main order with the missing ID
                await db.from('orders').update({ shop_order_id: shopOrderId }).eq('id', mainOrderId)
            }
        }

        // Fallback 3: Try to find shop order by shop_name + phone_number match
        if (!shopOrderId && order.shop_name && order.phone_number) {
            console.log(`[ShopSync DEBUG] Attempting fallback lookup via shop_name/phone_number...`)
            const { data: sOrder, error: lookupError } = await db
                .from('shop_orders')
                .select('id')
                .eq('shop_name', order.shop_name)
                .eq('phone_number', order.phone_number)
                .limit(1)
                .single()

            if (lookupError && lookupError.code !== 'PGRST116') {
                console.error(`[ShopSync DEBUG] Fallback 3 lookup failed:`, lookupError)
            }

            if (sOrder) {
                shopOrderId = sOrder.id
                console.log(`[ShopSync] Found matching shop order ${shopOrderId} via shop_name/phone_number fallback`)
                // Self-heal: update the main order with the missing ID
                await db.from('orders').update({ shop_order_id: shopOrderId }).eq('id', mainOrderId)
            }
        }

        if (!shopOrderId) {
            console.warn(`[ShopSync] Could not find shop order ID for main order ${mainOrderId}`)
            return
        }

        console.log(`[ShopSync] Syncing shop order ${shopOrderId} to status: ${status}`)

        // 2. Update shop_orders status
        const { error: updateError } = await db
            .from('shop_orders')
            .update({
                status: status,
                updated_at: new Date().toISOString()
            })
            .eq('id', shopOrderId)

        if (updateError) {
            console.error(`[ShopSync] Failed to update shop order ${shopOrderId}:`, updateError)
        } else {
            console.log(`[ShopSync DEBUG] Successfully updated shop order status.`)
        }

        // 3b. If it's an airtime order (SHOP- reference), also sync airtime_orders
        if (order.reference_code?.startsWith('SHOP-')) {
            const { error: airtimeError } = await db
                .from('airtime_orders')
                .update({ status, updated_at: new Date().toISOString() })
                .eq('reference_code', order.reference_code)

            if (airtimeError) {
                console.warn(`[ShopSync] Could not sync airtime_orders for ref ${order.reference_code}:`, airtimeError)
            } else {
                console.log(`[ShopSync] airtime_orders synced to: ${status} for ref ${order.reference_code}`)
            }
        }

        // 4. Profit is now credited immediately at payment time (in /api/shop/verify).
        // No longer credited here on 'completed' to prevent double-crediting.
        console.log(`[ShopSync] Status synced to: ${status}. Profit crediting is handled at payment time.`)
    } catch (err) {
        console.error('[ShopSync] Unexpected error:', err)
    }
}

/**
 * Credits profit to the shop wallet if not already credited.
 */
export async function creditShopProfit(shopOrderId: string) {
    const supabase = createServerClient()
    const db = supabase as any

    try {
        console.log(`[Profit] Attempting to credit profit for shop order ${shopOrderId}...`)

        const { data, error } = await db.rpc('credit_shop_profit', {
            p_shop_order_id: shopOrderId
        })

        if (error) {
            console.error(`[Profit] RPC Error for order ${shopOrderId}:`, error)
            // PGRST202 means function not found
            if (error.code === 'PGRST202' || error.message?.includes('Could not find the function')) {
                console.log(`[Profit] Falling back to manual JS credit for order ${shopOrderId}...`)
                await creditShopProfitFallback(shopOrderId, db)
            }
            return
        }

        if (data && !data.success) {
            console.log(`[Profit] Skipped/Failed: ${data.message} (Order ${shopOrderId})`)
        } else {
            console.log(`[Profit] Success: ${data.message} (Order ${shopOrderId})`)
        }

    } catch (err) {
        console.error('[Profit] Unexpected error:', err)
    }
}

/**
 * Fallback to manually credit profit if the RPC function is missing from the database.
 */
async function creditShopProfitFallback(shopOrderId: string, db: any) {
    try {
        const { data: order } = await db
            .from('shop_orders')
            .select('profit, network, package_size, guest_phone, shop_id')
            .eq('id', shopOrderId)
            .single()

        if (!order || !order.profit || order.profit <= 0) {
            console.log('[Profit Fallback] No profit to credit or order not found')
            return
        }

        const { data: shop } = await db.from('shop_profiles').select('owner_id, shop_name').eq('id', order.shop_id).single()
        if (!shop) return console.log('[Profit Fallback] Shop not found')

        const { data: existingTx } = await db
            .from('shop_wallet_transactions')
            .select('id')
            .eq('shop_order_id', shopOrderId)
            .eq('type', 'profit')
            .maybeSingle()

        if (existingTx) {
            console.log(`[Profit Fallback] Already credited (Order ${shopOrderId})`)
            return
        }

        let { data: wallet } = await db.from('shop_wallets').select('id, balance, total_earned').eq('owner_id', shop.owner_id).maybeSingle()

        if (!wallet) {
            const { data: newWallet } = await db.from('shop_wallets').insert({ owner_id: shop.owner_id, balance: 0, total_earned: 0 }).select().single()
            wallet = newWallet
        }

        if (!wallet) return console.log('[Profit Fallback] Wallet not found/created')

        const newBalance = parseFloat((wallet.balance || 0).toString()) + parseFloat(order.profit.toString())
        const newTotal = parseFloat((wallet.total_earned || 0).toString()) + parseFloat(order.profit.toString())

        await db.from('shop_wallets').update({ 
            balance: newBalance, 
            total_earned: newTotal, 
            updated_at: new Date().toISOString() 
        }).eq('id', wallet.id)

        await db.from('shop_wallet_transactions').insert({
            shop_wallet_id: wallet.id,
            shop_order_id: shopOrderId,
            type: 'profit',
            amount: order.profit,
            description: `Sale: ${order.network} ${order.package_size || 'Airtime'} to ${order.guest_phone || 'Guest'}`,
            status: 'completed'
        })

        console.log(`[Profit Fallback] Success: Credited ${order.profit} to wallet ${wallet.id}`)
    } catch (fallbackErr) {
        console.error('[Profit Fallback] Critical error:', fallbackErr)
    }
}
