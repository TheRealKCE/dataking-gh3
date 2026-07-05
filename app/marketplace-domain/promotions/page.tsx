import { createRouteHandlerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

export const metadata = {
    title: 'My Promotions | Arhms Marketplace',
    description: 'Manage your listing promotions',
}

async function getActivePromotions(userId: string) {
    try {
        const supabase = await createRouteHandlerClient()

        const { data, error } = await supabase
            .from('marketplace_promotion_purchases')
            .select(
                `
                id,
                listing_id,
                price_pesewas,
                started_at,
                expires_at,
                classified_listings(title, price_pesewas),
                marketplace_promotion_tiers(display_name, tier_level)
                `
            )
            .eq('user_id', userId)
            .eq('status', 'active')
            .order('expires_at', { ascending: false })

        if (error) {
            console.error('[Active Promotions] Error:', error)
            return []
        }

        return data || []
    } catch (error) {
        console.error('[Active Promotions] Fetch error:', error)
        return []
    }
}

export default async function PromotionsPage() {
    const supabase = await createRouteHandlerClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login?redirect=/marketplace-domain/promotions')
    }

    const promotions = await getActivePromotions(user.id)

    const formatExpiration = (date: string) => {
        const d = new Date(date)
        const now = new Date()
        const diff = d.getTime() - now.getTime()
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const days = Math.floor(hours / 24)

        if (days > 0) return `${days}d left`
        if (hours > 0) return `${hours}h left`
        return 'Expiring soon'
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="container py-8 max-w-4xl">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">My Promotions</h1>
                    <p className="text-muted-foreground">
                        Manage active promotions for your listings
                    </p>
                </div>

                {promotions.length === 0 ? (
                    <Card className="p-8 text-center">
                        <p className="text-muted-foreground mb-4">
                            You don't have any active promotions
                        </p>
                        <Link href="/marketplace-domain/my-listings">
                            <a className="text-primary hover:underline">
                                Go to My Listings to promote a listing
                            </a>
                        </Link>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {promotions.map((promo: any) => (
                            <Card key={promo.id} className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h3 className="font-semibold">
                                                {promo.classified_listings.title}
                                            </h3>
                                            <Badge variant="default">
                                                {promo.marketplace_promotion_tiers.display_name}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            GHS{' '}
                                            {(promo.classified_listings.price_pesewas / 100).toFixed(2)}
                                        </p>
                                    </div>

                                    <div className="text-right">
                                        <p className="text-sm font-medium">
                                            {formatExpiration(promo.expires_at)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            GHS {(promo.price_pesewas / 100).toFixed(2)}
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
