'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

/**
 * One-time payment-number verification.
 *
 * Opened when a checkout returns 403 { code: 'OTP_REQUIRED' } — which only ever
 * happens the FIRST time a number is used to pay. Once the code is accepted the
 * number is trusted permanently, so a returning customer never sees this dialog
 * again on any surface.
 *
 * `onVerified` should replay the checkout call that was refused.
 */
interface PaymentOtpDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    phone: string
    /** Guest storefront uses the unauthenticated /api/shop/otp/* pair. */
    variant?: 'account' | 'guest'
    onVerified: () => void
}

const RESEND_COOLDOWN_SECONDS = 60

export function PaymentOtpDialog({
    open,
    onOpenChange,
    phone,
    variant = 'account',
    onVerified,
}: PaymentOtpDialogProps) {
    const [code, setCode] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [sending, setSending] = useState(false)
    const [cooldown, setCooldown] = useState(0)
    // Guards React 18 StrictMode's double-effect from sending two codes.
    const sentForPhone = useRef<string | null>(null)

    const sendPath = variant === 'guest' ? '/api/shop/otp/send' : '/api/payments/otp/send'
    const verifyPath = variant === 'guest' ? '/api/shop/otp/verify' : '/api/payments/otp/verify'

    const sendCode = async (isResend = false) => {
        setError('')
        setSending(true)
        try {
            const res = await fetch(sendPath, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone }),
            })
            const data = await res.json()

            if (!res.ok) {
                setError(data.error || 'Could not send the code.')
                return
            }

            // The number turned out to be already trusted (or is the registered one) —
            // no code was sent and none is needed. Close and continue the payment.
            if (data.alreadyVerified || data.alreadyRegistered) {
                onOpenChange(false)
                onVerified()
                return
            }

            setCooldown(RESEND_COOLDOWN_SECONDS)
            if (isResend) toast.success('A new code was sent.')
        } catch {
            setError('Network error. Please try again.')
        } finally {
            setSending(false)
        }
    }

    // Send the first code as soon as the dialog opens for a given number.
    useEffect(() => {
        if (!open) {
            sentForPhone.current = null
            setCode('')
            setError('')
            setCooldown(0)
            return
        }
        if (sentForPhone.current === phone) return
        sentForPhone.current = phone
        void sendCode()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, phone])

    useEffect(() => {
        if (cooldown <= 0) return
        const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
        return () => clearTimeout(t)
    }, [cooldown])

    const verify = async () => {
        if (code.trim().length !== 6) {
            setError('Enter the 6-digit code.')
            return
        }
        setError('')
        setLoading(true)
        try {
            const res = await fetch(verifyPath, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, code: code.trim() }),
            })
            const data = await res.json()

            if (!res.ok) {
                setError(data.error || 'Verification failed.')
                return
            }

            toast.success('Number verified — you won\'t need a code for it again.')
            onOpenChange(false)
            onVerified()
        } catch {
            setError('Network error. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onOpenChange(false)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Verify {phone}</DialogTitle>
                    <DialogDescription>
                        This is a one-time check. Enter the 6-digit code we sent to this number —
                        you won&apos;t be asked again for it.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <Input
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        className="text-center text-lg tracking-[0.5em]"
                    />

                    {error && <p className="text-sm text-red-600">{error}</p>}

                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => sendCode(true)}
                            disabled={sending || cooldown > 0}
                            className="text-sm text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
                        >
                            {cooldown > 0 ? `Resend in ${cooldown}s` : sending ? 'Sending…' : 'Resend code'}
                        </button>
                    </div>

                    <div className="flex gap-2 pt-1">
                        <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button className="flex-1" onClick={verify} disabled={loading || code.length !== 6}>
                            {loading ? 'Verifying…' : 'Verify & Pay'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default PaymentOtpDialog
