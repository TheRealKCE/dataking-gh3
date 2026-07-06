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

interface StepCategoryProps {
    value?: string
    onChange: (categoryId: string, categoryName: string) => void
}

export function StepCategory({ value, onChange }: StepCategoryProps) {
    const [categories, setCategories] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadCategories = async () => {
            try {
                const response = await fetch('/api/classifieds/categories')
                const data = await response.json()
                setCategories(data.data || [])
            } catch (error) {
                console.error('[StepCategory] Error loading categories:', error)
            } finally {
                setLoading(false)
            }
        }
        loadCategories()
    }, [])

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Category</Label>
                <Select value={value} onValueChange={(categoryId) => {
                    const category = categories.find(c => c.id === categoryId)
                    onChange(categoryId, category?.name || '')
                }}>
                    <SelectTrigger disabled={loading}>
                        <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                        {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                                {category.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <p className="text-sm text-muted-foreground">
                Choose the category that best describes your item
            </p>
        </div>
    )
}
