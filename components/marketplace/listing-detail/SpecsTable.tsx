'use client'

import { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import type { ListingSpecs } from './types'

interface SpecsTableProps {
    specs: ListingSpecs
}

// Human-readable labels + the order they appear. The first 5 show by default;
// anything beyond is revealed by "Show more".
const SPEC_LABELS: { key: keyof ListingSpecs | string; label: string }[] = [
    { key: 'brand', label: 'Original parts' },
    { key: 'model', label: 'Model' },
    { key: 'year', label: 'Year of manufacture' },
    { key: 'transmission', label: 'Transmission' },
    { key: 'color', label: 'Colour' },
    { key: 'fuel', label: 'Fuel' },
    { key: 'mileage', label: 'Mileage' },
    { key: 'bodyType', label: 'Body type' },
    { key: 'engineSize', label: 'Engine size' },
    { key: 'condition', label: 'Condition' },
]

const INITIAL_COUNT = 5

export function SpecsTable({ specs }: SpecsTableProps) {
    const [expanded, setExpanded] = useState(false)

    const rows = SPEC_LABELS.filter(({ key }) => specs[key as string])
    const visible = expanded ? rows : rows.slice(0, INITIAL_COUNT)
    const hasMore = rows.length > INITIAL_COUNT

    return (
        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Details</h2>

            <dl className="divide-y divide-gray-100">
                {visible.map(({ key, label }) => (
                    <div
                        key={key as string}
                        className="flex items-center justify-between gap-3 py-2.5"
                    >
                        <dt className="text-sm text-gray-500">{label}</dt>
                        <dd className="flex items-center gap-1 text-sm font-semibold text-gray-900">
                            {specs[key as string]}
                            <ChevronRight className="h-4 w-4 text-gray-300" />
                        </dd>
                    </div>
                ))}
            </dl>

            {hasMore && (
                <button
                    type="button"
                    onClick={() => setExpanded((e) => !e)}
                    className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#00A652] hover:underline"
                >
                    {expanded ? 'Show less' : 'Show more'}
                    <ChevronDown
                        className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    />
                </button>
            )}
        </div>
    )
}
