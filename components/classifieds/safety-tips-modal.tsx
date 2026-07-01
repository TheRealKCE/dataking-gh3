'use client'

import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

interface SafetyTipsModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onAcknowledge: () => void
    isLoading?: boolean
}

export function SafetyTipsModal({ open, onOpenChange, onAcknowledge, isLoading }: SafetyTipsModalProps) {
    const [acknowledged, setAcknowledged] = useState(false)

    const handleAcknowledge = () => {
        if (acknowledged) {
            onAcknowledge()
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <DialogTitle>Safety Tips Before Contacting</DialogTitle>
                            <DialogDescription>
                                Please read and acknowledge these important safety guidelines
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-4 py-4 max-h-96 overflow-y-auto">
                    <div className="space-y-3">
                        <div className="flex gap-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-sm text-gray-900 dark:text-white">
                                    Meet the seller in person before paying
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                    Don't send money to someone you haven't met or verified.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-sm text-gray-900 dark:text-white">
                                    Pay on delivery / after inspection
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                    Only hand over cash or mobile money once you have the item in hand and have checked it works as described.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-sm text-gray-900 dark:text-white">
                                    Inspect the item carefully
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                    Check condition, functionality, and that it matches the listing photos/description before paying.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-sm text-gray-900 dark:text-white">
                                    Meet in a safe, public location
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                    Whenever possible, don't meet at an isolated address.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-sm text-gray-900 dark:text-white">
                                    Don't pay for delivery in advance
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                    Unless using a trusted, verified courier service.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-sm text-gray-900 dark:text-white">
                                    Report suspicious listings
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                    Use the "Report" button if something looks off or the seller seems untrustworthy.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={acknowledged}
                            onChange={(e) => setAcknowledged(e.target.checked)}
                            className="rounded border-gray-300 dark:border-gray-600"
                        />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                            I understand and will follow these safety guidelines
                        </span>
                    </label>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAcknowledge}
                            disabled={!acknowledged || isLoading}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            {isLoading ? 'Loading...' : 'Reveal Contact Info'}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    )
}
