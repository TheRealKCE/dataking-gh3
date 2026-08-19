'use client'

import { Loader2, ShieldAlert } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'

/**
 * Shown when a purchase is blocked because the recipient's MTN number has never been
 * registered for data on our supplier account.
 *
 * Shared by the dashboard (single + bulk) and the shop storefront so the promise made
 * to the buyer is worded identically everywhere. Note the copy says registration has
 * ALREADY started — it has: the check that produced this dialog submits the number as
 * a side effect, so claiming otherwise would be untrue.
 */
export interface MtnRegistrationDialogProps {
    open: boolean
    /** The blocked number. For a batch, the first one — `numbers` carries the rest. */
    phoneNumber?: string
    /** All blocked numbers, when a batch triggered this. */
    numbers?: string[]
    /** Total lines in the batch, for the "3 of 20" framing. */
    total?: number
    isSubmitting?: boolean
    onConfirm: () => void
    onCancel: () => void
    /** Bulk only: drop the unregistered lines and buy the rest. */
    onRemove?: () => void
}

export function MtnRegistrationDialog({
    open,
    phoneNumber,
    numbers,
    total,
    isSubmitting = false,
    onConfirm,
    onCancel,
    onRemove,
}: MtnRegistrationDialogProps) {
    const blocked = numbers && numbers.length > 0 ? numbers : phoneNumber ? [phoneNumber] : []
    const isBatch = blocked.length > 1

    return (
        <Dialog open={open} onOpenChange={(o) => !o && !isSubmitting && onCancel()}>
            {/* z-[110] beats the hand-rolled purchase sheets (z-[70]) and the storefront
                sidebar (z-[100]). Those callers also hide themselves while this is open —
                this is the backstop so the prompt is never buried by a new overlay. */}
            <DialogContent className="w-[95%] max-w-sm rounded-2xl z-[110]">
                <DialogHeader>
                    <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                        <ShieldAlert className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <DialogTitle className="text-center">
                        {isBatch
                            ? `${blocked.length}${total ? ` of ${total}` : ''} numbers are not registered`
                            : 'This number is not registered yet'}
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        {isBatch
                            ? 'These MTN numbers have never received data from us before. We’ve started registering them — this can take up to 2 weeks.'
                            : 'This MTN number has never received data from us before. We’ve started registering it — this can take up to 2 weeks.'}
                    </DialogDescription>
                </DialogHeader>

                {blocked.length > 0 && (
                    <div className="max-h-32 overflow-y-auto rounded-xl bg-muted/60 px-3 py-2">
                        {blocked.map((n) => (
                            <p key={n} className="font-mono text-sm font-semibold tracking-wide">
                                {n}
                            </p>
                        ))}
                    </div>
                )}

                <p className="text-center text-xs text-muted-foreground">
                    {isBatch ? 'Their data' : 'The data'} will be delivered automatically the moment
                    registration completes — you don&apos;t need to do anything else. After that,
                    future orders to {isBatch ? 'these numbers' : 'this number'} are instant.
                </p>

                <div className="mt-1 flex flex-col gap-2">
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isSubmitting}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
                    >
                        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isBatch ? 'I agree, continue with all' : 'I agree to the terms'}
                    </button>

                    {onRemove && (
                        <button
                            type="button"
                            onClick={onRemove}
                            disabled={isSubmitting}
                            className="w-full rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition hover:bg-muted disabled:opacity-60"
                        >
                            Remove them and buy the rest
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="w-full rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-60"
                    >
                        Cancel
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
