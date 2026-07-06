'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { X, Plus } from 'lucide-react'

interface Variant {
    option1_name?: string
    option1_value?: string
    option2_name?: string
    option2_value?: string
    price_delta_pesewas?: number
    quantity?: number
}

interface StepVariantsProps {
    categoryId?: string
    variants: Variant[]
    onChange: (variants: Variant[]) => void
}

export function StepVariants({ variants, onChange }: StepVariantsProps) {
    const [isAdding, setIsAdding] = useState(false)

    const addVariant = () => {
        onChange([
            ...variants,
            {
                option1_name: '',
                option1_value: '',
                price_delta_pesewas: 0,
                quantity: undefined,
            },
        ])
    }

    const removeVariant = (index: number) => {
        onChange(variants.filter((_, i) => i !== index))
    }

    const updateVariant = (index: number, field: string, value: any) => {
        const updated = [...variants]
        updated[index] = { ...updated[index], [field]: value }
        onChange(updated)
    }

    return (
        <div className="space-y-4">
            <div>
                <Label>Variants (Optional)</Label>
                <p className="text-sm text-muted-foreground mt-1">
                    Add options like color, size, or capacity. Up to 2 options per listing.
                </p>
            </div>

            {variants.length === 0 ? (
                <Button
                    type="button"
                    variant="outline"
                    onClick={addVariant}
                    className="w-full"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Variant
                </Button>
            ) : (
                <div className="space-y-3">
                    {variants.map((variant, index) => (
                        <Card key={index} className="p-4">
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-medium">Option {index + 1}</h4>
                                    <button
                                        type="button"
                                        onClick={() => removeVariant(index)}
                                        className="text-red-500 hover:text-red-700"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <Input
                                        placeholder="Name (e.g., Color)"
                                        value={variant.option1_name || ''}
                                        onChange={(e) =>
                                            updateVariant(index, 'option1_name', e.target.value)
                                        }
                                    />
                                    <Input
                                        placeholder="Value (e.g., Red)"
                                        value={variant.option1_value || ''}
                                        onChange={(e) =>
                                            updateVariant(index, 'option1_value', e.target.value)
                                        }
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <Input
                                        type="number"
                                        placeholder="Price delta (pesewas)"
                                        value={variant.price_delta_pesewas || 0}
                                        onChange={(e) =>
                                            updateVariant(index, 'price_delta_pesewas', parseInt(e.target.value))
                                        }
                                    />
                                    <Input
                                        type="number"
                                        placeholder="Quantity (optional)"
                                        value={variant.quantity || ''}
                                        onChange={(e) =>
                                            updateVariant(index, 'quantity', e.target.value ? parseInt(e.target.value) : undefined)
                                        }
                                    />
                                </div>
                            </div>
                        </Card>
                    ))}

                    {variants.length < 5 && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={addVariant}
                            className="w-full"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Another Variant
                        </Button>
                    )}
                </div>
            )}
        </div>
    )
}
