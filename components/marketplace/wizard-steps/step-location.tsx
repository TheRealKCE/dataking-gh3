'use client'

import { useEffect, useState } from 'react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { getGhanaRegions, getGhanaCities } from '@/lib/marketplace-reference'
import type { GhanaRegion, GhanaCity } from '@/lib/marketplace-types'

interface StepLocationProps {
    region?: string
    city?: string
    onChange: (updates: { region?: string; city?: string }) => void
}

export function StepLocation({ region, city, onChange }: StepLocationProps) {
    const [regions, setRegions] = useState<GhanaRegion[]>([])
    const [cities, setCities] = useState<GhanaCity[]>([])
    const [selectedRegionId, setSelectedRegionId] = useState(region || '')

    useEffect(() => {
        const load = async () => {
            const data = await getGhanaRegions()
            setRegions(data)
        }
        load()
    }, [])

    useEffect(() => {
        const load = async () => {
            if (selectedRegionId) {
                const data = await getGhanaCities(selectedRegionId)
                setCities(data)
            } else {
                setCities([])
            }
        }
        load()
    }, [selectedRegionId])

    const handleRegionChange = (regionId: string) => {
        setSelectedRegionId(regionId)
        onChange({ region: regionId, city: '' })
    }

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Region (Optional)</Label>
                <Select value={selectedRegionId} onValueChange={handleRegionChange}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                        {regions.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                                {r.region_name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {selectedRegionId && (
                <div className="space-y-2">
                    <Label>City (Optional)</Label>
                    <Select value={city || ''} onValueChange={(c) => onChange({ city: c })}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select city" />
                        </SelectTrigger>
                        <SelectContent>
                            {cities.map((c) => (
                                <SelectItem key={c.id} value={c.city_name}>
                                    {c.city_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            <p className="text-sm text-muted-foreground">
                Help buyers find you by specifying your location
            </p>
        </div>
    )
}
