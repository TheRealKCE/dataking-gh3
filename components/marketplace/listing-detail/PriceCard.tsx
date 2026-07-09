import type { ReactNode } from 'react'
import type { Listing } from './types'

interface PriceCardProps {
    price: number
    currency: string
    negotiable: boolean
    /** Slot for the "Request call back" action (see RequestCallBackButton). */
    action?: ReactNode
}

export function formatPrice(price: number, currency: string) {
    return `${currency} ${price.toLocaleString()}`
}

export function PriceCard({ price, currency, negotiable, action }: PriceCardProps) {
    return (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-3xl font-extrabold leading-none text-[#00A652]">
                {formatPrice(price, currency)}
            </p>
            {negotiable && <p className="mt-1 text-sm text-gray-500">Negotiable</p>}

            {action}
        </div>
    )
}

// Re-export the Listing type consumers may want alongside the card.
export type { Listing }
