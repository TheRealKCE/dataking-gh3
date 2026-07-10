'use client'

import { useState } from 'react'
import { Bookmark } from 'lucide-react'
import { useSavedItems } from './SavedItemsContext'
import type { SaveButtonSize, SaveButtonPlacement } from './types'

interface SaveButtonProps {
    listingId: string
    /** When set and the viewer owns the listing, the button is hidden. */
    ownerId?: string
    size?: SaveButtonSize
    /** 'overlay' = circular translucent chip (on images); 'inline' = bare icon. */
    placement?: SaveButtonPlacement
    className?: string
}

const BTN_SIZE: Record<SaveButtonSize, string> = {
    sm: 'h-8 w-8',
    md: 'h-9 w-9',
    lg: 'h-11 w-11',
}
const ICON_SIZE: Record<SaveButtonSize, string> = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
}

export function SaveButton({
    listingId,
    ownerId,
    size = 'md',
    placement = 'inline',
    className = '',
}: SaveButtonProps) {
    const { isSaved, toggleSave, isOwner } = useSavedItems()
    const [bump, setBump] = useState(false)

    // Owner exception — sellers can't save their own ad.
    if (isOwner(ownerId)) return null

    const saved = isSaved(listingId)

    const handleClick = () => {
        setBump(true)
        window.setTimeout(() => setBump(false), 220)
        toggleSave(listingId)
    }

    const base =
        placement === 'overlay'
            ? 'bg-black/40 text-white backdrop-blur hover:bg-black/60'
            : 'text-gray-500 hover:bg-gray-100 hover:text-[#00A652]'

    return (
        <button
            type="button"
            onClick={handleClick}
            aria-pressed={saved}
            aria-label={saved ? 'Remove from saved' : 'Save listing'}
            className={`grid place-items-center rounded-full transition-transform duration-150 ${
                bump ? 'scale-125' : 'scale-100'
            } ${BTN_SIZE[size]} ${base} ${className}`}
        >
            <Bookmark
                className={`${ICON_SIZE[size]} transition-colors ${
                    saved ? 'fill-[#00A652] text-[#00A652]' : ''
                }`}
            />
        </button>
    )
}
