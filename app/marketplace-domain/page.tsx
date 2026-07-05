import { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
    title: 'KFG Marketplace - Buy & Sell Locally',
    description: 'Browse listings, connect with sellers, and trade locally on Ghana\'s trusted marketplace',
}

export default function MarketplaceHome() {
    return (
        <main className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
            <div className="text-center space-y-6 max-w-2xl">
                <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
                    Arhms Marketplace
                </h1>
                <p className="text-lg text-slate-600 dark:text-slate-300">
                    Ghana's trusted P2P marketplace. Buy and sell locally with confidence.
                </p>

                <div className="flex flex-col gap-3 justify-center pt-8">
                    <Link href="/marketplace-domain/browse" className="w-full">
                        <Button size="lg" className="w-full">
                            Browse Listings
                        </Button>
                    </Link>
                    <Link href="/marketplace-domain/categories" className="w-full">
                        <Button size="lg" variant="outline" className="w-full">
                            Browse by Category
                        </Button>
                    </Link>
                    <Link href="/marketplace-domain/sell" className="w-full">
                        <Button size="lg" variant="outline" className="w-full">
                            Start Selling
                        </Button>
                    </Link>
                    <Link href="/marketplace-domain/favorites" className="w-full">
                        <Button size="lg" variant="ghost" className="w-full">
                            My Favorites
                        </Button>
                    </Link>
                </div>

                <div className="pt-8 text-sm text-slate-500 dark:text-slate-400">
                    <p>Marketplace v1 with search, discovery, and messaging. Start exploring today.</p>
                </div>
            </div>
        </main>
    )
}
