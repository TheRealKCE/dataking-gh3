import { Metadata } from 'next'
import Link from 'next/link'
import { ThemeProvider } from '@/components/theme-provider'
import { MarketplaceHeader } from '@/components/marketplace/marketplace-header'

export const metadata: Metadata = {
    title: 'Arhms Marketplace',
    description: 'Buy and sell locally on Ghana\'s trusted P2P marketplace',
    icons: {
        icon: '/icon.png',
    },
}

export default function MarketplaceLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="theme-marketplace min-h-screen bg-white dark:bg-slate-950 flex flex-col">
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
                <MarketplaceHeader />
                <main className="flex-1">
                    {children}
                </main>
                <footer className="border-t bg-slate-50 dark:bg-slate-900/50 py-8 mt-12">
                    <div className="container">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-8">
                            <div>
                                <h3 className="font-semibold mb-2 text-sm">Browse</h3>
                                <nav className="space-y-2 text-sm text-muted-foreground">
                                    <Link href="/marketplace-domain/browse" className="hover:text-foreground">
                                        All Listings
                                    </Link>
                                    <Link href="/marketplace-domain/categories" className="hover:text-foreground">
                                        Categories
                                    </Link>
                                </nav>
                            </div>
                            <div>
                                <h3 className="font-semibold mb-2 text-sm">Selling</h3>
                                <nav className="space-y-2 text-sm text-muted-foreground">
                                    <Link href="/marketplace-domain/sell" className="hover:text-foreground">
                                        Create Listing
                                    </Link>
                                    <Link href="/marketplace-domain/my-listings" className="hover:text-foreground">
                                        My Listings
                                    </Link>
                                    <Link href="/marketplace-domain/promotions" className="hover:text-foreground">
                                        Promotions
                                    </Link>
                                </nav>
                            </div>
                            <div>
                                <h3 className="font-semibold mb-2 text-sm">Account</h3>
                                <nav className="space-y-2 text-sm text-muted-foreground">
                                    <Link href="/marketplace-domain/orders" className="hover:text-foreground">
                                        My Orders
                                    </Link>
                                    <Link href="/marketplace-domain/favorites" className="hover:text-foreground">
                                        Favorites
                                    </Link>
                                    <Link href="/marketplace-domain/messages" className="hover:text-foreground">
                                        Messages
                                    </Link>
                                </nav>
                            </div>
                            <div>
                                <h3 className="font-semibold mb-2 text-sm">Help</h3>
                                <nav className="space-y-2 text-sm text-muted-foreground">
                                    <Link href="#" className="hover:text-foreground">
                                        Safety Tips
                                    </Link>
                                    <Link href="#" className="hover:text-foreground">
                                        Contact Us
                                    </Link>
                                </nav>
                            </div>
                        </div>
                        <div className="border-t pt-6 text-center text-sm text-muted-foreground">
                            <p>&copy; 2026 Arhms Marketplace. All rights reserved.</p>
                        </div>
                    </div>
                </footer>
            </ThemeProvider>
        </div>
    )
}
