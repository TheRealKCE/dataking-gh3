'use client'

import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Zap } from 'lucide-react'
import { toast } from 'sonner'

interface PromotionTier {
    id: string
    tier_name: string
    display_name: string
    description: string
    price_pesewas: number
    duration_hours: number
}

interface PromoteListingDialogProps {
    listingId: string
}

export function PromoteListingDialog({ listingId }: PromoteListingDialogProps) {
    const [open, setOpen] = useState(false)
    const [tiers, setTiers] = useState<PromotionTier[]>([])
    const [loading, setLoading] = useState(true)
    const [purchasing, setPurchasing] = useState<string | null>(null)

    useEffect(() => {
        const fetchTiers = async () => {
            try {
                const response = await fetch('/api/marketplace/promotions/config')
                const data = await response.json()

                if (!response.ok) throw new Error(data.error)

                setTiers(data.tiers)
            } catch (error) {
                console.error('[Promote Listing] Fetch error:', error)
                toast.error('Failed to load promotion tiers')
            } finally {
                setLoading(false)
            }
        }

        if (open) {
            fetchTiers()
        }
    }, [open])

    const handlePurchasePromotion = async (tierId: string) => {
        setPurchasing(tierId)
        try {
            const response = await fetch('/api/marketplace/promotions/purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    listing_id: listingId,
                    tier_id: tierId,
                }),
            })

            const data = await response.json()

            if (!response.ok) throw new Error(data.error)

            toast.success('Promotion purchased!')
            setOpen(false)
        } catch (error) {
            console.error('[Purchase Promotion] Error:', error)
            toast.error('Failed to purchase promotion')
        } finally {
            setPurchasing(null)
        }
    }

    const getDaysFromHours = (hours: number) => {
        if (hours < 24) return `${hours}h`
        const days = Math.floor(hours / 24)
        return `${days}d`
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Zap className="w-4 h-4 mr-2" />
                    Promote
                </Button>
            </DialogTrigger>

            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Promote Your Listing</DialogTitle>
                    <DialogDescription>
                        Boost visibility with our promotion tiers. Get more views and faster sales.
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : tiers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <p>No promotion tiers available</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                        {tiers.map((tier) => (
                            <Card
                                key={tier.id}
                                className="p-4 border-2 hover:border-primary transition-colors cursor-pointer"
                            >
                                <div className="space-y-3">
                                    <div>
                                        <h3 className="font-semibold text-lg">
                                            {tier.display_name}
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            {tier.description}
                                        </p>
                                    </div>

                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span>Duration:</span>
                                            <Badge variant="outline">
                                                {getDaysFromHours(tier.duration_hours)}
                                            </Badge>
                                        </div>
                                        <div className="flex justify-between pt-2 border-t">
                                            <span className="font-semibold">Price:</span>
                                            <span className="font-bold text-primary">
                                                GHS {(tier.price_pesewas / 100).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>

                                    <Button
                                        className="w-full mt-2"
                                        onClick={() => handlePurchasePromotion(tier.id)}
                                        disabled={purchasing === tier.id}
                                    >
                                        {purchasing === tier.id ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Purchasing...
                                            </>
                                        ) : (
                                            'Purchase'
                                        )}
                                    </Button>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
