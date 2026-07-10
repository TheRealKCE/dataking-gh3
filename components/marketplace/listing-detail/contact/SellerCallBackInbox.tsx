'use client'

import { useEffect, useState } from 'react'
import {
    PhoneCall,
    Check,
    X,
    User,
    Clock,
    Inbox,
    Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { CallBackRequest, CallBackStatus } from './types'
import { getCallBackRequests, updateCallBackStatus } from './mock-api'

function timeAgo(iso: string): string {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins} min ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
}

const telHref = (phone: string) => {
    const d = phone.replace(/\D/g, '')
    return `tel:${d.startsWith('0') ? '+233' + d.slice(1) : '+' + d}`
}

const STATUS_STYLES: Record<CallBackStatus, string> = {
    pending: 'bg-amber-100 text-amber-700',
    called: 'bg-[#00A652]/10 text-[#00A652]',
    expired: 'bg-gray-100 text-gray-500',
}

/**
 * Seller-side inbox for call-back requests. Drop into the seller dashboard /
 * "My Ads" area. Real backend: GET /call-back-requests?sellerId=.
 */
export function SellerCallBackInbox({ sellerId = 'sel_kwasi_ben' }: { sellerId?: string }) {
    const [requests, setRequests] = useState<CallBackRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [busyId, setBusyId] = useState<string | null>(null)

    useEffect(() => {
        let alive = true
        getCallBackRequests(sellerId)
            .then((r) => alive && setRequests(r))
            .finally(() => alive && setLoading(false))
        return () => {
            alive = false
        }
    }, [sellerId])

    const pendingCount = requests.filter((r) => r.status === 'pending').length

    const setStatus = async (id: string, status: CallBackStatus, label: string) => {
        setBusyId(id)
        const updated = await updateCallBackStatus(id, status)
        setBusyId(null)
        if (updated) {
            setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)))
            toast.success(label)
        }
    }

    return (
        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center gap-2">
                <Inbox className="h-5 w-5 text-gray-700" />
                <h2 className="text-base font-bold text-gray-900">Call Back Requests</h2>
                {pendingCount > 0 && (
                    <span className="grid min-w-5 place-items-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                        {pendingCount}
                    </span>
                )}
            </div>

            {loading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading requests…
                </div>
            ) : requests.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">
                    No call-back requests yet.
                </div>
            ) : (
                <ul className="space-y-3">
                    {requests.map((req) => (
                        <li
                            key={req.id}
                            className="rounded-xl border border-gray-100 p-3 transition hover:border-gray-200"
                        >
                            <div className="flex gap-3">
                                {/* Buyer avatar */}
                                <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-gray-100 text-gray-400">
                                    {req.buyerAvatarUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={req.buyerAvatarUrl}
                                            alt={req.buyerName}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <User className="h-5 w-5" />
                                    )}
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="truncate text-sm font-semibold text-gray-900">
                                            {req.buyerName}
                                        </p>
                                        <span
                                            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[req.status]}`}
                                        >
                                            {req.status}
                                        </span>
                                    </div>

                                    <a
                                        href={telHref(req.buyerPhone)}
                                        className="text-sm font-medium text-[#00A652] hover:underline"
                                    >
                                        {req.buyerPhone}
                                    </a>

                                    <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                                        <Clock className="h-3 w-3" />
                                        {timeAgo(req.createdAt)}
                                        <span className="text-gray-300">·</span>
                                        <span className="truncate">{req.listingTitle}</span>
                                    </div>

                                    {req.note && (
                                        <p className="mt-1.5 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs text-gray-600">
                                            “{req.note}”
                                        </p>
                                    )}

                                    {/* Actions */}
                                    {req.status === 'pending' && (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            <a
                                                href={telHref(req.buyerPhone)}
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#00A652] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#008f47]"
                                            >
                                                <PhoneCall className="h-3.5 w-3.5" />
                                                Call Now
                                            </a>
                                            <button
                                                type="button"
                                                disabled={busyId === req.id}
                                                onClick={() =>
                                                    setStatus(req.id, 'called', 'Marked as called')
                                                }
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                                            >
                                                <Check className="h-3.5 w-3.5" />
                                                Mark as Called
                                            </button>
                                            <button
                                                type="button"
                                                disabled={busyId === req.id}
                                                onClick={() =>
                                                    setStatus(req.id, 'expired', 'Request dismissed')
                                                }
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-50 disabled:opacity-50"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                                Dismiss
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
