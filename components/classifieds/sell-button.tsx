'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { GoogleSignInButton } from '@/components/google-sign-in-button'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'

const DASHBOARD = '/classifieds/seller/dashboard'

interface SellButtonProps {
    className?: string
    children?: React.ReactNode
}

/**
 * "Sell" entry point. Branches on auth state:
 *  - already logged in -> straight to the seller dashboard, which enables seller
 *                         status on arrival for anyone who isn't a seller yet.
 *  - not logged in     -> Google sign-in popup; the marketplace OAuth callback
 *                         (/classifieds/auth/callback) returns them to the
 *                         dashboard once authenticated. No phone number needed.
 */
export function SellButton({ className, children }: SellButtonProps) {
    const router = useRouter()
    const { session } = useAuth()

    const [open, setOpen] = useState(false)

    const handleClick = () => {
        // Any authenticated user goes straight to the dashboard — the dashboard
        // flips on `is_seller` for them if needed. Only guests see the modal.
        if (session) {
            router.push(DASHBOARD)
            return
        }
        setOpen(true)
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
                        <DialogTitle>Sell on ARHMS</DialogTitle>
                        <DialogDescription>
                            Sign in with your Google account to start selling. New sellers are
                            set up instantly, and returning sellers go straight to their
                            dashboard — no password needed.
                        </DialogDescription>
                    </DialogHeader>

                    <GoogleSignInButton
                        label="Continue with Google"
                        callbackPath="/classifieds/auth/callback"
                        next={DASHBOARD}
                    />
                </DialogContent>
            </Dialog>
        </>
    )
}
