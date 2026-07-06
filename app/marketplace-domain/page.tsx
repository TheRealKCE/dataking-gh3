import { Metadata } from 'next'
import Link from 'next/link'
import { Search, ShieldCheck, Zap, MapPin, ArrowRight, LayoutGrid } from 'lucide-react'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { Button } from '@/components/ui/button'
import { ListingCard } from '@/components/marketplace/listing-card'

export const metadata: Metadata = {
    title: 'Arhms Marketplace - Buy & Sell Locally in Ghana',
    description: 'Browse listings, connect with sellers, and trade locally on Ghana\'s trusted marketplace',
}

async function getFeatured() {
    try {
        const supabase = await createRouteHandlerClient()
        const { data } = await supabase
            .from('classified_listings')
            .select(
                `id, title, description, price_pesewas, category_id, region, condition, status, promotion_tier, created_at, classified_listing_images(image_url, sort_order)`
            )
            .eq('status', 'active')
            .eq('moderation_status', 'approved')
            .order('promotion_tier', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false })
            .limit(8)
        return data || []
    } catch {
        return []
    }
}

async function getCategories() {
    try {
        const supabase = await createRouteHandlerClient()
        const { data } = await supabase
            .from('classifieds_categories')
            .select('id, name')
            .order('name')
            .limit(8)
        return data || []
    } catch {
        return []
    }
}

const VALUE_PROPS = [
    { icon: MapPin, title: 'Buy locally', desc: 'Thousands of items from sellers near you across Ghana.' },
    { icon: Zap, title: 'Sell in minutes', desc: 'List an item with a few photos and reach buyers fast.' },
    { icon: ShieldCheck, title: 'Trade with confidence', desc: 'Chat with sellers and meet safely before you pay.' },
]

export default async function MarketplaceHome() {
    const [featured, categories] = await Promise.all([getFeatured(), getCategories()])

    return (
        <div>
            {/* Hero */}
            <section className="mkt-hero border-b">
                <div className="container py-16 sm:py-24 text-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        Ghana&apos;s trusted marketplace
                    </span>
                    <h1 className="mt-5 text-4xl sm:text-5xl font-extrabold tracking-tight text-balance">
                        Buy & sell anything,{' '}
                        <span className="text-primary">locally</span>
                    </h1>
                    <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto text-balance">
                        Discover great deals from sellers near you — or list your own item in minutes.
                    </p>

                    {/* Search (native GET form → /browse?q=) */}
                    <form
                        action="/marketplace-domain/browse"
                        method="GET"
                        className="mt-8 mx-auto flex max-w-xl items-center gap-2 rounded-2xl border bg-card p-2 shadow-sm"
                    >
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                name="q"
                                placeholder="What are you looking for?"
                                className="w-full bg-transparent py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground"
                            />
                        </div>
                        <Button type="submit" size="lg" className="rounded-xl">
                            Search
                        </Button>
                    </form>

                    <div className="mt-4 flex items-center justify-center gap-2 text-sm">
                        <Link href="/marketplace-domain/categories" className="text-muted-foreground hover:text-primary transition-colors">
                            Browse categories
                        </Link>
                        <span className="text-border">•</span>
                        <Link href="/marketplace-domain/sell" className="font-medium text-primary hover:underline">
                            Start selling
                        </Link>
                    </div>
                </div>
            </section>

            {/* Category tiles */}
            {categories.length > 0 && (
                <section className="container py-12">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-2xl font-bold">Shop by category</h2>
                        <Link
                            href="/marketplace-domain/categories"
                            className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
                        >
                            All categories <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {categories.map((cat) => (
                            <Link
                                key={cat.id}
                                href={`/marketplace-domain/browse?category=${cat.id}`}
                                className="group flex items-center gap-3 rounded-xl border bg-card p-4 hover:border-primary/40 hover:bg-accent transition-colors"
                            >
                                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                                    <LayoutGrid className="w-5 h-5" />
                                </span>
                                <span className="font-medium text-sm group-hover:text-primary transition-colors line-clamp-2">
                                    {cat.name}
                                </span>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* Featured listings */}
            {featured.length > 0 && (
                <section className="container py-4 pb-12">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-2xl font-bold">Fresh listings</h2>
                        <Link
                            href="/marketplace-domain/browse"
                            className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
                        >
                            View all <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {featured.map((listing) => (
                            <ListingCard key={listing.id} listing={listing} />
                        ))}
                    </div>
                </section>
            )}

            {/* Value props */}
            <section className="border-t bg-muted/40">
                <div className="container py-14 grid grid-cols-1 sm:grid-cols-3 gap-8">
                    {VALUE_PROPS.map(({ icon: Icon, title, desc }) => (
                        <div key={title} className="text-center sm:text-left">
                            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                <Icon className="w-6 h-6" />
                            </div>
                            <h3 className="mt-4 font-semibold text-lg">{title}</h3>
                            <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className="container py-16">
                <div className="rounded-3xl bg-gradient-to-br from-primary to-primary/80 px-6 py-12 text-center text-primary-foreground shadow-lg">
                    <h2 className="text-2xl sm:text-3xl font-bold">Got something to sell?</h2>
                    <p className="mt-2 text-primary-foreground/90 max-w-md mx-auto">
                        List it for free and reach buyers across Ghana today.
                    </p>
                    <Button asChild size="lg" variant="secondary" className="mt-6 rounded-xl">
                        <Link href="/marketplace-domain/sell">Create a listing</Link>
                    </Button>
                </div>
            </section>
        </div>
    )
}
