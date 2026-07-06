'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { validateGhanaianPhone } from '@/lib/phone-validation'
import { cn } from '@/lib/utils'

const DASHBOARD = '/classifieds/seller/dashboard'

interface SellButtonProps {
    className?: string
    children?: React.ReactNode
}

/**
 * "Sell" entry point. Branches on auth state:
 *  - already a seller       -> straight to the seller dashboard
 *  - logged in, not a seller-> phone popup -> /api/classifieds/seller/enable
 *  - not logged in          -> phone popup -> /api/classifieds/seller/quick-start
 *                              (invisible account, no login screen)
 */
export function SellButton({ className, children }: SellButtonProps) {
    const router = useRouter()
    const { session, isSeller, refreshUser } = useAuth()

    const [open, setOpen] = useState(false)
    const [phone, setPhone] = useState('')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const handleClick = () => {
        if (isSeller) {
            router.push(DASHBOARD)
            return
        }
        setOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        const validation = validateGhanaianPhone(phone)
        if (!validation.isValid) {
            setError(validation.error || 'Enter a valid Ghana phone number')
            return
        }

        setSubmitting(true)
        try {
            if (session) {
                // Logged in but not yet a seller — enable on the existing account
                const res = await fetch('/api/classifieds/seller/enable', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({ phone_number: phone.trim() }),
                })
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}))
                    throw new Error(data.error || 'Could not enable selling')
                }
            } else {
                // Not logged in — provision an invisible account, then sign in silently
                const res = await fetch('/api/classifieds/seller/quick-start', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone_number: phone.trim() }),
                })
                const data = await res.json().catch(() => ({}))
                if (!res.ok) throw new Error(data.error || 'Could not start selling')

                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email: data.email,
                    password: data.password,
                })
                if (signInError) throw new Error(signInError.message)
            }

            await refreshUser()
            toast.success('You are now a seller! 🎉')
            setOpen(false)
            router.push(DASHBOARD)
        } catch (err: any) {
            toast.error(err?.message || 'Something went wrong. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <>
            <Button
                type="button"
                onClick={handleClick}
                className={cn(
                    'bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg px-6 py-2',
                    className
                )}
            >
                {children ?? 'SELL'}
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Become a Seller</DialogTitle>
                        <DialogDescription>
                            Enter your phone number to start selling. We&apos;ll set up your
                            seller account instantly — no login required.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div className="space-y-1">
                            <Input
                                type="tel"
                                inputMode="tel"
                                autoFocus
                                placeholder="e.g. 024 123 4567"
                                value={phone}
                                onChange={(e) => {
                                    setPhone(e.target.value)
                                    if (error) setError('')
                                }}
                                aria-invalid={!!error}
                                disabled={submitting}
                            />
                            {error && <p className="text-sm text-destructive">{error}</p>}
                        </div>

                        <Button type="submit" className="w-full" disabled={submitting}>
                            {submitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Setting up your shop…
                                </>
                            ) : (
                                'Become a Seller'
                            )}
                        </Button>

                        <p className="text-xs text-muted-foreground text-center">
                            We&apos;ll send a confirmation SMS to this number.
                        </p>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    )
}
