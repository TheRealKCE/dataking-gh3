import { createRouteHandlerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export const metadata = {
    title: 'My Orders | Arhms Marketplace',
    description: 'View and manage your orders',
}

async function getBuyerOrders(userId: string) {
    try {
        const supabase = await createRouteHandlerClient()

        const { data, error } = await supabase
            .from('marketplace_orders')
            .select(
                `
                id,
                listing_id,
                quantity,
                total_price_pesewas,
                status,
                payment_mode,
                created_at,
                paid_at,
                delivered_at,
                classified_listings(title)
                `
            )
            .eq('buyer_id', userId)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('[Buyer Orders] Error:', error)
            return []
        }

        return data || []
    } catch (error) {
        console.error('[Buyer Orders] Fetch error:', error)
        return []
    }
}

const statusColors = {
    created: 'bg-blue-100 text-blue-800',
    paid: 'bg-green-100 text-green-800',
    paid_escrowed: 'bg-yellow-100 text-yellow-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered_confirmed: 'bg-green-100 text-green-800',
    released: 'bg-green-100 text-green-800',
    settled: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
}

export default async function OrdersPage() {
    const supabase = await createRouteHandlerClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login?redirect=/marketplace-domain/orders')
    }

    const orders = await getBuyerOrders(user.id)

    return (
        <div className="min-h-screen bg-background">
            <div className="container py-8 max-w-4xl">
                <h1 className="text-3xl font-bold mb-2">My Orders</h1>
                <p className="text-muted-foreground mb-8">
                    View and manage your purchases
                </p>

                {orders.length === 0 ? (
                    <Card className="p-8 text-center">
                        <p className="text-muted-foreground mb-4">
                            You haven't placed any orders yet
                        </p>
                        <Button asChild>
                            <Link href="/marketplace-domain/browse">
                                Start Shopping
                            </Link>
                        </Button>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {orders.map((order: any) => (
                            <Link
                                key={order.id}
                                href={`/marketplace-domain/orders/${order.id}`}
                            >
                                <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <h3 className="font-semibold mb-1">
                                                {order.classified_listings.title}
                                            </h3>
                                            <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
                                                <span>
                                                    Qty: {order.quantity}
                                                </span>
                                                <span>•</span>
                                                <span>
                                                    GHS {(order.total_price_pesewas / 100).toFixed(2)}
                                                </span>
                                                <span>•</span>
                                                <span>
                                                    {new Date(order.created_at).toLocaleDateString(
                                                        'en-US',
                                                        {
                                                            month: 'short',
                                                            day: 'numeric',
                                                        }
                                                    )}
                                                </span>
                                            </div>
                                        </div>

                                        <Badge
                                            className={
                                                statusColors[
                                                    order.status as keyof typeof statusColors
                                                ]
                                            }
                                        >
                                            {order.status
                                                .replace(/_/g, ' ')
                                                .toUpperCase()}
                                        </Badge>
                                    </div>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
