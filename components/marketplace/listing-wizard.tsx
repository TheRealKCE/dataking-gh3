'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { StepCategory } from './wizard-steps/step-category'
import { StepPhotos } from './wizard-steps/step-photos'
import { StepDetails } from './wizard-steps/step-details'
import { StepVariants } from './wizard-steps/step-variants'
import { StepPrice } from './wizard-steps/step-price'
import { StepLocation } from './wizard-steps/step-location'
import { StepReview } from './wizard-steps/step-review'

export type ListingFormData = {
    // Step 1: Category
    category_id?: string
    category_name?: string

    // Step 2: Photos
    images: Array<{ base64: string; preview: string }>

    // Step 3: Details
    title: string
    description: string
    condition: string

    // Step 4: Variants
    variants: Array<{
        option1_name?: string
        option1_value?: string
        option2_name?: string
        option2_value?: string
        price_delta_pesewas?: number
        quantity?: number
    }>

    // Step 5: Price & Payment
    price_pesewas: number
    allowed_payment_modes: string[]

    // Step 6: Location
    region?: string
    city?: string
}

const STEPS = ['Category', 'Photos', 'Details', 'Variants', 'Price', 'Location', 'Review']

interface ListingWizardProps {
    userId: string
    onComplete?: (listingId: string) => void
}

export function ListingWizard({ userId, onComplete }: ListingWizardProps) {
    const [currentStep, setCurrentStep] = useState(0)
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState<ListingFormData>({
        images: [],
        title: '',
        description: '',
        condition: 'used',
        variants: [],
        price_pesewas: 0,
        allowed_payment_modes: ['direct'],
    })

    // Auto-save draft to localStorage
    useEffect(() => {
        const timer = setTimeout(() => {
            localStorage.setItem(`listing-draft-${userId}`, JSON.stringify(formData))
        }, 500)
        return () => clearTimeout(timer)
    }, [formData, userId])

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(currentStep + 1)
        }
    }

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1)
        }
    }

    const handleSubmit = async () => {
        setLoading(true)
        try {
            const response = await fetch('/api/marketplace/listings/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            })

            if (!response.ok) throw new Error('Failed to create listing')

            const result = await response.json()
            toast.success('Listing created!')

            // Clear draft
            localStorage.removeItem(`listing-draft-${userId}`)

            onComplete?.(result.listing.id)
        } catch (error) {
            console.error('[ListingWizard] Submit error:', error)
            toast.error('Failed to create listing')
        } finally {
            setLoading(false)
        }
    }

    const renderStep = () => {
        switch (currentStep) {
            case 0:
                return (
                    <StepCategory
                        value={formData.category_id}
                        onChange={(categoryId, categoryName) =>
                            setFormData({
                                ...formData,
                                category_id: categoryId,
                                category_name: categoryName,
                            })
                        }
                    />
                )
            case 1:
                return (
                    <StepPhotos
                        images={formData.images}
                        onChange={(images) => setFormData({ ...formData, images })}
                    />
                )
            case 2:
                return (
                    <StepDetails
                        title={formData.title}
                        description={formData.description}
                        condition={formData.condition}
                        onChange={(updates) => setFormData({ ...formData, ...updates })}
                    />
                )
            case 3:
                return (
                    <StepVariants
                        categoryId={formData.category_id}
                        variants={formData.variants}
                        onChange={(variants) => setFormData({ ...formData, variants })}
                    />
                )
            case 4:
                return (
                    <StepPrice
                        price_pesewas={formData.price_pesewas}
                        allowed_payment_modes={formData.allowed_payment_modes}
                        onChange={(updates) => setFormData({ ...formData, ...updates })}
                    />
                )
            case 5:
                return (
                    <StepLocation
                        region={formData.region}
                        city={formData.city}
                        onChange={(updates) => setFormData({ ...formData, ...updates })}
                    />
                )
            case 6:
                return (
                    <StepReview
                        formData={formData}
                        onChange={(updates) => setFormData({ ...formData, ...updates })}
                    />
                )
            default:
                return null
        }
    }

    return (
        <Card className="w-full max-w-2xl">
            <CardHeader>
                <CardTitle>Create Listing</CardTitle>
                <CardDescription>
                    Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep]}
                </CardDescription>
                <Progress value={((currentStep + 1) / STEPS.length) * 100} className="mt-4" />
            </CardHeader>

            <CardContent className="space-y-6">
                {renderStep()}

                <div className="flex gap-4 justify-between">
                    <Button
                        variant="outline"
                        onClick={handlePrev}
                        disabled={currentStep === 0 || loading}
                    >
                        Previous
                    </Button>

                    {currentStep === STEPS.length - 1 ? (
                        <Button onClick={handleSubmit} disabled={loading}>
                            {loading ? 'Creating...' : 'Create Listing'}
                        </Button>
                    ) : (
                        <Button onClick={handleNext} disabled={loading}>
                            Next
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
