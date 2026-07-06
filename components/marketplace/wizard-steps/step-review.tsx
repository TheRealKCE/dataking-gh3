'use client'

import { ListingFormData } from '../listing-wizard'
import { Card, CardContent } from '@/components/ui/card'

interface StepReviewProps {
    formData: ListingFormData
    onChange: (updates: Partial<ListingFormData>) => void
}

export function StepReview({ formData }: StepReviewProps) {
    const priceGhs = (formData.price_pesewas / 100).toFixed(2)

    return (
        <div className="space-y-4">
            <div className="grid gap-4">
                {/* Category */}
                {formData.category_name && (
                    <Card>
                        <CardContent className="pt-4">
                            <p className="text-sm text-muted-foreground">Category</p>
                            <p className="font-medium">{formData.category_name}</p>
                        </CardContent>
                    </Card>
                )}

                {/* Title & Description */}
                <Card>
                    <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Listing</p>
                        <h3 className="font-medium text-lg">{formData.title}</h3>
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                            {formData.description}
                        </p>
                    </CardContent>
                </Card>

                {/* Price & Payment */}
                <Card>
                    <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Price</p>
                        <p className="font-medium text-xl">GHS {priceGhs}</p>
                        <p className="text-sm text-muted-foreground mt-2">
                            Payment: {formData.allowed_payment_modes.join(', ')}
                        </p>
                    </CardContent>
                </Card>

                {/* Location */}
                {(formData.region || formData.city) && (
                    <Card>
                        <CardContent className="pt-4">
                            <p className="text-sm text-muted-foreground">Location</p>
                            <p className="font-medium">
                                {formData.city && formData.region ? `${formData.city}, ${formData.region}` : formData.region}
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Images */}
                {formData.images.length > 0 && (
                    <Card>
                        <CardContent className="pt-4">
                            <p className="text-sm text-muted-foreground">Photos ({formData.images.length})</p>
                            <div className="grid grid-cols-3 gap-2 mt-2">
                                {formData.images.slice(0, 3).map((img, i) => (
                                    <img
                                        key={i}
                                        src={img.preview}
                                        alt={`Photo ${i + 1}`}
                                        className="w-full h-20 object-cover rounded"
                                    />
                                ))}
                                {formData.images.length > 3 && (
                                    <div className="w-full h-20 bg-muted rounded flex items-center justify-center">
                                        +{formData.images.length - 3}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                    Your listing will be submitted for moderation. It will appear on the marketplace once approved.
                </p>
            </div>
        </div>
    )
}
