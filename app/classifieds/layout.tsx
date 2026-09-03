import type { Metadata } from 'next'
import { MarketplaceBottomNav } from '@/components/marketplace/marketplace-bottom-nav'

export const metadata: Metadata = {
    title: 'Classifieds - Buy & Sell Locally',
    description: 'Browse and post classifieds listings in your area',
}

export default function ClassifiedsLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen">
            {children}
            {/* Renders its own in-flow spacer, so clearance matches the real bar
                height (+ iOS safe area) and disappears on the routes where the
                bar hides itself. */}
            <MarketplaceBottomNav />
        </div>
    )
}
