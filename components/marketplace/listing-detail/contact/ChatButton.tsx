'use client'

import { MessageCircle } from 'lucide-react'
import { useListingContact } from './ListingContactContext'

/**
 * Dedicated "Chat" button for the seller card — sits next to "Show Contact".
 * Opens (find-or-create) the conversation for this listing and navigates to the
 * chat screen. Auth-gated and hidden for the owner / inactive listings.
 */
export function ChatButton({ variant = 'icon' }: { variant?: 'icon' | 'full' }) {
    const { startChat, isOwner, contactDisabled } = useListingContact()

    if (isOwner || contactDisabled) return null

    if (variant === 'full') {
        return (
            <button
                type="button"
                onClick={startChat}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#00A652] px-4 py-3 text-sm font-semibold text-[#00A652] transition hover:bg-[#00A652]/5"
            >
                <MessageCircle className="h-4 w-4" />
                Chat
            </button>
        )
    }

    return (
        <button
            type="button"
            onClick={startChat}
            aria-label="Chat with seller"
            title="Chat with seller"
            className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-xl border border-[#00A652] text-[#00A652] transition hover:bg-[#00A652]/5"
        >
            <MessageCircle className="h-5 w-5" />
        </button>
    )
}
