'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Loader2, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'

interface CheckoutDialogProps {
    listingId: string
    price: number
    title: string
    supportedModes: string[]
}

export function CheckoutDialog({
    listingId,
    price,
    title,
    supportedModes,
}: CheckoutDialogProps) {
    const [open, setOpen] = useState(false)
    const [paymentMode, setPaymentMode] = useState(supportedModes[0] || 'direct')
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleCheckout = async () => {
        setLoading(true)
        try {
            // Create order
            const createResponse = await fetch('/api/marketplace/orders/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    listing_id: listingId,
                    payment_mode: paymentMode,
                    quantity: 1,
                }),
            })

            const createData = await createResponse.json()

            if (!createResponse.ok) throw new Error(createData.error)

            const orderId = createData.order.id

            // Process payment
            const payResponse = await fetch(
                `/api/marketplace/orders/${orderId}/pay`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                }
            )

            if (!payResponse.ok) throw new Error('Payment failed')

            toast.success('Order created! Waiting for seller confirmation.')
            setOpen(false)
            router.push(`/marketplace-domain/orders/${orderId}`)
        } catch (error) {
            console.error('[Checkout] Error:', error)
            toast.error('Failed to process order')
        } finally {
            setLoading(false)
        }
    }

    const paymentModes = [
        {
            id: 'direct',
            label: 'Direct Payment',
            description: 'Pay directly to seller',
        },
        {
            id: 'split',
            label: 'Split Payment',
            description: 'Split with another buyer',
        },
        {
            id: 'escrow',
            label: 'Escrow (Safe)',
            description: 'Funds held until delivery confirmed',
        },
    ]

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="w-full" size="lg">
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Buy Now
                </Button>
            </DialogTrigger>

            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Checkout</DialogTitle>
                    <DialogDescription>
                        Review details and select payment method
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Order Summary */}
                    <Card className="p-4 bg-muted/50">
                        <h3 className="font-semibold mb-3 text-sm">Order Summary</h3>
                        <p className="text-sm mb-2 line-clamp-1">{title}</p>
                        <div className="flex justify-between text-sm">
                            <span>Price:</span>
                            <span className="font-semibold">GHS {(price / 100).toFixed(2)}</span>
                        </div>
                    </Card>

                    {/* Payment Mode Selection */}
                    <div className="space-y-3">
                        <Label className="text-base font-semibold">Payment Method</Label>
                        <RadioGroup value={paymentMode} onValueChange={setPaymentMode}>
                            {paymentModes.map((mode) => {
                                // Only show supported modes
                                if (!supportedModes.includes(mode.id)) return null

                                return (
                                    <div
                                        key={mode.id}
                                        className="flex items-center space-x-3 border rounded-lg p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                                    >
                                        <RadioGroupItem
                                            value={mode.id}
                                            id={mode.id}
                                            disabled={loading}
                                        />
                                        <Label
                                            htmlFor={mode.id}
                                            className="flex-1 cursor-pointer"
                                        >
                                            <p className="font-medium">{mode.label}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {mode.description}
                                            </p>
                                        </Label>
                                    </div>
                                )
                            })}
                        </RadioGroup>
                    </div>

                    {/* Safety Note */}
                    {paymentMode === 'escrow' && (
                        <Card className="p-3 bg-green-50 border-green-200">
                            <p className="text-xs text-green-800">
                                ✓ Your payment is held securely until you confirm delivery
                            </p>
                        </Card>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => setOpen(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="flex-1"
                            onClick={handleCheckout}
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                'Proceed to Payment'
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
