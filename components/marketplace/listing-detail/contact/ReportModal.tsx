'use client'

import { useEffect, useState } from 'react'
import { Flag, Loader2, CheckCircle2 } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { useListingContact } from './ListingContactContext'
import type { ReportReason } from './types'

const REASONS: { value: ReportReason; label: string }[] = [
    { value: 'scam', label: 'Scam or fraud' },
    { value: 'prohibited', label: 'Prohibited item' },
    { value: 'duplicate', label: 'Duplicate listing' },
    { value: 'wrong_category', label: 'Wrong category' },
    { value: 'offensive', label: 'Offensive content' },
    { value: 'already_sold', label: 'Item already sold' },
    { value: 'other', label: 'Other' },
]

/**
 * Report button for viewers (never the owner — enforced by <ListingStatusActions>).
 * Disabled once the user has already reported this ad (one report per user).
 */
export function ReportAbuseButton() {
    const { isOwner, openReportModal, alreadyReported } = useListingContact()

    if (isOwner) return null

    return (
        <button
            type="button"
            onClick={openReportModal}
            disabled={alreadyReported}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-white"
        >
            <Flag className="h-4 w-4" />
            {alreadyReported ? 'Reported' : 'Report Abuse'}
        </button>
    )
}

export function ReportModal() {
    const { reportModalOpen, closeReportModal, submitReport, reporting, alreadyReported } =
        useListingContact()
    const [reason, setReason] = useState<ReportReason | ''>('')
    const [details, setDetails] = useState('')

    useEffect(() => {
        if (reportModalOpen) {
            setReason('')
            setDetails('')
        }
    }, [reportModalOpen])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!reason || reporting) return
        await submitReport({ reason, details })
    }

    return (
        <Dialog open={reportModalOpen} onOpenChange={(o) => !o && closeReportModal()}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <div className="mx-auto mb-1 grid h-11 w-11 place-items-center rounded-full bg-red-50 text-red-600">
                        <Flag className="h-5 w-5" />
                    </div>
                    <DialogTitle className="text-center">Report this ad</DialogTitle>
                    <DialogDescription className="text-center">
                        Tell us what&apos;s wrong. Reports are private and reviewed by our team.
                    </DialogDescription>
                </DialogHeader>

                {alreadyReported ? (
                    <div className="flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#00A652]" />
                        <span>You&apos;ve already reported this ad. Thanks — we&apos;re on it.</span>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <fieldset className="space-y-1">
                            {REASONS.map((r) => (
                                <label
                                    key={r.value}
                                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition ${
                                        reason === r.value
                                            ? 'border-red-400 bg-red-50 text-gray-900'
                                            : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="report-reason"
                                        value={r.value}
                                        checked={reason === r.value}
                                        onChange={() => setReason(r.value)}
                                        className="h-4 w-4 accent-red-600"
                                    />
                                    {r.label}
                                </label>
                            ))}
                        </fieldset>

                        <textarea
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                            rows={3}
                            maxLength={500}
                            placeholder="Additional details (optional)"
                            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400"
                        />

                        <button
                            type="submit"
                            disabled={!reason || reporting}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                        >
                            {reporting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Submitting…
                                </>
                            ) : (
                                'Submit Report'
                            )}
                        </button>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    )
}
