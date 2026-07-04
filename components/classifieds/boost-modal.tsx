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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Zap, CreditCard, Smartphone } from 'lucide-react'
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
    const [fees, setFees] = useState<Record<string, number>>({})
    const [provider, setProvider] = useState<'moolre' | 'paystack'>('moolre')
    const [isLoadingFees, setIsLoadingFees] = useState(true)

    // Moolre-specific inputs
    const [phone, setPhone] = useState('')
    const [network, setNetwork] = useState('')

    // Payment state
    const [isLoading, setIsLoading] = useState(false)
    const [paymentReference, setPaymentReference] = useState<string | null>(null)
    const [isPolling, setIsPolling] = useState(false)

    // OTP modal
    const [otpRequired, setOtpRequired] = useState(false)
    const [otpCode, setOtpCode] = useState('')

    // Fetch admin fees and payment provider on open
    useEffect(() => {
        if (!open) return

        const fetchData = async () => {
            setIsLoadingFees(true)
            try {
                const feeKeys = TIERS.map(t => `classifieds_boost_fee_${t.id}`).join(',')
                const settingsRes = await fetch(
                    `/api/admin-settings?keys=${feeKeys},active_payment_provider_classifieds`
                )
                if (settingsRes.ok) {
                    const data = await settingsRes.json()
                    const parsedFees: Record<string, number> = {}
                    TIERS.forEach(tier => {
                        const key = `classifieds_boost_fee_${tier.id}`
                        parsedFees[tier.id] = parseFloat(data[key] || '0')
                    })
                    setFees(parsedFees)
                    const p = String(data['active_payment_provider_classifieds'] || 'moolre')
                    setProvider(p === 'paystack' ? 'paystack' : 'moolre')
                }
            } catch (error) {
                console.error('Error fetching boost settings:', error)
            } finally {
                setIsLoadingFees(false)
            }
        }

        fetchData()
    }, [open])

    // Poll for Moolre payment completion
    useEffect(() => {
        if (!isPolling || !paymentReference) return

        const token = localStorage.getItem('sb-token')
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/payments/verify?reference=${paymentReference}`, {
                    headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` },
                })
                const data = await res.json()
                if (data.status === 'completed') {
                    clearInterval(interval)
                    setIsPolling(false)
                    setIsLoading(false)
                    toast.success('🚀 Listing boosted successfully!')
                    onOpenChange(false)
                    onSuccess?.()
                } else if (data.status === 'failed') {
                    clearInterval(interval)
                    setIsPolling(false)
                    setIsLoading(false)
                    toast.error(data.message || 'Payment failed or was cancelled.')
                }
            } catch (e) {
                console.error('Polling error:', e)
            }
        }, 3000)

        return () => clearInterval(interval)
    }, [isPolling, paymentReference])

    const selectedFee = fees[selectedTier] || 0
    const selectedTierLabel = TIERS.find(t => t.id === selectedTier)?.label || ''

    const callInitialize = async (otpCodeParam?: string) => {
        const token = localStorage.getItem('sb-token')
        if (!token) {
            toast.error('Please log in')
            return null
        }
        const response = await fetch('/api/classifieds/boost/initialize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                listing_id: listingId,
                tier: selectedTier,
                phone: phone || undefined,
                network: network || undefined,
                otpCode: otpCodeParam || undefined,
                reference: paymentReference || undefined,
            }),
        })
        return response
    }

    const handleConfirm = async () => {
        if (provider === 'moolre' && (!phone || !network)) {
            toast.error('Please enter your Mobile Money number and select a network')
            return
        }

        setIsLoading(true)
        try {
            const response = await callInitialize()
            if (!response) return

            const data = await response.json()

            if (!response.ok) {
                toast.error(data.error || 'Failed to initiate payment')
                setIsLoading(false)
                return
            }

            if (data.gateway === 'paystack') {
                // Redirect to Paystack checkout
                window.location.href = data.authorization_url
                return
            }

            // Moolre: save reference for OTP or polling
            setPaymentReference(data.reference)

            if (data.otpRequired) {
                setIsLoading(false)
                setOtpRequired(true)
                return
            }

            // Start polling
            setIsPolling(true)
        } catch (error: any) {
            toast.error(error.message || 'Error initiating payment')
            setIsLoading(false)
        }
    }

    const handleVerifyOtp = async () => {
        if (!otpCode.trim()) {
            toast.error('Please enter the OTP sent to your phone')
            return
        }
        setIsLoading(true)
        try {
            const response = await callInitialize(otpCode.trim())
            if (!response) return

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Invalid OTP. Please try again.')
            }

            if (data.otpRequired) {
                throw new Error('OTP incorrect or expired. Please try again.')
            }

            setOtpRequired(false)
            setOtpCode('')
            toast.success(data.message || 'OTP verified! Please approve the prompt on your phone.')
            setIsPolling(true)
        } catch (error: any) {
            toast.error(error.message || 'Failed to verify OTP')
            setIsLoading(false)
        }
    }

    const handleClose = () => {
        if (isPolling) return // Don't close while waiting for approval
        setOtpRequired(false)
        setOtpCode('')
        setPaymentReference(null)
        setIsPolling(false)
        onOpenChange(false)
    }

    return (
        <>
            {/* Main Boost Modal */}
            <Dialog open={open && !otpRequired} onOpenChange={handleClose}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                <Zap className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <DialogTitle>Boost Your Listing</DialogTitle>
                                <DialogDescription>
                                    Choose a duration and pay directly — no wallet top-up needed
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="space-y-6 py-4">

                        {/* Provider badge */}
                        <div className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold w-fit',
                            provider === 'paystack'
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        )}>
                            {provider === 'paystack'
                                ? <CreditCard className="w-4 h-4" />
                                : <Smartphone className="w-4 h-4" />}
                            Pay via {provider === 'paystack' ? 'Paystack' : 'Moolre (Mobile Money)'}
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

                                    return (
                                        <button
                                            key={tier.id}
                                            onClick={() => setSelectedTier(tier.id)}
                                            disabled={isLoadingFees}
                                            className={cn(
                                                'p-3 rounded-xl border-2 transition-all text-center',
                                                isSelected
                                                    ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-500 text-emerald-900 dark:text-emerald-100'
                                                    : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300'
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

                        {/* Moolre MoMo inputs */}
                        {provider === 'moolre' && (
                            <div className="space-y-3">
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                                    Mobile Money Details
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <Label htmlFor="boost-network" className="text-xs">Network</Label>
                                        <Select value={network} onValueChange={setNetwork}>
                                            <SelectTrigger id="boost-network" className="mt-1 h-11">
                                                <SelectValue placeholder="Select Network" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="MTN">MTN MoMo</SelectItem>
                                                <SelectItem value="Telecel">Telecel Cash</SelectItem>
                                                <SelectItem value="AT">AT Money</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label htmlFor="boost-phone" className="text-xs">Mobile Number</Label>
                                        <Input
                                            id="boost-phone"
                                            type="tel"
                                            placeholder="e.g. 0540000000"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            className="mt-1 h-11"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Payment summary */}
                        {selectedFee > 0 && (
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 border border-emerald-200 dark:border-emerald-800">
                                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                                    Boost Summary
                                </p>
                                <div className="mt-2 space-y-1 text-sm text-emerald-900 dark:text-emerald-100">
                                    <p><span className="font-bold">Duration:</span> {selectedTierLabel}</p>
                                    <p><span className="font-bold">Amount:</span> GHS {selectedFee.toFixed(2)}</p>
                                </div>
                            </div>
                        )}

                        {/* Polling status */}
                        {isPolling && (
                            <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                                <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
                                <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                                    Waiting for payment approval on your phone…
                                </p>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={handleClose} disabled={isPolling}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={isLoading || isLoadingFees || selectedFee === 0 || isPolling}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {isLoading
                                ? 'Processing…'
                                : provider === 'paystack'
                                    ? <><CreditCard className="w-4 h-4 mr-2" /> Pay GHS {selectedFee.toFixed(2)} with Paystack</>
                                    : <><Smartphone className="w-4 h-4 mr-2" /> Send Prompt — GHS {selectedFee.toFixed(2)}</>
                            }
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* OTP Modal */}
            <Dialog open={otpRequired} onOpenChange={(open) => !open && setOtpRequired(false)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>OTP Verification</DialogTitle>
                        <DialogDescription>
                            Enter the code sent to your phone to complete the boost payment.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="boost-otp">Enter OTP</Label>
                            <Input
                                id="boost-otp"
                                type="text"
                                placeholder="Enter code"
                                value={otpCode}
                                onChange={(e) => setOtpCode(e.target.value)}
                                className="h-12 text-center text-2xl tracking-widest font-bold"
                            />
                        </div>
                    </div>
                    <DialogFooter className="sm:justify-end">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => { setOtpRequired(false); setOtpCode('') }}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleVerifyOtp}
                            disabled={isLoading || !otpCode}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Continue'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
