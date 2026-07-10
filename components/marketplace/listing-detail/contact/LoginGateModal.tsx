'use client'

import { useState } from 'react'
import { Lock, Loader2 } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useListingContact } from './ListingContactContext'

/**
 * Login/signup gate. Shown when a logged-out buyer taps "Show Contact" or
 * "Request call back". After auth, the original action resumes automatically.
 */
export function LoginGateModal() {
    const { loginGateOpen, loginGateReason, closeLoginGate, confirmLogin } = useListingContact()
    const [busy, setBusy] = useState(false)

    const handleContinue = async () => {
        setBusy(true)
        try {
            await confirmLogin()
        } finally {
            setBusy(false)
        }
    }

    return (
        <Dialog open={loginGateOpen} onOpenChange={(o) => !o && closeLoginGate()}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-[#00A652]/10 text-[#00A652]">
                        <Lock className="h-6 w-6" />
                    </div>
                    <DialogTitle className="text-center">
                        {loginGateReason || 'Sign in to continue'}
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        Sign in or create a free account to view contact details and message
                        sellers safely.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-2 space-y-2">
                    <Button
                        onClick={handleContinue}
                        disabled={busy}
                        className="w-full bg-[#00A652] text-white hover:bg-[#008f47]"
                    >
                        {busy ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Signing in…
                            </>
                        ) : (
                            'Sign in / Sign up'
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={closeLoginGate}
                        disabled={busy}
                        className="w-full"
                    >
                        Not now
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
