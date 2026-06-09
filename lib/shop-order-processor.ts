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
        type?: string;           // 'airtime' | 'mashup' — mirrors the airtime_orders.type column
        bundle_preference?: string; // 'balanced' | 'data' | 'voice' — Mashup only
        airtime_amount?: number;
        selling_price?: number;
        cost_price?: number;
        profit?: number;
        use_exact_amount?: boolean;
        original_amount?: number;
    },
    paidAmountPesewas: number,
    slug?: string
): Promise<{ success: boolean; error?: string; orderId?: string; isDuplicate?: boolean }> {
    const supabase = createServerClient()
    const db = supabase as any

    try {
        console.log(`[Shop Order Processor] Processing paid shop order`)

        // 0. High-Speed Memory Lock (prevents exact-millisecond race conditions on same Vercel lambda)
        if (processingLocks.has(reference)) {
            console.log(`[Shop Order Processor] Active lock found. Skipping duplicate execution.`);
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

        // 2. Security: Verify Amount Against DB Prices
        // A1 — Added airtime_fee_mtn, airtime_fee_telecel, airtime_fee_at to select
        const { data: shopProfile } = await db
            .from('shop_profiles')
            .select('owner_id, shop_name, paystack_fee_percent, fulfillment_mode, airtime_fee_mtn, airtime_fee_telecel, airtime_fee_at')
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
            
            // A1 — shopFeeKey now reads correctly because columns were added to the select above
            const shopFeeKey = `airtime_fee_${metadata.network.toLowerCase()}`
            const shopFee = parseFloat((shopProfile as any)[shopFeeKey] || 0)
            const adminFee = parseFloat(settingsMap[`airtime_fee_${metadata.network.toLowerCase()}_${ownerRole}`] || '0')
            
            const originalAmount = parseFloat((metadata.original_amount || metadata.airtime_amount || metadata.selling_price || '0') as any)
            
            const totalFeeMultiplier = (shopFee + adminFee) / 100
            const feeAmount = originalAmount * totalFeeMultiplier
            
            let actualAirtimeAmount = originalAmount
            const exactFlag = metadata.use_exact_amount
            const isExact = exactFlag === true || String(exactFlag) === 'true'
            
            if (isExact || exactFlag === undefined) {
                // If it's an old pending order without the flag, it behaves like exact mode
                expectedTotalPesewas = Math.round((originalAmount + feeAmount) * 100)
            } else {
                expectedTotalPesewas = Math.round(originalAmount * 100)
                actualAirtimeAmount = Math.max(0, originalAmount - feeAmount)
            }
            
            verifiedSellingPrice = actualAirtimeAmount
            verifiedCostPrice = actualAirtimeAmount
            // BUG FIX: Profit should be calculated on originalAmount (the amount the fee % was applied to),
            // NOT on actualAirtimeAmount (after fee deduction). Using actualAirtimeAmount caused a small
            // compounding under-credit each transaction.
            verifiedProfit = originalAmount > 0 ? originalAmount * (shopFee / 100) : 0
            adminCostAtTime = actualAirtimeAmount
        } else {
            // --- Role-Aware Paystack Fee Resolution ---
            // Priority: per-shop override → role-specific global → legacy global → hardcoded default
            // A per-shop override of exactly 0 means "deliberately free for this shop".
            // Only null means "inherit from global".
            let paystackFeePercent = 1.95 // hardcoded last-resort default

            // Fetch all relevant fee keys in one query for efficiency
            const { data: paystackSettingsRows } = await db
                .from('shop_global_settings')
                .select('key, value')
                .in('key', [
                    `shop_paystack_fee_percent_${ownerRole}`,
                    'shop_paystack_fee_percent',
                ])
            const paystackSettingsMap: Record<string, string> = {}
            for (const row of (paystackSettingsRows || [])) {
                paystackSettingsMap[row.key] = row.value
            }

            if (shopProfile?.paystack_fee_percent !== null && shopProfile?.paystack_fee_percent !== undefined) {
                // Explicit per-shop override set by admin (0 = deliberately free)
                paystackFeePercent = parseFloat(shopProfile.paystack_fee_percent)
            } else if (paystackSettingsMap[`shop_paystack_fee_percent_${ownerRole}`] != null) {
                // Role-specific global setting (customer or agent)
                paystackFeePercent = parseFloat(paystackSettingsMap[`shop_paystack_fee_percent_${ownerRole}`])
            } else if (paystackSettingsMap['shop_paystack_fee_percent'] != null) {
                // Legacy fallback global key (backward compatibility)
                paystackFeePercent = parseFloat(paystackSettingsMap['shop_paystack_fee_percent'])
            }
            // else: keep hardcoded default 1.95

            const { data: pkg } = await db.from('data_packages').select('price, agent_price, cost_price').eq('id', metadata.package_id).single()
            const { data: shopPrice } = await db.from('shop_pricing').select('selling_price').eq('shop_id', metadata.shop_id).eq('package_id', metadata.package_id).single()

            if (!shopPrice || !pkg) return { success: false, error: 'Price configuration missing' }

            const dbSellingPrice = parseFloat(shopPrice.selling_price)
            const paystackFee = Math.round(dbSellingPrice * (paystackFeePercent / 100) * 100) / 100
            expectedTotalPesewas = Math.round((dbSellingPrice + paystackFee) * 100)
            
            // BUG FIX: Original code only checked for 'agent', completely ignoring 'dealer'.
            // Dealers were falling through to the standard customer price, losing their tier discount.
            const isDealerOwner = ownerRole === 'dealer' && parseFloat(pkg?.dealer_price) > 0
            const isAgentOwner  = ownerRole === 'agent'  && parseFloat(pkg?.agent_price)  > 0
            verifiedSellingPrice = dbSellingPrice
            if (isDealerOwner) {
                verifiedCostPrice = parseFloat(pkg?.dealer_price)
            } else if (isAgentOwner) {
                verifiedCostPrice = parseFloat(pkg?.agent_price)
            } else {
                verifiedCostPrice = parseFloat(pkg?.price) || 0
            }
            verifiedProfit = dbSellingPrice - verifiedCostPrice
            adminCostAtTime = parseFloat(pkg?.cost_price) || 0
        }

        const amountDifference = Math.abs(paidAmountPesewas - expectedTotalPesewas)

        // A2 — SECURITY: Amount validation runs BEFORE any order creation
        if (amountDifference > 5) {
            console.error(`[Shop Order Processor] 🚨 AMOUNT MISMATCH: Ref: ${reference}, Paid: ${paidAmountPesewas}, Expected: ${expectedTotalPesewas}`)

            // B5 — Audit trail: persist mismatch for fraud monitoring
            try {
                await db.from('security_events').insert({
                    event_type: 'airtime_amount_mismatch',
                    reference,
                    shop_id: metadata.shop_id,
                    paid_amount: paidAmountPesewas,
                    expected_amount: expectedTotalPesewas,
                    guest_phone: metadata.guest_phone,
                    network: metadata.network,
                    order_type: metadata.order_type || 'data',
                    created_at: new Date().toISOString()
                })
            } catch (auditErr) {
                // Non-fatal — log but continue returning the error
                console.warn('[Shop Order Processor] Audit log failed:', auditErr)
            }

            // A5 — Safety net: if an existingOrder record was found (already in DB), update all tables to failed
            if (existingOrder?.id) {
                await db.from('shop_orders').update({ status: 'failed' }).eq('id', existingOrder.id)
                await db.from('orders').update({ status: 'failed' }).eq('shop_order_id', existingOrder.id)
                await db.from('airtime_orders')
                    .update({ status: 'failed' })
                    .eq('reference_code', `SHOP-${reference.slice(-10)}`)
            }

            return { success: false, error: 'Payment amount mismatch' }
        }

        // 3. Create Order Records (only runs after amount validation passes)
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
                shop_name: shopProfile?.shop_name || slug,
                shop_order_id: orderId
            })

            // Mirror airtime orders to the primary airtime_orders ledger
            // so admins can view and fulfill them in the Airtime Intelligence page
            if (metadata.order_type === 'airtime') {
                // A3 — Use actual paid amount (paidAmountPesewas), NOT expectedTotalPesewas
                const totalPaidGHS = paidAmountPesewas / 100
                const totalFeeAmount = Math.max(0, totalPaidGHS - verifiedSellingPrice)
                const totalFeeRate = verifiedSellingPrice > 0 ? (totalFeeAmount / verifiedSellingPrice) * 100 : 0

                // A4 — Read use_exact_amount from metadata instead of hardcoding false
                const useExactAmountFlag = metadata.use_exact_amount === true || String(metadata.use_exact_amount) === 'true'
                
                await db.from('airtime_orders').insert({
                    user_id: shopProfile?.owner_id,
                    user_role: ownerRole,
                    beneficiary_phone: metadata.guest_phone,
                    network: metadata.network,
                    airtime_amount: verifiedSellingPrice, // Net airtime value credited
                    fee_rate: totalFeeRate,               // Combined markup %
                    fee_amount: totalFeeAmount,            // Total fee in GHS
                    total_paid: totalPaidGHS,              // Actual amount charged to customer
                    use_exact_amount: useExactAmountFlag,
                    // Mashup: forward type and bundle_preference so admin page shows correct badge
                    type: metadata.type || 'airtime',
                    bundle_preference: metadata.bundle_preference || null,
                    status: 'pending',
                    reference_code: `SHOP-${reference.slice(-10)}`,
                    shop_id: metadata.shop_id,
                    shop_name: shopProfile?.shop_name || slug
                })
            }
        }

        // 4. Process Valid Order — SMS, Profit Credit, Fulfillment
        if (metadata.guest_phone) {
            sendOrderSuccessSMS(metadata.guest_phone, {
                network: metadata.network,
                size: metadata.package_size || `${metadata.airtime_amount} Airtime`,
                price: verifiedSellingPrice,
                recipientNumber: metadata.guest_phone,
                currentBalance: 0
            }).catch((err: Error) => console.error('[Shop Order Processor] SMS error:', err))
        }

        // 4.2 Credit Profit
        try {
            await creditShopProfit(orderId!)
        } catch (profitErr) {
            console.error('[Shop Order Processor] Profit credit error:', profitErr)
        }

        // 4.3 Trigger Fulfillment
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
                orderType: metadata.type || metadata.order_type || 'data',
                bundlePreference: metadata.bundle_preference,
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
        bundlePreference?: string
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

    if (extra.fulfillmentMode !== 'auto' || extra.orderType === 'airtime' || extra.orderType === 'mashup') {
        console.log(`[Shop Order Processor] Manual fulfillment required - sending alert`)
        
        if (extra.orderType === 'airtime' || extra.orderType === 'mashup') {
            const { sendAdminAirtimeOrderEmail } = await import('./email-service')
            await sendAdminAirtimeOrderEmail({
                referenceCode: extra.referenceCode,
                userName: extra.customerName,
                userEmail: extra.customerEmail,
                userRole: 'Guest',
                beneficiaryPhone: phone,
                network: network,
                airtimeAmount: extra.amount || extra.price,
                totalPaid: extra.price,
                useExactAmount: false,
                source: `Shop Storefront (${extra.shopName})`,
                // Pass through Mashup-specific fields so admin email shows correct template
                orderType: extra.orderType as 'airtime' | 'mashup',
                bundlePreference: extra.bundlePreference as 'balanced' | 'data' | 'voice' | undefined,
            }).catch(e => console.error('[Shop Order Processor] Admin Airtime Email Error:', e))
            
            try {
                const { sendAdminAirtimeAlertSMS } = await import('./sms-service')
                const { data: admins } = await db.from('users').select('phone_number').eq('role', 'admin')
                const adminPhones = admins?.map((a: any) => a.phone_number).filter(Boolean) || []
                if (adminPhones.length > 0) {
                    await sendAdminAirtimeAlertSMS(adminPhones, {
                        source: `${extra.customerName} / ${extra.shopName} (Shop)`,
                        receiver: phone,
                        amount: extra.amount || extra.price || 0,
                        network: network
                    })
                }
            } catch (err) {
                console.error('[Shop Order Processor] Admin SMS Error:', err)
            }
        } else {
            await sendAdminNewOrderAlert({
                ...alertDetails,
                reason: 'Manual fulfillment mode enabled for this shop'
            }).catch(e => console.error('[Shop Order Processor] Admin Alert Error:', e))
        }
        
        return
    }

    try {
        // ── 1. Fetch fulfillment settings from admin_settings ──────────────
        const { data: settingsData } = await db
            .from('admin_settings')
            .select('key, value')
            .in('key', ['auto_fulfillment_enabled', 'fulfillment_settings'])

        const settingsMap = (settingsData || []).reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value
            return acc
        }, {})

        if (String(settingsMap.auto_fulfillment_enabled) === 'false') {
            console.log(`[Shop Order Processor] Auto-fulfillment globally disabled`)
            await sendAdminNewOrderAlert({ ...alertDetails, reason: 'Global auto-fulfillment is disabled' })
            return
        }

        // ── 2. Parse fulfillment_settings ─────────────────────────────────
        let fulfillmentSettings: {
            networks: Record<string, boolean>
            codecraft_networks: Record<string, boolean>
            kingflexy_networks: Record<string, boolean>
        } = { networks: {}, codecraft_networks: {}, kingflexy_networks: {} }

        try {
            if (settingsMap.fulfillment_settings) {
                const parsed = typeof settingsMap.fulfillment_settings === 'string'
                    ? JSON.parse(settingsMap.fulfillment_settings)
                    : settingsMap.fulfillment_settings
                fulfillmentSettings.networks = parsed.networks || {}
                fulfillmentSettings.codecraft_networks = parsed.codecraft_networks || {}
                fulfillmentSettings.kingflexy_networks = parsed.kingflexy_networks || {}
            }
        } catch (e) { /* ignore parse failure — defaults to empty */ }

        const isDataKazinaEnabled = fulfillmentSettings.networks[network] === true
        const isCodeCraftEnabled = fulfillmentSettings.codecraft_networks[network] === true
        const isKingFlexyEnabled = fulfillmentSettings.kingflexy_networks[network] === true

        // ── 3. FULFILLMENT_CONFLICT Guard (absolute last line of defense) ──
        const activeCount = [isDataKazinaEnabled, isCodeCraftEnabled, isKingFlexyEnabled].filter(Boolean).length
        if (activeCount > 1) {
            console.error(`[Fulfillment] CONFLICT DETECTED for ${network} on order ${orderId}`)
            await sendAdminNewOrderAlert({
                ...alertDetails,
                reason: `⚠️ SYSTEM HALTED: Multiple suppliers are active for ${network}. Order ${orderId} kept pending. Fix in admin panel immediately.`
            })
            // Keep order as PENDING — do not throw to outer catch (would trigger duplicate alert)
            return
        }

        // ── 4. No active supplier ──────────────────────────────────────────
        if (!isDataKazinaEnabled && !isCodeCraftEnabled && !isKingFlexyEnabled) {
            console.log(`[Shop Order Processor] No active supplier for network ${network}. Order ${orderId} kept pending.`)
            await sendAdminNewOrderAlert({ ...alertDetails, reason: `No active supplier configured for network: ${network}` })
            return
        }

        // ── 5. Determine supplier and stamp fulfilled_by ATOMICALLY first ──
        const supplierLabel = isCodeCraftEnabled ? 'codecraft' : isKingFlexyEnabled ? 'kingflexy' : 'datakazina'
        await db.from('shop_orders').update({ fulfilled_by: supplierLabel }).eq('id', orderId)
        console.log(`[Shop Order Processor] Routing to ${supplierLabel} for order ${orderId} | network: ${network}`)

        // ── 6. Execute fulfillment (dedicated try/catch — ensures alert fires on any exception) ──
        let result: { success: boolean; reference?: string; transactionId?: string; error?: string; isRateLimited?: boolean }

        try {
            if (isCodeCraftEnabled) {
                const { fulfillOrder: ccFulfill } = await import('./codecraft-service')
                result = await ccFulfill(network, phone, extra.size || '', orderId)
            } else if (isKingFlexyEnabled) {
                const { fulfillOrder: kfFulfill } = await import('./kingflexy-service')
                result = await kfFulfill(network, phone, extra.size || '', orderId)
            } else {
                const { fulfillOrder: dkFulfill } = await import('./fulfillment-service')
                result = await dkFulfill(network, phone, extra.size || '', orderId)
            }
        } catch (importOrCallErr: any) {
            console.error(`[Shop Order Processor] Supplier import/call exception for order ${orderId}:`, importOrCallErr)
            await sendAdminNewOrderAlert({
                ...alertDetails,
                reason: `Supplier exception during fulfillment (${supplierLabel}): ${importOrCallErr?.message || 'Unknown error'}. Order kept pending.`
            })
            return
        }

        // ── 7. Handle result ───────────────────────────────────────────────
        if (result.success) {
            const updatedAt = new Date().toISOString()

            const updatePayload: Record<string, any> = {
                status: 'processing',
                updated_at: updatedAt,
            }

            if (isCodeCraftEnabled && result.transactionId) {
                updatePayload.codecraft_reference_id = result.transactionId
            }
            if (isKingFlexyEnabled && result.transactionId) {
                updatePayload.kingflexy_reference = result.transactionId
            }

            await db.from('shop_orders').update(updatePayload).eq('id', orderId)
            const ordersUpdate: Record<string, string> = { status: 'processing' }
            if (isCodeCraftEnabled && result.transactionId) {
                ordersUpdate.codecraft_reference = result.transactionId
                ordersUpdate.fulfillment_method = 'codecraft'
            }
            if (isKingFlexyEnabled && result.transactionId) {
                ordersUpdate.kingflexy_reference = result.transactionId
                ordersUpdate.fulfillment_method = 'kingflexy'
            }
            await db.from('orders').update(ordersUpdate).eq('shop_order_id', orderId)

            if (!isCodeCraftEnabled && !isKingFlexyEnabled && (result.transactionId || result.reference)) {
                const { error: refError } = await db
                    .from('orders')
                    .update({ dakazina_reference: result.transactionId || result.reference })
                    .eq('shop_order_id', orderId)
                if (refError) console.error(`[ShopOrderProcessor] Failed to stamp dakazina_reference:`, refError.message)

                await db
                    .from('shop_orders')
                    .update({ dakazina_reference: result.transactionId || result.reference })
                    .eq('id', orderId)
            }

            console.log(`[Shop Order Processor] Fulfillment success for order ${orderId} via ${supplierLabel}`)

        } else {
            // ALL failures → keep order as PENDING — never mark as failed
            console.warn(`[Shop Order Processor] Fulfillment attempt failed for order ${orderId} via ${supplierLabel}:`, result.error)
            console.warn(`[Shop Order Processor] Order ${orderId} kept as PENDING for manual review.`)
            await sendAdminNewOrderAlert({
                ...alertDetails,
                reason: `Auto-fulfillment (${supplierLabel}) failed: ${result.error || 'Unknown error'}. Order kept pending.`
            })
        }

    } catch (err) {
        console.error(`[Shop Order Processor] Exception for order ${orderId}:`, err)
        // Keep order as PENDING — do not update status
        await sendAdminNewOrderAlert({
            ...alertDetails,
            reason: `System Exception during fulfillment: ${err instanceof Error ? err.message : 'Unknown exception'}. Order kept pending.`
        })
    }
}
