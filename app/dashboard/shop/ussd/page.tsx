'use client'

import { UssdActivationPanel } from '@/components/shop/ussd-activation-panel'

export default function UssdActivationPage() {
    return (
        <UssdActivationPanel
            backHref="/dashboard/shop"
            setupHref="/dashboard/shop/setup"
        />
    )
}
