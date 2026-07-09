'use client'

import type { ReactNode } from 'react'
import { BadgeCheck, User } from 'lucide-react'
import type { ListingSeller } from './types'

interface SellerCardProps {
    seller: ListingSeller
    /** Slot for the "Show Contact" action (see ShowContactButton). */
    contactButton?: ReactNode
    /**
     * Slot for the owner/viewer status action (see ListingStatusActions):
     * "Mark unavailable" for the owner, "Report Abuse" for viewers. Mutually
     * exclusive — never both.
     */
    statusActions?: ReactNode
}

export function SellerCard({ seller, contactButton, statusActions }: SellerCardProps) {
    return (
        <div className="space-y-3">
            {/* Seller identity */}
            <div className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-gray-100 text-gray-400">
                        {seller.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={seller.avatarUrl}
                                alt={seller.name}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <User className="h-6 w-6" />
                        )}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1">
                            <p className="truncate font-semibold text-gray-900">{seller.name}</p>
                            {seller.verified && (
                                <BadgeCheck className="h-4 w-4 shrink-0 text-[#00A652]" />
                            )}
                        </div>
                        <p className="text-xs text-gray-500">{seller.memberSince}</p>
                    </div>
                </div>

                <div className="mt-4">{contactButton}</div>
            </div>

            {/* Status action (owner: mark unavailable · viewer: report abuse) */}
            {statusActions}
        </div>
    )
}
