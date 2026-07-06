'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

interface StepPriceProps {
    price_pesewas: number
    allowed_payment_modes: string[]
    onChange: (updates: { price_pesewas?: number; allowed_payment_modes?: string[] }) => void
}

export function StepPrice({ price_pesewas, allowed_payment_modes, onChange }: StepPriceProps) {
    const handlePaymentModeChange = (mode: string, checked: boolean) => {
        const updated = checked
            ? [...allowed_payment_modes, mode]
            : allowed_payment_modes.filter((m) => m !== mode)
        onChange({ allowed_payment_modes: updated })
    }

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="price">Price (GHS)</Label>
                <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={price_pesewas ? (price_pesewas / 100).toFixed(2) : ''}
                    onChange={(e) => {
                        const ghs = parseFloat(e.target.value) || 0
                        onChange({ price_pesewas: Math.round(ghs * 100) })
                    }}
                />
                <p className="text-sm text-muted-foreground">
                    Price in Ghana Cedis (GHS)
                </p>
            </div>

            <div className="space-y-3">
                <Label>Accepted Payment Methods</Label>
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <Checkbox
                            id="direct"
                            checked={allowed_payment_modes.includes('direct')}
                            onCheckedChange={(checked) =>
                                handlePaymentModeChange('direct', checked as boolean)
                            }
                        />
                        <label
                            htmlFor="direct"
                            className="text-sm font-medium cursor-pointer"
                        >
                            Direct Payment (Cash/MoMo off-platform)
                        </label>
                    </div>

                    <div className="flex items-center gap-3">
                        <Checkbox
                            id="split"
                            checked={allowed_payment_modes.includes('split')}
                            onCheckedChange={(checked) =>
                                handlePaymentModeChange('split', checked as boolean)
                            }
                        />
                        <label
                            htmlFor="split"
                            className="text-sm font-medium cursor-pointer"
                        >
                            Split Payment (Paystack – funds split instantly)
                        </label>
                    </div>

                    <div className="flex items-center gap-3">
                        <Checkbox
                            id="escrow"
                            disabled
                            checked={false}
                        />
                        <label
                            className="text-sm font-medium cursor-not-allowed text-muted-foreground"
                        >
                            Escrow (Coming soon)
                        </label>
                    </div>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                    Buyers can only choose from the methods you enable here.
                </p>
            </div>
        </div>
    )
}
