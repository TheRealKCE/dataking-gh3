'use client'

import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { getGhanaRegions, getGhanaCities } from '@/lib/marketplace-reference'
import type { GhanaRegion, GhanaCity } from '@/lib/marketplace-types'

interface SellerOnboardingSheetProps {
    userId: string
    onComplete?: () => void
    isUpdate?: boolean
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function SellerOnboardingSheet({
    userId,
    onComplete,
    isUpdate = false,
    open: externalOpen = false,
    onOpenChange: externalOnOpenChange,
}: SellerOnboardingSheetProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const open = externalOnOpenChange ? externalOpen : internalOpen
    const onOpenChange = externalOnOpenChange || setInternalOpen
    const [loading, setLoading] = useState(false)
    const [regions, setRegions] = useState<GhanaRegion[]>([])
    const [cities, setCities] = useState<GhanaCity[]>([])
    const [selectedRegion, setSelectedRegion] = useState<string>('')

    const [formData, setFormData] = useState({
        display_name: '',
        region: '',
        city: '',
        whatsapp_number: '',
    })

    // Load regions on mount
    useEffect(() => {
        const loadRegions = async () => {
            const data = await getGhanaRegions()
            setRegions(data)
        }
        loadRegions()
    }, [])

    // Load cities when region changes
    useEffect(() => {
        const loadCities = async () => {
            if (selectedRegion) {
                const data = await getGhanaCities(selectedRegion)
                setCities(data)
            } else {
                setCities([])
            }
        }
        loadCities()
    }, [selectedRegion])

    const handleRegionChange = (regionId: string) => {
        setSelectedRegion(regionId)
        setFormData({ ...formData, region: regionId, city: '' })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.display_name.trim()) {
            toast.error('Please enter your display name')
            return
        }

        setLoading(true)
        try {
            const response = await fetch('/api/marketplace/seller-profile/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    display_name: formData.display_name,
                    region: formData.region || null,
                    city: formData.city || null,
                    whatsapp_number: formData.whatsapp_number || null,
                }),
            })

            if (!response.ok) throw new Error('Failed to create seller profile')

            toast.success(isUpdate ? 'Profile updated!' : 'Seller profile created!')
            onOpenChange(false)
            onComplete?.()
        } catch (error) {
            console.error('[SellerOnboarding] Error:', error)
            toast.error(isUpdate ? 'Failed to update profile' : 'Failed to create seller profile')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            {!externalOnOpenChange && (
                <Button onClick={() => onOpenChange(true)}>
                    {isUpdate ? 'Edit Profile' : 'Set Up Seller Profile'}
                </Button>
            )}
            <SheetContent className="sm:max-w-[425px]">
                <SheetHeader>
                    <SheetTitle>{isUpdate ? 'Edit Your Profile' : 'Become a Seller'}</SheetTitle>
                    <SheetDescription>
                        {isUpdate
                            ? 'Update your seller profile information'
                            : 'Complete your seller profile to start listing items'}
                    </SheetDescription>
                </SheetHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-6">
                    {/* Display Name */}
                    <div className="space-y-2">
                        <Label htmlFor="display_name">Display Name</Label>
                        <Input
                            id="display_name"
                            placeholder="Your shop name or business name"
                            value={formData.display_name}
                            onChange={(e) =>
                                setFormData({ ...formData, display_name: e.target.value })
                            }
                            disabled={loading}
                        />
                    </div>

                    {/* Region */}
                    <div className="space-y-2">
                        <Label htmlFor="region">Region</Label>
                        <Select value={selectedRegion} onValueChange={handleRegionChange}>
                            <SelectTrigger id="region" disabled={loading}>
                                <SelectValue placeholder="Select region" />
                            </SelectTrigger>
                            <SelectContent>
                                {regions.map((region) => (
                                    <SelectItem key={region.id} value={region.id}>
                                        {region.region_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* City */}
                    {selectedRegion && (
                        <div className="space-y-2">
                            <Label htmlFor="city">City</Label>
                            <Select
                                value={formData.city}
                                onValueChange={(value) =>
                                    setFormData({ ...formData, city: value })
                                }
                            >
                                <SelectTrigger id="city" disabled={loading || cities.length === 0}>
                                    <SelectValue placeholder="Select city" />
                                </SelectTrigger>
                                <SelectContent>
                                    {cities.map((city) => (
                                        <SelectItem key={city.id} value={city.city_name}>
                                            {city.city_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* WhatsApp Number */}
                    <div className="space-y-2">
                        <Label htmlFor="whatsapp_number">WhatsApp Number (Optional)</Label>
                        <Input
                            id="whatsapp_number"
                            placeholder="+233 XXX XXX XXX"
                            value={formData.whatsapp_number}
                            onChange={(e) =>
                                setFormData({ ...formData, whatsapp_number: e.target.value })
                            }
                            disabled={loading}
                        />
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading
                            ? isUpdate
                                ? 'Updating...'
                                : 'Creating...'
                            : isUpdate
                              ? 'Save Changes'
                              : 'Complete Profile'}
                    </Button>
                </form>
            </SheetContent>
        </Sheet>
    )
}
