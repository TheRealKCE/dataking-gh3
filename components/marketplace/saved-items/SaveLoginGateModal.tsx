'use client'

import { useState } from 'react'
import { Bookmark, Loader2 } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useSavedItems } from './SavedItemsContext'

/**
 * Login gate shown when a logged-out user taps a SaveButton. After auth, the
 * pending listing is saved automatically. Render once inside SavedItemsProvider.
 */
export function SaveLoginGateModal() {
    const { loginGateOpen, closeLoginGate, confirmLogin } = useSavedItems()
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
                        <Bookmark className="h-6 w-6" />
                    </div>
                    <DialogTitle className="text-center">Sign in to save this ad</DialogTitle>
                    <DialogDescription className="text-center">
                        Create a free account to keep your saved listings in one place across
                        devices.
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
                    <Button variant="ghost" onClick={closeLoginGate} disabled={busy} className="w-full">
                        Not now
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
