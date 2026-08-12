import { createServerClient } from './supabase'
import { createNotification } from './notification-service'
import { sendPushToUser } from './web-push'

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

        console.log(`[ShopSync DEBUG] Fetched order:`, { shop_name: order.shop_name, shop_order_id: order.shop_order_id })

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
                console.log(`[ShopSync] Found matching shop order ${shopOrderId} via reference lookup`)
                // Self-heal: update the main order with the missing ID
                await db.from('orders').update({ shop_order_id: shopOrderId }).eq('id', mainOrderId)
            }
        }

        // Fallback 3: Try to find shop order by shop_name + phone_number match
        if (!shopOrderId && order.shop_name && order.phone_number) {
            console.log(`[ShopSync DEBUG] Attempting fallback lookup via shop metadata...`)
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
                console.log(`[ShopSync] Found matching shop order ${shopOrderId} via shop metadata fallback`)
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

            // Notify shop owner when their order is completed
            if (status === 'completed') {
                try {
                    const { data: shopOrder } = await db
                        .from('shop_orders')
                        .select('network, package_size, guest_phone, selling_price, shop_id')
                        .eq('id', shopOrderId)
                        .single()

                    const { data: shopProfile } = await db
                        .from('shop_profiles')
                        .select('owner_id, shop_name')
                        .eq('id', shopOrder?.shop_id)
                        .single()

                    if (shopProfile?.owner_id && shopOrder) {
                        const msg = `${shopOrder.network} ${shopOrder.package_size} to ${shopOrder.guest_phone} — GHS ${Number(shopOrder.selling_price).toFixed(2)}`

                        createNotification({
                            userId: shopProfile.owner_id,
                            title: 'Shop Order Completed',
                            message: msg,
                            type: 'order_update',
                            actionUrl: '/dashboard/my-orders',
                        }).catch((e: any) => console.error('[ShopSync] In-app notify error:', e))

                        await sendPushToUser(shopProfile.owner_id, {
                            title: `${shopProfile.shop_name || 'Shop'}: Order Completed`,
                            body: msg,
                            url: '/dashboard/my-orders',
                        }).catch((e: any) => console.error('[ShopSync] Push notify error:', e))
                    }
                } catch (notifyErr) {
                    console.error('[ShopSync] Notify error (non-fatal):', notifyErr)
                }
            }
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
                console.log(`[ShopSync] airtime_orders synced to: ${status}`)
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
 *
 * Sub-agent orders (`hasUpline`) pay two wallets — the sub's markup and the
 * Lead's margin — so they route to credit_shop_order_profits(), which does both
 * legs in one transaction off shop_orders.profit / .parent_profit. Everything
 * else keeps the single-wallet credit_shop_profit() path unchanged, including
 * its JS fallback for databases where the RPC was never deployed.
 */
export async function creditShopProfit(
    shopOrderId: string,
    options?: { hasUpline?: boolean }
) {
    const supabase = createServerClient()
    const db = supabase as any
    const rpcName = options?.hasUpline ? 'credit_shop_order_profits' : 'credit_shop_profit'

    try {
        console.log(`[Profit] Attempting to credit profit for shop order ${shopOrderId} via ${rpcName}...`)

        const { data, error } = await db.rpc(rpcName, {
            p_shop_order_id: shopOrderId
        })

        if (error) {
            console.error(`[Profit] RPC Error for order ${shopOrderId}:`, error)
            // A sub order has no single-wallet equivalent — falling back would
            // pay the sub the Lead's margin as well. Surface it instead.
            if (options?.hasUpline) return
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
 * Credits a shop's markup on a Results Checker sale.
 *
 * RC sales don't produce a `shop_orders` row, so they can't go through
 * credit_shop_profit(). Every RC path calls this instead of hand-rolling the
 * wallet update: the storefront verify poll, finalizeRCGatewayOrder (the webhook
 * settlement), and USSD fulfilment.
 *
 * Idempotent on `reference`. The ledger insert — guarded by the unique index on
 * (reference, type) — is what claims the credit, and the balance only moves
 * after that insert succeeds. Checking for an existing row first and crediting
 * afterwards would let two concurrent settlements both pass the check and both
 * add to the balance, with only the loser's insert failing.
 */
export async function creditShopRcProfit(params: {
    ownerId: string
    amount: number
    description: string
    reference: string
}): Promise<{ credited: boolean; reason?: string }> {
    const { ownerId, amount, description, reference } = params
    const db = createServerClient() as any

    if (!ownerId || !(amount > 0)) return { credited: false, reason: 'nothing to credit' }

    try {
        let { data: wallet } = await db
            .from('shop_wallets')
            .select('id')
            .eq('owner_id', ownerId)
            .maybeSingle()

        if (!wallet) {
            const { data: newWallet } = await db
                .from('shop_wallets')
                .insert({ owner_id: ownerId, balance: 0, total_earned: 0 })
                .select('id')
                .single()
            wallet = newWallet
        }

        if (!wallet) return { credited: false, reason: 'wallet not found' }

        // Claim the credit. A duplicate reference trips the unique index, which is
        // how a replay or a concurrent settlement is rejected.
        const { error: txError } = await db.from('shop_wallet_transactions').insert({
            shop_wallet_id: wallet.id,
            type: 'profit',
            amount,
            net_amount: amount,
            description,
            reference,
            status: 'completed',
        })

        if (txError) {
            if (txError.code === '23505') return { credited: false, reason: 'already credited' }
            console.error('[RC Profit] Ledger insert failed:', txError)
            return { credited: false, reason: 'ledger insert failed' }
        }

        // Single-statement increment, so a concurrent credit on the same wallet
        // (a data order settling at the same moment) can't lose this one.
        const { error: rpcError } = await db.rpc('credit_shop_wallet_earning', {
            p_owner_id: ownerId,
            p_amount: amount,
        })

        if (rpcError) {
            // The ledger row is already committed, so leaving it would overstate
            // what was paid. Roll it back and let the caller's retry try again.
            console.error('[RC Profit] Balance credit failed, reverting ledger row:', rpcError)
            await db.from('shop_wallet_transactions')
                .delete()
                .eq('reference', reference)
                .eq('type', 'profit')
            return { credited: false, reason: 'balance credit failed' }
        }

        return { credited: true }
    } catch (err) {
        // Never block voucher delivery on a wallet write — the customer has paid
        // and the PIN matters more than the ledger, which can be reconciled.
        console.error('[RC Profit] Credit error:', err)
        return { credited: false, reason: 'error' }
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
