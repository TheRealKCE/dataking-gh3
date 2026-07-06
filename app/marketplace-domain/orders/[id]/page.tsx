import { createRouteHandlerClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, CheckCircle2 } from 'lucide-react'

async function getOrder(id: string, userId: string) {
    try {
        const supabase = await createRouteHandlerClient()

        const { data, error } = await supabase
            .from('marketplace_orders')
            .select(
                `
                id,
                buyer_id,
                seller_id,
                listing_id,
                quantity,
                total_price_pesewas,
                status,
                payment_mode,
                created_at,
                paid_at,
                delivered_at,
                classified_listings(id, title, user_id)
                `
            )
            .eq('id', id)
            .single()

        if (error || !data) return null

        // Check authorization
        if (data.buyer_id !== userId && data.seller_id !== userId) {
            return null
        }

        return data
    } catch (error) {
        console.error('[Get Order] Error:', error)
        return null
    }
}

const statusSteps = [
    { key: 'created', label: 'Order Created' },
    { key: 'paid', label: 'Payment Confirmed' },
    { key: 'shipped', label: 'Shipped' },
    { key: 'delivered_confirmed', label: 'Delivered' },
    { key: 'released', label: 'Completed' },
]

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

export async function generateMetadata({
    params: { id },
}: {
    params: { id: string }
}) {
    return {
        title: `Order ${id.slice(0, 8)} | Arhms Marketplace`,
    }
}

export default async function OrderDetailPage({
    params: { id },
}: {
    params: { id: string }
}) {
    const supabase = await createRouteHandlerClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login?redirect=/marketplace-domain/orders')
    }

    const order = await getOrder(id, user.id)

    if (!order) {
        notFound()
    }

    const isBuyer = order.buyer_id === user.id
    const currentStepIndex = statusSteps.findIndex((s) => s.key === order.status)

    return (
        <div className="min-h-screen bg-background">
            <div className="container py-8 max-w-4xl">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/marketplace-domain/orders">
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">Order {id.slice(0, 8)}</h1>
                        <p className="text-muted-foreground text-sm">
                            {new Date(order.created_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                            })}
                        </p>
                    </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Status Timeline */}
                        <Card className="p-6">
                            <h2 className="font-semibold mb-4">Order Status</h2>
                            <div className="space-y-3">
                                {statusSteps.map((step, index) => {
                                    const isCompleted = index <= currentStepIndex
                                    const isCurrent = index === currentStepIndex

                                    return (
                                        <div
                                            key={step.key}
                                            className="flex items-center gap-3"
                                        >
                                            <div
                                                className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                                                    isCompleted
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-gray-100 text-gray-400'
                                                }`}
                                            >
                                                {isCompleted ? (
                                                    <CheckCircle2 className="w-5 h-5" />
                                                ) : (
                                                    index + 1
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <p
                                                    className={`font-medium ${
                                                        isCurrent
                                                            ? 'text-primary'
                                                            : 'text-muted-foreground'
                                                    }`}
                                                >
                                                    {step.label}
                                                </p>
                                            </div>
                                            {isCurrent && (
                                                <Badge variant="default" className="text-xs">
                                                    Current
                                                </Badge>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </Card>

                        {/* Order Details */}
                        <Card className="p-6">
                            <h2 className="font-semibold mb-4">Order Details</h2>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between pb-3 border-b">
                                    <span className="text-muted-foreground">Product</span>
                                    <span className="font-medium">
                                        {order.classified_listings.title}
                                    </span>
                                </div>
                                <div className="flex justify-between pb-3 border-b">
                                    <span className="text-muted-foreground">Quantity</span>
                                    <span>{order.quantity}</span>
                                </div>
                                <div className="flex justify-between pb-3 border-b">
                                    <span className="text-muted-foreground">Payment Mode</span>
                                    <Badge variant="outline" className="capitalize">
                                        {order.payment_mode}
                                    </Badge>
                                </div>
                                <div className="flex justify-between text-base font-semibold pt-2">
                                    <span>Total Amount</span>
                                    <span className="text-primary">
                                        GHS {(order.total_price_pesewas / 100).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </Card>

                        {/* Actions */}
                        {isBuyer && order.status === 'shipped' && (
                            <Card className="p-6 bg-blue-50 border-blue-200">
                                <h3 className="font-semibold mb-3">
                                    Confirm Delivery
                                </h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Once you confirm delivery, the seller will receive payment.
                                </p>
                                <Button asChild className="w-full">
                                    <a href={`/marketplace-domain/orders/${id}/confirm`}>
                                        Confirm Delivery
                                    </a>
                                </Button>
                            </Card>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        <Card className="p-6">
                            <h3 className="font-semibold mb-4">Order Summary</h3>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        Subtotal
                                    </span>
                                    <span>
                                        GHS {(order.total_price_pesewas / 100).toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex justify-between pb-3 border-b">
                                    <span className="text-muted-foreground">
                                        Shipping
                                    </span>
                                    <span>FREE</span>
                                </div>
                                <div className="flex justify-between font-semibold">
                                    <span>Total</span>
                                    <span>
                                        GHS {(order.total_price_pesewas / 100).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </Card>

                        <Card className="p-6">
                            <Badge
                                className={`w-full justify-center py-2 text-sm ${
                                    statusColors[
                                        order.status as keyof typeof statusColors
                                    ]
                                }`}
                            >
                                {order.status.replace(/_/g, ' ').toUpperCase()}
                            </Badge>
                        </Card>

                        <Card className="p-4 bg-gray-50 text-sm">
                            <p className="text-muted-foreground">
                                {order.payment_mode === 'escrow'
                                    ? 'Your payment is securely held until delivery is confirmed.'
                                    : 'Payment has been processed.'}
                            </p>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}
