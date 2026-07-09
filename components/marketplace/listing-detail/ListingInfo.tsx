'use client'

import { useState, type ReactNode } from 'react'
import {
    MapPin,
    Eye,
    Share2,
    Tag,
    Settings2,
    Facebook,
    Twitter,
} from 'lucide-react'
import type { Listing } from './types'

interface ListingInfoProps {
    listing: Listing
    /** Save/bookmark control shown next to the title (see SaveButton). */
    saveSlot?: ReactNode
}

/** Small pill/chip for quick-scan specs. */
function Chip({ icon: Icon, label }: { icon: typeof Tag; label: string }) {
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-[13px] font-medium text-gray-700">
            <Icon className="h-3.5 w-3.5 text-gray-500" />
            {label}
        </span>
    )
}

export function ListingInfo({ listing, saveSlot }: ListingInfoProps) {
    const [expanded, setExpanded] = useState(false)

    const shareLinks = [
        { name: 'Facebook', Icon: Facebook, className: 'bg-[#1877F2]' },
        { name: 'Pinterest', Icon: Share2, className: 'bg-[#E60023]' },
        { name: 'X', Icon: Twitter, className: 'bg-black' },
        { name: 'WhatsApp', Icon: WhatsAppIcon, className: 'bg-[#25D366]' },
    ]

    return (
        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
            {/* Title + save/share */}
            <div className="flex items-start justify-between gap-3">
                <h1 className="text-lg font-bold leading-snug text-gray-900 sm:text-xl">
                    {listing.title}
                </h1>
                <div className="flex shrink-0 items-center gap-1">
                    {saveSlot}
                    <button
                        type="button"
                        aria-label="Share"
                        className="grid h-9 w-9 place-items-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-[#00A652]"
                    >
                        <Share2 className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Metadata row */}
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-gray-500">
                <span className="font-medium text-[#00A652]">Promoted</span>
                <span className="text-gray-300">·</span>
                <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {listing.location}
                </span>
                <span className="text-gray-300">·</span>
                <span>{listing.postedAt}</span>
            </div>

            {/* View count */}
            <div className="mt-1 inline-flex items-center gap-1 text-[13px] text-gray-500">
                <Eye className="h-3.5 w-3.5" />
                {listing.views.toLocaleString()} views
            </div>

            {/* Key attribute chips */}
            <div className="mt-4 flex flex-wrap gap-2">
                <Chip icon={Tag} label={listing.specs.condition} />
                <Chip icon={Settings2} label={listing.specs.transmission} />
            </div>

            {/* Description */}
            <div className="mt-5">
                <h2 className="mb-1.5 text-sm font-semibold text-gray-900">Description</h2>
                <p
                    className={`whitespace-pre-wrap text-sm leading-relaxed text-gray-700 ${
                        expanded ? '' : 'line-clamp-3'
                    }`}
                >
                    {listing.description}
                </p>
                <button
                    type="button"
                    onClick={() => setExpanded((e) => !e)}
                    className="mt-1 text-sm font-semibold text-[#00A652] hover:underline"
                >
                    {expanded ? 'Show less' : 'Show more'}
                </button>
            </div>

            {/* Social share row */}
            <div className="mt-5 flex items-center gap-2 border-t pt-4">
                <span className="mr-1 text-xs text-gray-500">Share:</span>
                {shareLinks.map(({ name, Icon, className }) => (
                    <button
                        key={name}
                        type="button"
                        aria-label={`Share on ${name}`}
                        className={`grid h-8 w-8 place-items-center rounded-full text-white transition hover:opacity-90 ${className}`}
                    >
                        <Icon className="h-4 w-4" />
                    </button>
                ))}
            </div>
        </div>
    )
}

/** lucide-react has no brand WhatsApp glyph, so inline a minimal one. */
function WhatsAppIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
            <path d="M17.5 14.4c-.3-.15-1.7-.85-2-.95-.26-.1-.46-.15-.65.15-.2.3-.75.94-.92 1.14-.17.2-.34.22-.63.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.34.44-.5.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.65-1.57-.9-2.15-.24-.57-.48-.5-.65-.5h-.56c-.2 0-.5.07-.77.37-.26.3-1 .98-1 2.4 0 1.4 1.03 2.76 1.17 2.96.15.2 2.02 3.08 4.9 4.32.68.3 1.22.47 1.63.6.68.22 1.3.19 1.8.11.55-.08 1.7-.7 1.94-1.36.24-.67.24-1.24.17-1.36-.07-.12-.26-.2-.56-.34zM12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.5A10 10 0 1 0 12 2z" />
        </svg>
    )
}
