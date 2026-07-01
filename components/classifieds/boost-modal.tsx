'use client'

import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface BoostModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    listingId: string
    onSuccess?: () => void
}

const TIERS = [
    { id: '7d', days: 7, label: '1 Week' },
    { id: '14d', days: 14, label: '2 Weeks' },
    { id: '21d', days: 21, label: '3 Weeks' },
    { id: '30d', days: 30, label: '1 Month' },
    { id: '60d', days: 60, label: '2 Months' },
    { id: '90d', days: 90, label: '3 Months' },
]

export function BoostModal({ open, onOpenChange, listingId, onSuccess }: BoostModalProps) {
    const [selectedTier, setSelectedTier] = useState<string>('7d')
    const [walletBalance, setWalletBalance] = useState<number>(0)
    const [fees, setFees] = useState<Record<string, number>>({})
    const [isLoading, setIsLoading] = useState(false)
    const [isLoadingFees, setIsLoadingFees] = useState(true)

    // Fetch admin fees and wallet balance
    useEffect(() => {
        if (!open) return

        const fetchData = async () => {
            setIsLoadingFees(true)
            try {
                // Fetch fees from admin settings
                const feeKeys = TIERS.map(t => `classifieds_boost_fee_${t.id}`).join(',')
                const feesRes = await fetch(`/api/admin-settings?keys=${feeKeys}`)
                if (feesRes.ok) {
                    const feesData = await feesRes.json()
                    const parsedFees: Record<string, number> = {}
                    TIERS.forEach(tier => {
                        const key = `classifieds_boost_fee_${tier.id}`
                        parsedFees[tier.id] = parseFloat(feesData[key] || '0')
                    })
                    setFees(parsedFees)
                }

                // Fetch wallet balance
                const token = localStorage.getItem('sb-token')
                if (token) {
                    const walletRes = await fetch('/api/wallet/balance', {
                        headers: { 'Authorization': `Bearer ${token}` },
                    })
                    if (walletRes.ok) {
                        const walletData = await walletRes.json()
                        setWalletBalance(walletData.balance || 0)
                    }
                }
            } catch (error) {
                console.error('Error fetching data:', error)
            } finally {
                setIsLoadingFees(false)
            }
        }

        fetchData()
    }, [open])

    const selectedFee = fees[selectedTier] || 0
    const canAfford = walletBalance >= selectedFee
    const selectedTierLabel = TIERS.find(t => t.id === selectedTier)?.label || ''

    const handleConfirm = async () => {
        if (!canAfford) {
            toast.error('Insufficient wallet balance')
            return
        }

        setIsLoading(true)
        try {
            const token = localStorage.getItem('sb-token')
            if (!token) {
                toast.error('Please log in')
                return
            }

            const response = await fetch('/api/classifieds/boost', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    listing_id: listingId,
                    tier: selectedTier,
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                toast.error(data.error || 'Failed to boost listing')
                return
            }

            toast.success(data.message || `Listing boosted for ${selectedTierLabel}!`)
            onOpenChange(false)
            onSuccess?.()
        } catch (error: any) {
            toast.error(error.message || 'Error boosting listing')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <Zap className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <DialogTitle>Boost Your Listing</DialogTitle>
                            <DialogDescription>
                                Choose how long you want your listing to be promoted
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Wallet balance */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                        <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                            Wallet Balance
                        </p>
                        <p className="text-2xl font-black text-blue-900 dark:text-blue-100 mt-1">
                            GHS {walletBalance.toFixed(2)}
                        </p>
                    </div>

                    {/* Tier selection grid */}
                    <div>
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">
                            Select Duration
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {TIERS.map(tier => {
                                const price = fees[tier.id] || 0
                                const isSelected = selectedTier === tier.id
                                const isAffordable = walletBalance >= price

                                return (
                                    <button
                                        key={tier.id}
                                        onClick={() => setSelectedTier(tier.id)}
                                        disabled={!isAffordable || isLoadingFees}
                                        className={cn(
                                            'p-3 rounded-xl border-2 transition-all text-center',
                                            isSelected
                                                ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-500 text-emerald-900 dark:text-emerald-100'
                                                : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300',
                                            !isAffordable && !isSelected && 'opacity-50 cursor-not-allowed'
                                        )}
                                    >
                                        <p className="font-bold text-sm">{tier.label}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            {tier.days} {tier.days === 1 ? 'day' : 'days'}
                                        </p>
                                        <p className="font-bold text-lg mt-1">
                                            GHS {isLoadingFees ? '...' : price.toFixed(2)}
                                        </p>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Insufficient balance warning */}
                    {!canAfford && selectedFee > 0 && (
                        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-200 dark:border-red-800 flex gap-2">
                            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-red-700 dark:text-red-300">
                                <p className="font-bold">Insufficient balance</p>
                                <p className="text-xs mt-1">
                                    You need GHS {(selectedFee - walletBalance).toFixed(2)} more to boost for {selectedTierLabel}
                                </p>
                                <a
                                    href="/dashboard/wallet"
                                    target="_blank"
                                    className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline mt-2 inline-block"
                                >
                                    Top up your wallet →
                                </a>
                            </div>
                        </div>
                    )}

                    {/* Summary */}
                    {selectedFee > 0 && canAfford && (
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 border border-emerald-200 dark:border-emerald-800">
                            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                                Boost Details
                            </p>
                            <div className="mt-2 space-y-1 text-sm text-emerald-900 dark:text-emerald-100">
                                <p>
                                    <span className="font-bold">Duration:</span> {selectedTierLabel}
                                </p>
                                <p>
                                    <span className="font-bold">Cost:</span> GHS {selectedFee.toFixed(2)}
                                </p>
                                <p>
                                    <span className="font-bold">Balance after:</span> GHS {(walletBalance - selectedFee).toFixed(2)}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!canAfford || isLoading || isLoadingFees || selectedFee === 0}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {isLoading ? 'Boosting...' : `Confirm & Pay GHS ${selectedFee.toFixed(2)}`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
