'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/auth-context'
import { Loader2, CheckCircle, ShoppingBag, TrendingUp, Award, Phone } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { validateGhanaianPhone } from '@/lib/phone-validation'

export default function BecomeSellerPage() {
    const router = useRouter()
    const { user, session, refreshUser } = useAuth()
    const [isLoading, setIsLoading] = useState(false)
    const [phoneNumber, setPhoneNumber] = useState('')
    const [phoneError, setPhoneError] = useState('')

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0f1c]">
                <div className="text-center">
                    <p className="text-gray-600 dark:text-gray-400 mb-4">Please log in to continue</p>
                    <Link href="/auth/login">
                        <Button>Login</Button>
                    </Link>
                </div>
            </div>
        )
    }

    const handleBecomeSeller = async () => {
        setPhoneError('')

        // Validate phone number
        if (!phoneNumber.trim()) {
            setPhoneError('Phone number is required')
            return
        }

        const phoneValidation = validateGhanaianPhone(phoneNumber)
        if (!phoneValidation.isValid) {
            setPhoneError(phoneValidation.error || 'Invalid phone number')
            return
        }

        if (!session?.access_token) {
            toast.error('Session expired. Please log in again.')
            router.push('/auth/login')
            return
        }

        setIsLoading(true)
        try {
            const response = await fetch('/api/classifieds/seller/enable', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ phone_number: phoneNumber.trim() }),
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || 'Failed to enable seller status')
            }

            // Refresh auth context to update seller status
            await refreshUser()

            // Small delay to ensure database update is visible
            await new Promise(resolve => setTimeout(resolve, 500))

            toast.success('Welcome to ARHMS MARKETPLACE! You are now a seller. A welcome message has been sent to your phone.')
            router.push('/classifieds/seller/dashboard')
        } catch (error: any) {
            console.error('Error:', error)
            toast.error(error.message || 'Failed to become a seller')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-[#0a0f1c] dark:to-[#151c2c]">
            <div className="max-w-2xl mx-auto px-6 py-16">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-4">
                        Start Selling Today
                    </h1>
                    <p className="text-xl text-gray-600 dark:text-gray-400">
                        Join thousands of sellers and reach buyers across Ghana
                    </p>
                </div>

                <div className="grid gap-8 mb-12">
                    <div className="bg-white dark:bg-[#151c2c] rounded-xl p-6 border border-gray-100 dark:border-gray-800">
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                                <ShoppingBag className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white mb-2">
                                    Easy Listing Creation
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Post items in minutes with our simple and intuitive listing form
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-[#151c2c] rounded-xl p-6 border border-gray-100 dark:border-gray-800">
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                                <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white mb-2">
                                    Boost Your Sales
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Promote your items with our boosting feature to reach more buyers
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-[#151c2c] rounded-xl p-6 border border-gray-100 dark:border-gray-800">
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                                <Award className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white mb-2">
                                    Build Your Reputation
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Get verified and build trust with buyers in the community
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#151c2c] rounded-xl p-8 border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Ready to get started?
                        </h2>
                        <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 font-semibold text-sm">
                            Already a seller? Log In →
                        </Link>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        {user.email}
                    </p>

                    <div className="mb-6">
                        <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">
                            Phone Number <span className="text-red-600">*</span>
                        </label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <Input
                                type="tel"
                                placeholder="0241234567"
                                value={phoneNumber}
                                onChange={(e) => {
                                    setPhoneNumber(e.target.value)
                                    setPhoneError('')
                                }}
                                className="pl-10"
                            />
                        </div>
                        {phoneError && (
                            <p className="text-sm text-red-600 dark:text-red-400 mt-2">{phoneError}</p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            A welcome message will be sent to this number
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={handleBecomeSeller}
                        disabled={isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 px-8 rounded-lg flex items-center justify-center gap-2 mx-auto"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Activating...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-5 h-5" />
                                Become a Seller
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
