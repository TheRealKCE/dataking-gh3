'use client'

/**
 * Sub-Agent "USSD Code" — the sub buys their own 4-character short code, at the
 * sub tier price, so their customers can buy from their storefront offline.
 * Same panel and same endpoint as the shop-owner page; de-branded because the
 * sub operates under their own name inside this portal.
 */

import { UssdActivationPanel } from '@/components/shop/ussd-activation-panel'

export default function SubUssdActivationPage() {
    return (
        <div className="max-w-3xl mx-auto p-4">
            <UssdActivationPanel
                backHref="/dashboard/sub"
                backLabel="Back to Dashboard"
                setupHref="/dashboard/sub/shop"
                deBranded
            />
        </div>
    )
}
