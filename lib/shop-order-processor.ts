import { createServerClient } from './supabase'
import { creditShopProfit } from './shop-service'
import { sendOrderSuccessSMS } from './sms-service'

// In-memory lock to prevent race conditions between frontend verification and Paystack webhooks
const processingLocks = new Set<string>();

/**
 * Shared logic for processing a successful shop storefront payment.
 * Handles idempotency, security amount validation, order creation, profit credit, and fulfillment.
 */
export async function processShopOrder(
    reference: string,
    metadata: {
        shop_id: string;
        package_id: string;
        guest_phone: string;
        network: string;
        package_size: string;
        fulfillment_mode?: string;
        order_type?: string;
        airtime_amount?: number;
        selling_price?: number;
        cost_price?: number;
        profit?: number;
    },
    paidAmountPesewas: number,
    slug?: string
): Promise<{ success: boolean; error?: string; orderId?: string; isDuplicate?: boolean }> {
    const supabase = createServerClient()
    const db = supabase as any

    try {
        console.log(`[Shop Order Processor] Processing Ref: ${reference}, Amount: ${paidAmountPesewas} pesewas`)

        // 0. High-Speed Memory Lock (prevents exact-millisecond race conditions on same Vercel lambda)
        if (processingLocks.has(reference)) {
            console.log(`[Shop Order Processor] Active lock found for ${reference}. Skipping duplicate execution.`);
            return { success: true, isDuplicate: true }
        }
        processingLocks.add(reference);

        // 1. Idempotency Check
        const { data: existingOrder } = await db
            .from('shop_orders')
            .select('id, status')
            .eq('paystack_reference', reference)
            .single()

        if (existingOrder) {
            // STRICT IDEMPOTENCY: If the order exists, another process handles/handled it.
            // Do NOT re-trigger fulfillment if it's pending to prevent double-charging DataKazina.
            if (['pending', 'processing', 'completed', 'delivered'].includes(existingOrder.status)) {
                console.log(`[Shop Order Processor] Idempotency: Order exists with status: ${existingOrder.status}. Skipping duplicate fulfillment.`)
                processingLocks.delete(reference);
                return { success: true, orderId: existingOrder.id, isDuplicate: true }
            }
        }

        // 2. Security: Verify Amount Against DB Prices (0.01 Attacker Protection)
        const { data: shopProfile } = await db
            .from('shop_profiles')
            .select('owner_id, shop_name, paystack_fee_percent, fulfillment_mode')
            .eq('id', metadata.shop_id)
            .single()

        if (!shopProfile) return { success: false, error: 'Shop profile not found' }

        let expectedTotalPesewas = 0
        let verifiedSellingPrice = 0
        let verifiedCostPrice = 0
        let verifiedProfit = 0
        let adminCostAtTime = 0

        const { data: ownerProfile } = await db
            .from('users')
            .select('role')
            .eq('id', shopProfile?.owner_id)
            .single()
            
        const ownerRole = ownerProfile?.role || 'customer'

        if (metadata.order_type === 'airtime') {
            const { data: settingsRows } = await db.from('admin_settings').select('key, value').in('key', [
                `airtime_fee_${metadata.network.toLowerCase()}_customer`, 
                `airtime_fee_${metadata.network.toLowerCase()}_agent`
            ])
            const settingsMap = (settingsRows || []).reduce((acc: any, curr: any) => ({ ...acc, [curr.key]: curr.value }), {})
            
            const shopFee = parseFloat((shopProfile as any)[`airtime_fee_${metadata.network.toLowerCase()}`] || 0)
            const adminFee = parseFloat(settingsMap[`airtime_fee_${metadata.network.toLowerCase()}_${ownerRole}`] || '0')
            const numAmount = metadata.airtime_amount || parseFloat(metadata.selling_price as any || '0')
            
            const totalFeeMultiplier = (shopFee + adminFee) / 100
            const feeAmount = numAmount * totalFeeMultiplier
            
            expectedTotalPesewas = Math.round((numAmount + feeAmount) * 100)
            verifiedSellingPrice = numAmount
            verifiedCostPrice = numAmount
            verifiedProfit = numAmount * (shopFee / 100)
            adminCostAtTime = numAmount
        } else {
            const { data: settingsRows } = await db.from('shop_global_settings').select('key, value').eq('key', 'shop_paystack_fee_percent')
            const globalFeePercent = settingsRows?.[0]?.value
            const paystackFeePercent = shopProfile?.paystack_fee_percent ?? parseFloat(globalFeePercent) ?? 1.95

            const { data: pkg } = await db.from('data_packages').select('price, agent_price, cost_price').eq('id', metadata.package_id).single()
            const { data: shopPrice } = await db.from('shop_pricing').select('selling_price').eq('shop_id', metadata.shop_id).eq('package_id', metadata.package_id).single()

            if (!shopPrice || !pkg) return { success: false, error: 'Price configuration missing' }

            const dbSellingPrice = parseFloat(shopPrice.selling_price)
            const paystackFee = Math.round(dbSellingPrice * (paystackFeePercent / 100) * 100) / 100
            expectedTotalPesewas = Math.round((dbSellingPrice + paystackFee) * 100)
            
            const isAgentOwner = ownerRole === 'agent' && parseFloat(pkg?.agent_price) > 0
            verifiedSellingPrice = dbSellingPrice
            verifiedCostPrice = isAgentOwner ? parseFloat(pkg?.agent_price) : (parseFloat(pkg?.price) || 0)
            verifiedProfit = dbSellingPrice - verifiedCostPrice
            adminCostAtTime = parseFloat(pkg?.cost_price) || 0
        }

        const amountDifference = Math.abs(paidAmountPesewas - expectedTotalPesewas)

        // 3. Create/Update Order Records
        let orderId = existingOrder?.id
        const fulfillmentMode = shopProfile?.fulfillment_mode || metadata.fulfillment_mode || 'auto'

        if (!existingOrder) {
            const payload = {
                shop_id: metadata.shop_id,
                package_id: metadata.package_id || null, // null for airtime
                guest_phone: metadata.guest_phone,
                network: metadata.network,
                package_size: metadata.package_size || `${metadata.airtime_amount} Airtime`,
                selling_price: verifiedSellingPrice,
                cost_price: verifiedCostPrice,
                profit: verifiedProfit,
                admin_cost_at_time: adminCostAtTime,
                owner_role_at_time: ownerRole,
                paystack_reference: reference,
                status: 'pending'
            }
            
            const { data: newOrder, error: createError } = await db
                .from('shop_orders')
                .insert(payload)
                .select('id')
                .single()

            if (createError) {
                console.error('[Shop Order Processor] Failed to create shop order:', createError)
                return { success: false, error: 'Order creation failed' }
            }
            orderId = newOrder?.id

            await db.from('orders').insert({
                user_id: shopProfile?.owner_id,
                phone_number: metadata.guest_phone,
                network: metadata.network,
                size: metadata.package_size || `${metadata.airtime_amount} Airtime`,
                price: verifiedSellingPrice,
                cost_price_at_time: verifiedCostPrice,
                role_at_time: ownerRole,
                status: 'pending',
                payment_status: 'paid',
                reference_code: `SHOP-${reference.slice(-10)}`,
                fulfillment_method: 'auto',
                order_type: metadata.order_type || 'data',
                shop_name: shopProfile?.shop_name || slug,
                shop_order_id: orderId
            })

            // IMPORTANT: If it's an airtime order, mirror it to the primary airtime_orders ledger 
            // so admins can view and fulfill it in the Airtime Intelligence page under 'Shop orders'
            if (metadata.order_type === 'airtime') {
                const totalPaidGHS = expectedTotalPesewas / 100;
                const totalFeeAmount = totalPaidGHS - verifiedSellingPrice;
                const totalFeeRate = verifiedSellingPrice > 0 ? (totalFeeAmount / verifiedSellingPrice) * 100 : 0;
                
                await db.from('airtime_orders').insert({
                    user_id: shopProfile?.owner_id,
                    user_role: ownerRole,
                    beneficiary_phone: metadata.guest_phone,
                    network: metadata.network,
                    airtime_amount: verifiedSellingPrice, // Value requested
                    fee_rate: totalFeeRate,         // Total markup%
                    fee_amount: totalFeeAmount,
                    total_paid: totalPaidGHS, // Total charged in GHS
                    use_exact_amount: false,
                    status: 'pending',
                    reference_code: `SHOP-${reference.slice(-10)}`, // Same reference so downward sync hooks it
                    shop_id: metadata.shop_id,
                    shop_name: shopProfile?.shop_name || slug
                })
            }
        }

        // 4. Security Enforcement: Amount Validation
        if (amountDifference > 5) {
            console.error(`[Shop Order Processor] 🚨 AMOUNT MISMATCH: Ref: ${reference}, Paid: ${paidAmountPesewas}, Expected: ${expectedTotalPesewas}`)
            await db.from('shop_orders').update({ status: 'failed' }).eq('id', orderId)
            await db.from('orders').update({ status: 'failed' }).eq('shop_order_id', orderId)
            return { success: false, error: 'Payment amount mismatch' }
        }

        // 5. Process Valid Order
        if (metadata.guest_phone) {
            sendOrderSuccessSMS(metadata.guest_phone, {
                network: metadata.network,
                size: metadata.package_size || `${metadata.airtime_amount} Airtime`,
                price: verifiedSellingPrice,
                recipientNumber: metadata.guest_phone,
                currentBalance: 0
            }).catch((err: Error) => console.error('[Shop Order Processor] SMS error:', err))
        }

        // 5.2 Credit Profit
        try {
            await creditShopProfit(orderId!)
        } catch (profitErr) {
            console.error('[Shop Order Processor] Profit credit error:', profitErr)
        }

        // 5.3 Trigger Fulfillment
        try {
            const fulfillmentPayload = metadata.order_type === 'airtime' 
               ? { amount: metadata.airtime_amount || verifiedSellingPrice }
               : { size: metadata.package_size }
            
            await triggerShopFulfillment(orderId!, metadata.network, metadata.guest_phone, db, {
                referenceCode: `SHOP-${reference.slice(-10)}`,
                price: verifiedSellingPrice,
                customerName: 'Shop Guest',
                customerEmail: 'N/A',
                shopName: shopProfile?.shop_name || slug || shopProfile?.shop_name,
                fulfillmentMode,
                orderType: metadata.order_type || 'data',
                ...fulfillmentPayload
            })
        } catch (fulfillErr) {
            console.error('[Shop Order Processor] Fulfillment error:', fulfillErr)
        }

        return { success: true, orderId }

    } catch (error) {
        console.error('[Shop Order Processor] Critical error:', error)
        return { success: false, error: 'Internal processor error' }
    } finally {
        // Clear lock after processing completes or fails
        processingLocks.delete(reference);
    }
}

