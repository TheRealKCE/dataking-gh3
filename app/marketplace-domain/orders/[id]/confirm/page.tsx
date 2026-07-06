import { createRouteHandlerClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChevronLeft } from 'lucide-react'

async function getOrder(id: string, userId: string) {
    try {
        const supabase = await createRouteHandlerClient()

        const { data, error } = await supabase
            .from('marketplace_orders')
            .select('*')
            .eq('id', id)
            .single()

        if (error || !data) return null

        // Check authorization - only buyer can confirm
        if (data.buyer_id !== userId) {
            return null
        }

        return data
    } catch (error) {
        console.error('[Get Order] Error:', error)
        return null
    }
}

export async function generateMetadata({
    params: { id },
}: {
    params: { id: string }
}) {
    return {
        title: `Confirm Delivery | Arhms Marketplace`,
    }
}

export default async function ConfirmDeliveryPage({
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

    if (order.status !== 'shipped') {
        notFound()
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="container py-8 max-w-2xl">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href={`/marketplace-domain/orders/${id}`}>
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                    </Button>
                    <h1 className="text-2xl font-bold">Confirm Delivery</h1>
                </div>

                {/* Confirmation Form */}
                <Card className="p-8">
                    <div className="space-y-6">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-900">
                                By confirming delivery, you verify that you have received the item in good condition.
                                {order.payment_mode === 'escrow' && (
                                    <>
                                        <br />
                                        <br />
                                        The seller will immediately receive payment once confirmed.
                                    </>
                                )}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                Did you receive the item?
                            </label>
                            <p className="text-sm text-muted-foreground">
                                Please inspect the item carefully before confirming.
                            </p>
                        </div>

                        <form
                            action={async () => {
                                'use server'
                                const response = await fetch(
                                    `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/marketplace/orders/${id}/confirm-delivery`,
                                    {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                        },
                                    }
                                )

                                if (response.ok) {
                                    redirect(`/marketplace-domain/orders/${id}`)
                                }
                            }}
                            className="space-y-4"
                        >
                            <div className="flex gap-3">
                                <Button
                                    type="submit"
                                    className="flex-1"
                                    size="lg"
                                >
                                    Confirm Delivery
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="flex-1"
                                    size="lg"
                                    asChild
                                >
                                    <Link href={`/marketplace-domain/orders/${id}`}>
                                        Cancel
                                    </Link>
                                </Button>
                            </div>
                        </form>

                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <p className="text-xs text-amber-900">
                                ⚠ Once confirmed, this action cannot be undone. Please make sure you have received and inspected the item.
                            </p>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    )
}
