import { createServerClient } from './supabase'

/**
 * Syncs order status between mirrored main orders and original shop orders.
 * Also handles profit credit upon order completion.
 */
export async function syncShopOrderStatus(mainOrderId: string, status: string) {
    const supabase = createServerClient()
    const db = supabase as any

    try {
        // 1. Fetch main order to see if it's linked to a shop order
        // NOTE: Including reference_code for fallback mapping
        const { data: order, error: orderError } = await db
            .from('orders')
            .select('id, shop_name, shop_order_id, reference_code, price, cost_price, status')
            .eq('id', mainOrderId)
            .single()

        if (orderError || !order) return

        // If it's not a shop order, skip
        if (!order.shop_order_id && !order.shop_name) {
            console.log(`[ShopSync] Order ${mainOrderId} is not a shop order, skipping sync.`)
            return
        }

        let shopOrderId = order.shop_order_id

        // Fallback: If shop_order_id is missing, try to find it via reference mapping
        // (Useful for existing orders tagged before we added shop_order_id col)
        if (!shopOrderId && order.reference_code?.startsWith('SHOP-')) {
            const refSuffix = order.reference_code.replace('SHOP-', '')
            const { data: sOrder } = await db
                .from('shop_orders')
                .select('id')
                .ilike('paystack_reference', `%${refSuffix}`)
                .single()

            if (sOrder) {
                shopOrderId = sOrder.id
                console.log(`[ShopSync] Found matching shop order ${shopOrderId} via reference ${order.reference_code}`)
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
        }

        // 3. Handle Profit Credit on 'completed'
        if (status === 'completed') {
            await creditShopProfit(shopOrderId)
        }
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
        // 1. Fetch shop order details
        const { data: sOrder, error: sOrderError } = await db
            .from('shop_orders')
            .select('*, shop_profiles(owner_id)')
            .eq('id', shopOrderId)
            .single()

        if (sOrderError || !sOrder || sOrder.profit <= 0) {
            console.log(`[Profit] Order ${shopOrderId} has no profit or wasn't found.`)
            return
        }

        const ownerId = sOrder.shop_profiles?.owner_id
        if (!ownerId) {
            console.error(`[Profit] Could not find owner for shop order ${shopOrderId}`)
            return
        }

        // 2. Check for existing profit transaction for this shop order (Idempotency)
        const { data: existingTx } = await db
            .from('shop_wallet_transactions')
            .select('id')
            .eq('shop_order_id', shopOrderId)
            .eq('type', 'profit')
            .single()

        if (existingTx) {
            console.log(`[Profit] Already credited for order ${shopOrderId}`)
            return
        }

        // 3. Credit wallet and log transaction
        const profit = parseFloat(sOrder.profit) || 0

        // Get or create wallet
        const { data: wallet } = await db
            .from('shop_wallets')
            .select('id, balance, total_earned')
            .eq('owner_id', ownerId)
            .single()

        if (!wallet) {
            console.error(`[Profit] No wallet found for owner ${ownerId}`)
            return
        }

        // Atomic update
        const { error: walletError } = await db
            .from('shop_wallets')
            .update({
                balance: (parseFloat(wallet.balance) || 0) + profit,
                total_earned: (parseFloat(wallet.total_earned) || 0) + profit,
                updated_at: new Date().toISOString(),
            })
            .eq('id', wallet.id)

        if (walletError) {
            console.error(`[Profit] Failed to update wallet ${wallet.id}:`, walletError)
            throw walletError
        }

        // Log transaction
        await db.from('shop_wallet_transactions').insert({
            shop_wallet_id: wallet.id,
            shop_order_id: shopOrderId,
            type: 'profit',
            amount: profit,
            description: `Sale: ${sOrder.network} ${sOrder.package_size} to ${sOrder.guest_phone}`,
            status: 'completed',
        })

        console.log(`[Profit] Successfully credited ${profit} to wallet ${wallet.id} for order ${shopOrderId}`)

    } catch (err) {
        console.error('[Profit] Credit error:', err)
    }
}
