'use client'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

interface StepDetailsProps {
    title: string
    description: string
    condition: string
    onChange: (updates: Partial<{ title: string; description: string; condition: string }>) => void
}

export function StepDetails({ title, description, condition, onChange }: StepDetailsProps) {
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                    id="title"
                    placeholder="e.g., iPhone 12 Pro Max 256GB"
                    value={title}
                    onChange={(e) => onChange({ title: e.target.value })}
                    maxLength={100}
                />
                <p className="text-sm text-muted-foreground">{title.length}/100</p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                    id="description"
                    placeholder="Describe the item, condition, features, and any defects..."
                    value={description}
                    onChange={(e) => onChange({ description: e.target.value })}
                    rows={6}
                    maxLength={1000}
                />
                <p className="text-sm text-muted-foreground">{description.length}/1000</p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="condition">Condition</Label>
                <Select value={condition} onValueChange={(value) => onChange({ condition: value })}>
                    <SelectTrigger id="condition">
                        <SelectValue />
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
        </div>
    )
}
