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
            {/* pb clears the fixed mobile bottom nav (+ iOS safe area); removed on md+ */}
            <div className="pb-20 md:pb-0">{children}</div>
            <MarketplaceBottomNav />
        </div>
    )
}
