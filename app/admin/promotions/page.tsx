import { createRouteHandlerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata = {
    title: 'Promotions Settings | Admin',
    description: 'Manage marketplace promotion tiers',
}

async function getPromotionTiers() {
    try {
        const supabase = await createRouteHandlerClient()

        const { data, error } = await supabase
            .from('marketplace_promotion_tiers')
            .select('*')
            .order('tier_level')

        if (error) {
            console.error('[Promotion Tiers] Error:', error)
            return []
        }

        return data || []
    } catch (error) {
        console.error('[Promotion Tiers] Fetch error:', error)
        return []
    }
}

async function getPromotionStats() {
    try {
        const supabase = await createRouteHandlerClient()

        const { data: activePromos, error: activeError } = await supabase
            .from('marketplace_promotion_purchases')
            .select('id', { count: 'exact' })
            .eq('status', 'active')

        const { data: todayPromos, error: todayError } = await supabase
            .from('marketplace_promotion_purchases')
            .select('price_pesewas', { count: 'exact' })
            .eq('status', 'active')
            .gte(
                'created_at',
                new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            )

        return {
            active_count: activeError ? 0 : activePromos?.length || 0,
            today_revenue: todayError
                ? 0
                : (todayPromos as any[])?.reduce((sum, p) => sum + p.price_pesewas, 0) || 0,
        }
    } catch (error) {
        console.error('[Promotion Stats] Error:', error)
        return { active_count: 0, today_revenue: 0 }
    }
}

export default async function PromotionsAdminPage() {
    const supabase = await createRouteHandlerClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    // Check if admin
    const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user?.id)
        .single()

    if (!user || profile?.role !== 'admin') {
        redirect('/auth/login')
    }

    const tiers = await getPromotionTiers()
    const stats = await getPromotionStats()

    return (
        <div className="space-y-8">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="p-6">
                    <p className="text-sm text-muted-foreground mb-2">
                        Active Promotions
                    </p>
                    <p className="text-3xl font-bold">{stats.active_count}</p>
                </Card>
                <Card className="p-6">
                    <p className="text-sm text-muted-foreground mb-2">
                        Today's Revenue
                    </p>
                    <p className="text-3xl font-bold">
                        GHS {(stats.today_revenue / 100).toFixed(2)}
                    </p>
                </Card>
            </div>

            {/* Promotion Tiers */}
            <div>
                <h2 className="text-2xl font-bold mb-4">Promotion Tiers</h2>

                <div className="space-y-3">
                    {tiers.map((tier: any) => (
                        <Card key={tier.id} className="p-6">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="text-lg font-semibold">
                                            {tier.display_name}
                                        </h3>
                                        <Badge variant={tier.is_active ? 'default' : 'secondary'}>
                                            {tier.is_active ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        {tier.description}
                                    </p>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                                        <div>
                                            <p className="text-muted-foreground">Price</p>
                                            <p className="font-semibold">
                                                GHS {(tier.price_pesewas / 100).toFixed(2)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Duration</p>
                                            <p className="font-semibold">{tier.duration_hours}h</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Boost</p>
                                            <p className="font-semibold">
                                                {(tier.search_boost_multiplier * 100).toFixed(0)}%
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Level</p>
                                            <p className="font-semibold">{tier.tier_level}/4</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>

                <p className="text-sm text-muted-foreground mt-6">
                    To update pricing, use the database migration tools or contact support.
                </p>
            </div>
        </div>
    )
}
