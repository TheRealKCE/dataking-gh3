'use client'

import { useEffect, useState } from 'react'
import { PhoneCall, Loader2, CheckCircle2 } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { useListingContact } from './ListingContactContext'
import { CALLBACK_COOLDOWN_MS } from './types'

function minutesAgo(sinceMs: number): string {
    const mins = Math.floor((Date.now() - sinceMs) / 60_000)
    if (mins < 1) return 'just now'
    if (mins === 1) return '1 min ago'
    if (mins < 60) return `${mins} min ago`
    const hrs = Math.floor(mins / 60)
    return hrs === 1 ? '1 hour ago' : `${hrs} hours ago`
}

/**
 * Outlined "Request call back" button for the price card. Handles the auth gate
 * and the 1-hour cooldown (disabled + "Request sent X ago" while cooling down).
 */
export function RequestCallBackButton() {
    const { openCallBackModal, cooldownRemainingMs, lastRequestAt, seller, contactDisabled } =
        useListingContact()
    const cooling = cooldownRemainingMs > 0 && lastRequestAt != null

    // Hidden when the seller disabled call-backs or the listing is inactive.
    if (!seller.allowCallBacks || contactDisabled) return null

    return (
        <button
            type="button"
            onClick={openCallBackModal}
            disabled={cooling}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#00A652] px-4 py-2.5 text-sm font-semibold text-[#00A652] transition hover:bg-[#00A652]/5 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-transparent"
        >
            <PhoneCall className="h-4 w-4" />
            {cooling && lastRequestAt != null
                ? `Request sent ${minutesAgo(lastRequestAt)}`
                : 'Request call back'}
        </button>
    )
}

/** The modal itself — controlled by ListingContact context. */
export function RequestCallBackModal() {
    const {
        callBackModalOpen,
        closeCallBackModal,
        submitCallBack,
        submitting,
        user,
        seller,
        cooldownRemainingMs,
    } = useListingContact()

    const [phone, setPhone] = useState('')
    const [note, setNote] = useState('')

    // Auto-fill the buyer's phone from their profile each time it opens.
    useEffect(() => {
        if (callBackModalOpen) {
            setPhone(user?.phone ?? '')
            setNote('')
        }
    }, [callBackModalOpen, user?.phone])

    const cooling = cooldownRemainingMs > 0
    const valid = phone.replace(/\D/g, '').length >= 9

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!valid || cooling) return
        await submitCallBack({ phone, note })
    }

    return (
        <Dialog open={callBackModalOpen} onOpenChange={(o) => !o && closeCallBackModal()}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Request a call back from {seller.name}</DialogTitle>
                    <DialogDescription>
                        Share your number and {seller.name.split(' ')[0]} will call you back.
                    </DialogDescription>
                </DialogHeader>

                {cooling ? (
                    <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                            You already sent a request. You can send another in about{' '}
                            {Math.ceil(cooldownRemainingMs / 60_000)} min.
                        </span>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div>
                            <label
                                htmlFor="cb-phone"
                                className="mb-1 block text-xs font-medium text-gray-600"
                            >
                                Your phone number
                            </label>
                            <input
                                id="cb-phone"
                                type="tel"
                                inputMode="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="024 XXX XXXX"
                                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#00A652] focus:ring-1 focus:ring-[#00A652]"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="cb-note"
                                className="mb-1 block text-xs font-medium text-gray-600"
                            >
                                Add a note (optional)
                            </label>
                            <textarea
                                id="cb-note"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                rows={3}
                                maxLength={280}
                                placeholder="Is this still available?"
                                className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#00A652] focus:ring-1 focus:ring-[#00A652]"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={!valid || submitting}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00A652] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#008f47] disabled:opacity-60"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Sending…
                                </>
                            ) : (
                                'Send Request'
                            )}
                        </button>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    )
}
