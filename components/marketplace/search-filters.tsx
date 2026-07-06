'use client'

import { useState, useEffect } from 'react'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet'
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
import { Slider } from '@/components/ui/slider'
import { Filter } from 'lucide-react'
import { getGhanaRegions } from '@/lib/marketplace-reference'
import type { GhanaRegion } from '@/lib/marketplace-types'

interface SearchFiltersProps {
    onFilterChange: (filters: {
        minPrice?: number
        maxPrice?: number
        region?: string
        condition?: string
        category?: string
    }) => void
    categories: Array<{ id: string; name: string }>
}

export function SearchFilters({ onFilterChange, categories }: SearchFiltersProps) {
    const [regions, setRegions] = useState<GhanaRegion[]>([])
    const [priceRange, setPriceRange] = useState([0, 10000])
    const [selectedRegion, setSelectedRegion] = useState<string>('')
    const [selectedCondition, setSelectedCondition] = useState<string>('')
    const [selectedCategory, setSelectedCategory] = useState<string>('')

    useEffect(() => {
        const load = async () => {
            const data = await getGhanaRegions()
            setRegions(data)
        }
        load()
    }, [])

    const handleApplyFilters = () => {
        onFilterChange({
            minPrice: priceRange[0],
            maxPrice: priceRange[1],
            region: selectedRegion || undefined,
            condition: selectedCondition || undefined,
            category: selectedCategory || undefined,
        })
    }

    const handleClearFilters = () => {
        setPriceRange([0, 10000])
        setSelectedRegion('')
        setSelectedCondition('')
        setSelectedCategory('')
        onFilterChange({})
    }

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                    <Filter className="w-4 h-4 mr-2" />
                    Filters
                </Button>
            </SheetTrigger>

            <SheetContent className="w-full sm:max-w-sm">
                <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                    <SheetDescription>
                        Refine your search results
                    </SheetDescription>
                </SheetHeader>

                <div className="space-y-6 mt-6">
                    {/* Category */}
                    <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                            <SelectTrigger>
                                <SelectValue placeholder="All categories" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Price Range */}
                    <div className="space-y-3">
                        <Label>Price Range (GHS)</Label>
                        <Slider
                            value={priceRange}
                            onValueChange={setPriceRange}
                            min={0}
                            max={10000}
                            step={50}
                            className="w-full"
                        />
                        <div className="flex gap-2 text-sm">
                            <span>GHS {priceRange[0]}</span>
                            <span>-</span>
                            <span>GHS {priceRange[1]}</span>
                        </div>
                    </div>

                    {/* Region */}
                    <div className="space-y-2">
                        <Label>Region</Label>
                        <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                            <SelectTrigger>
                                <SelectValue placeholder="All regions" />
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

                    {/* Condition */}
                    <div className="space-y-2">
                        <Label>Condition</Label>
                        <Select value={selectedCondition} onValueChange={setSelectedCondition}>
                            <SelectTrigger>
                                <SelectValue placeholder="All conditions" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="new">New</SelectItem>
                                <SelectItem value="like-new">Like New</SelectItem>
                                <SelectItem value="good">Good</SelectItem>
                                <SelectItem value="fair">Fair</SelectItem>
                                <SelectItem value="used">Used</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-4">
                        <Button
                            className="flex-1"
                            onClick={handleApplyFilters}
                        >
                            Apply Filters
                        </Button>
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={handleClearFilters}
                        >
                            Clear All
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