async function triggerShopFulfillment(
    orderId: string,
    network: string,
    phone: string,
    db: any,
    extra: {
        referenceCode: string
        price: number
        customerName: string
        customerEmail: string
        shopName: string
        fulfillmentMode: string
        orderType: string
        amount?: number
        size?: string
    }
) {
    const { sendAdminNewOrderAlert } = await import('./email-service')

    const alertDetails = {
        referenceCode: extra.referenceCode,
        phoneNumber: phone,
        network: network,
        size: extra.size || `${extra.amount} Airtime`,
        price: extra.price,
        customerName: extra.customerName,
        customerEmail: extra.customerEmail,
        source: 'shop_storefront' as const,
        shopName: extra.shopName
    }

    if (extra.fulfillmentMode !== 'auto' || extra.orderType === 'airtime') {
        console.log(`[Shop Order Processor] Manual fulfillment required - sending alert`)
        await sendAdminNewOrderAlert({
            ...alertDetails,
            reason: extra.orderType === 'airtime' ? 'Airtime requires manual fulfillment' : 'Manual fulfillment mode enabled for this shop'
        }).catch(e => console.error('[Shop Order Processor] Admin Alert Error:', e))
        
        if (extra.orderType === 'airtime') {
            try {
                const { sendAdminAirtimeAlertSMS } = await import('./sms-service')
                const { data: admins } = await db.from('users').select('phone_number').eq('role', 'admin')
                const adminPhones = admins?.map((a: any) => a.phone_number).filter(Boolean) || []
                if (adminPhones.length > 0) {
                    await sendAdminAirtimeAlertSMS(adminPhones, {
                        source: `${extra.customerName} / ${extra.shopName} (Shop)`,
                        receiver: phone,
                        amount: extra.amount || extra.price,
                        network: network
                    })
                }
            } catch (err) {
                console.error('[Shop Order Processor] Admin SMS Error:', err)
            }
        }
        return
    }

    try {
        const { fulfillOrder } = await import('./fulfillment-service')

        // Check global auto-fulfillment toggle
        const { data: settingsData } = await db
            .from('admin_settings')
            .select('key, value')
            .in('key', ['auto_fulfillment_enabled', 'fulfillment_settings'])

        const settingsMap = (settingsData || []).reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value
            return acc
        }, {})

        if (settingsMap.auto_fulfillment_enabled === 'false') {
            console.log(`[Shop Order Processor] Auto-fulfillment globally disabled`)
            await sendAdminNewOrderAlert({ ...alertDetails, reason: 'Global auto-fulfillment is disabled' })
            return
        }

        let fulfillmentSettings = { networks: {} as Record<string, boolean> }
        try {
            if (settingsMap.fulfillment_settings) {
                fulfillmentSettings = typeof settingsMap.fulfillment_settings === 'string'
                    ? JSON.parse(settingsMap.fulfillment_settings)
                    : settingsMap.fulfillment_settings
            }
        } catch (e) { /* ignore */ }

        const isNetworkEnabled = fulfillmentSettings.networks[network] !== false
        if (!isNetworkEnabled) {
            console.log(`[Shop Order Processor] Auto-fulfillment disabled for ${network}`)
            await sendAdminNewOrderAlert({ ...alertDetails, reason: `Auto-fulfillment is disabled for network: ${network}` })
            return
        }

        // const isFraud = await checkFraudSignals(null as unknown as string, phone, db)
        // if (isFraud) {
        //     await logSuspiciousActivity('guest', 'shop_order', 'fraud detected', db)
        // 
        //     await db.from('shop_orders').update({
        //         status: 'failed_security_check',
        //         updated_at: new Date().toISOString()
        //     }).eq('id', orderId)
        // 
        //     await db.from('orders').update({
        //         status: 'failed_security_check'
        //     }).eq('shop_order_id', orderId)
        // 
        //     console.warn(`[Shop Order Processor] Blocked fulfillment for order ${orderId} due to fraud detection`)
        //     return
        // }

        const result = await fulfillOrder(network, phone, extra.size || '', orderId)

        if (result.success) {
            const updatedAt = new Date().toISOString()
            await db.from('shop_orders').update({
                status: 'processing',
                updated_at: updatedAt,
            }).eq('id', orderId)

            await db.from('orders').update({
                status: 'processing'
            }).eq('shop_order_id', orderId)

            console.log(`[Shop Order Processor] Fulfillment success for order ${orderId}`)
        } else {
            console.error(`[Shop Order Processor] Fulfillment failed for order ${orderId}:`, result.error)
            await sendAdminNewOrderAlert({ ...alertDetails, reason: `Auto-fulfillment API error: ${result.error || 'Unknown error'}` })
        }
    } catch (err) {
        console.error(`[Shop Order Processor] Fulfillment exception for order ${orderId}:`, err)
        await sendAdminNewOrderAlert({ ...alertDetails, reason: `System Exception during fulfillment: ${err instanceof Error ? err.message : 'Unknown exception'}` })
    }
}
