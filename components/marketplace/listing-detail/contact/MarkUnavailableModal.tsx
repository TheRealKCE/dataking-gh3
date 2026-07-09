'use client'

import { useEffect, useState } from 'react'
import { EyeOff, RotateCcw, Loader2 } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { useListingContact } from './ListingContactContext'
import type { MarkUnavailableReason } from './types'

const REASONS: { value: MarkUnavailableReason; label: string }[] = [
    { value: 'sold', label: 'Sold' },
    { value: 'no_longer_selling', label: 'No longer selling' },
    { value: 'other', label: 'Other' },
]

/**
 * Owner-only toggle. Shows "Mark unavailable" while active, and "Mark as
 * available" (relist) once the ad is unavailable/sold. Rendered only for the
 * listing owner via <ListingStatusActions>.
 */
export function MarkUnavailableButton() {
    const { isOwner, listingActive, openMarkModal, markAvailable, statusUpdating } =
        useListingContact()

    if (!isOwner) return null

    if (!listingActive) {
        return (
            <button
                type="button"
                onClick={() => void markAvailable()}
                disabled={statusUpdating}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#00A652] bg-[#00A652]/5 px-3 py-2.5 text-xs font-semibold text-[#00A652] transition hover:bg-[#00A652]/10 disabled:opacity-60"
            >
                {statusUpdating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <RotateCcw className="h-4 w-4" />
                )}
                Mark as available
            </button>
        )
    }

    return (
        <button
            type="button"
            onClick={openMarkModal}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
        >
            <EyeOff className="h-4 w-4" />
            Mark unavailable
        </button>
    )
}

export function MarkUnavailableModal() {
    const { markModalOpen, closeMarkModal, markUnavailable, statusUpdating } = useListingContact()
    const [reason, setReason] = useState<MarkUnavailableReason | ''>('')

    useEffect(() => {
        if (markModalOpen) setReason('')
    }, [markModalOpen])

    return (
        <Dialog open={markModalOpen} onOpenChange={(o) => !o && closeMarkModal()}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Mark this ad as unavailable?</DialogTitle>
                    <DialogDescription>
                        Buyers won&apos;t be able to contact you about it, and it will drop out of
                        search results. You can relist it any time.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-1">
                    <label
                        htmlFor="mu-reason"
                        className="mb-1 block text-xs font-medium text-gray-600"
                    >
                        Reason (optional)
                    </label>
                    <select
                        id="mu-reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value as MarkUnavailableReason)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#00A652] focus:ring-1 focus:ring-[#00A652]"
                    >
                        <option value="">Select a reason…</option>
                        {REASONS.map((r) => (
                            <option key={r.value} value={r.value}>
                                {r.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="mt-4 flex gap-2">
                    <button
                        type="button"
                        onClick={closeMarkModal}
                        disabled={statusUpdating}
                        className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-60"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => void markUnavailable(reason || undefined)}
                        disabled={statusUpdating}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#00A652] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#008f47] disabled:opacity-60"
                    >
                        {statusUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
                        Confirm
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
