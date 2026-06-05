'use client'

import { useEffect, useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Store, CheckCircle, Clock, CreditCard } from 'lucide-react'
import { toast } from 'sonner'

const DISMISSED_KEY = 'dealership_offer_dismissed'

interface DealerWelcomeModalProps {
    onClaimed: () => void
}

export function DealerWelcomeModal({ onClaimed }: DealerWelcomeModalProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isClaiming, setIsClaiming] = useState(false)

    useEffect(() => {
        const dismissed = sessionStorage.getItem(DISMISSED_KEY)
        if (!dismissed) {
            setIsOpen(true)
        }
    }, [])

    const handleDismiss = () => {
        sessionStorage.setItem(DISMISSED_KEY, 'true')
        setIsOpen(false)
    }

    const handleClaim = async () => {
        setIsClaiming(true)
        try {
            const response = await fetch('/api/user/claim-dealer', { method: 'POST' })
            const data = await response.json()

            if (!response.ok) {
                toast.error(data.error || 'Failed to claim dealership')
                return
            }

            toast.success('Dealership claimed! Welcome to your free 1-month trial.')
            setIsOpen(false)
            onClaimed()
        } catch (error) {
            toast.error('Something went wrong. Please try again.')
        } finally {
            setIsClaiming(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleDismiss() }}>
            <DialogContent className="sm:max-w-md w-[95vw] rounded-3xl overflow-hidden p-0 gap-0 border-0 bg-white dark:bg-gray-950 shadow-2xl">
                {/* Banner */}
                <div className="relative pt-8 pb-4 bg-violet-50 dark:bg-violet-950/20 px-4 sm:px-6">
                    <div className="absolute -right-4 -top-4 w-28 h-28 opacity-[0.06] rounded-full bg-violet-600 pointer-events-none" />
                    <DialogHeader className="relative z-10 flex flex-col items-center gap-3">
                        <div className="w-14 h-14 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shadow-inner">
                            <Store className="w-7 h-7 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-violet-600 text-white mb-2 shadow-sm">
                                New Opportunity
                            </span>
                            <DialogTitle className="text-center text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                                Become a Dealer — It&apos;s Free!
                            </DialogTitle>
                        </div>
                    </DialogHeader>
                </div>

                {/* Content */}
                <div className="bg-white dark:bg-gray-950 px-5 sm:px-8 py-6 space-y-4">
                    <p className="text-sm sm:text-[15px] font-medium leading-relaxed text-gray-600 dark:text-gray-300">
                        Claim your <span className="font-bold text-violet-600">Dealer</span> role today and unlock exclusive benefits for reselling data bundles at special dealer rates.
                    </p>

                    <div className="space-y-3">
                        <div className="flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-violet-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                                Access exclusive <strong>dealer pricing</strong> on all data bundles
                            </p>
                        </div>
                        <div className="flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-violet-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                                Your shop sells at <strong>dealer cost rates</strong> — maximise your margins
                            </p>
                        </div>
                        <div className="flex items-start gap-3">
                            <Clock className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                                <strong>First month is FREE.</strong> After that, subscribe for 6 months to keep your dealer benefits.
                            </p>
                        </div>
                        <div className="flex items-start gap-3">
                            <CreditCard className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                No payment required now — claim and explore for a full month at no cost.
                            </p>
                        </div>
                    </div>
                </div>

                <DialogFooter className="bg-gray-50/80 dark:bg-gray-900/40 p-4 sm:p-5 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row gap-3">
                    <Button
                        variant="outline"
                        className="w-full sm:w-auto font-semibold rounded-xl"
                        onClick={handleDismiss}
                        disabled={isClaiming}
                    >
                        Maybe Later
                    </Button>
                    <Button
                        className="w-full sm:flex-1 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-xl shadow-md transition-transform active:scale-95 h-11"
                        onClick={handleClaim}
                        disabled={isClaiming}
                    >
                        {isClaiming ? 'Claiming...' : 'Claim Now — It\'s Free!'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
