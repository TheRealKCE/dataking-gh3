'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { ClassifiedsSellerSidebar } from '@/components/classifieds/seller-sidebar'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'

interface VerificationStatus {
    verification: any | null
    verified_at: string | null
    is_verified: boolean
}

export default function SellerVerificationPage() {
    const router = useRouter()
    const { user, session } = useAuth()
    const [status, setStatus] = useState<VerificationStatus | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [note, setNote] = useState('')

    useEffect(() => {
        if (!user) {
            toast.error('Please log in to access seller verification')
            router.push('/auth/login')
        }
    }, [user, router])

    useEffect(() => {
        const loadStatus = async () => {
            try {
                setIsLoading(true)
                if (!session?.access_token) {
                    return
                }

                const res = await fetch('/api/classifieds/seller-verification', {
                    headers: { 'Authorization': `Bearer ${session.access_token}` },
                })

                if (!res.ok) {
                    throw new Error('Failed to load verification status')
                }

                const data = await res.json()
                setStatus(data)
            } catch (error: any) {
                console.error('Error loading verification status:', error)
                toast.error(error.message || 'Failed to load verification status')
            } finally {
                setIsLoading(false)
            }
        }

        loadStatus()
    }, [session?.access_token])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)

        try {
            if (!session?.access_token) {
                toast.error('Please log in')
                return
            }

            const res = await fetch('/api/classifieds/seller-verification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ note: note || undefined }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Failed to submit verification request')
            }

            setStatus(data.verification)
            setNote('')
            toast.success(data.message || 'Verification request submitted successfully!')
        } catch (error: any) {
            console.error('Error submitting verification:', error)
            toast.error(error.message || 'Failed to submit verification request')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1c] flex">
                <ClassifiedsSellerSidebar />
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1c] flex">
            <ClassifiedsSellerSidebar />

            <div className="flex-1">
                <div className="bg-white dark:bg-[#151c2c] border-b border-gray-100 dark:border-gray-800">
                    <div className="max-w-4xl mx-auto px-6 py-8">
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">Get Verified</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">
                            Build trust with buyers by getting verified as a seller
                        </p>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto px-6 py-12">
                    {/* Verification Status */}
                    {status?.is_verified && (
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6 mb-8">
                            <div className="flex items-start gap-4">
                                <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-1" />
                                <div>
                                    <h2 className="text-lg font-bold text-emerald-900 dark:text-emerald-100 mb-1">
                                        You're Verified!
                                    </h2>
                                    <p className="text-sm text-emerald-800 dark:text-emerald-200">
                                        Your seller profile is verified. A checkmark badge will appear on all your listings.
                                    </p>
                                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-2">
                                        Verified on {new Date(status.verified_at!).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {status?.verification?.status === 'pending' && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 mb-8">
                            <div className="flex items-start gap-4">
                                <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
                                <div>
                                    <h2 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-1">
                                        Request Pending
                                    </h2>
                                    <p className="text-sm text-blue-800 dark:text-blue-200">
                                        Your verification request is being reviewed by our admin team. We'll notify you once it's approved.
                                    </p>
                                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                                        Requested on {new Date(status.verification.requested_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {status?.verification?.status === 'rejected' && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 mb-8">
                            <div className="flex items-start gap-4">
                                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-1" />
                                <div className="flex-1">
                                    <h2 className="text-lg font-bold text-red-900 dark:text-red-100 mb-1">
                                        Request Not Approved
                                    </h2>
                                    <p className="text-sm text-red-800 dark:text-red-200">
                                        Your verification request was not approved.
                                    </p>
                                    {status.verification.rejection_reason && (
                                        <p className="text-sm text-red-800 dark:text-red-200 mt-2">
                                            <span className="font-semibold">Reason:</span> {status.verification.rejection_reason}
                                        </p>
                                    )}
                                    <p className="text-xs text-red-700 dark:text-red-300 mt-3">
                                        You can submit a new request below.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Request Form (only show if not already verified) */}
                    {!status?.is_verified && status?.verification?.status !== 'pending' && (
                        <div className="bg-white dark:bg-[#151c2c] rounded-xl border border-gray-100 dark:border-gray-800 p-8">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                Request Verification
                            </h2>
                            <p className="text-gray-600 dark:text-gray-400 mb-6">
                                Help buyers trust you by getting verified. We'll review your profile and approve your request within 24 hours.
                            </p>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                        Additional Information (Optional)
                                    </label>
                                    <textarea
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        placeholder="E.g., business name, years of experience, what you primarily sell..."
                                        maxLength={500}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1a2332] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                                        rows={5}
                                    />
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {note.length}/500 characters
                                    </p>
                                </div>

                                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                    <p className="text-sm text-blue-900 dark:text-blue-100">
                                        <span className="font-semibold">ℹ️ What we review:</span> Your profile name, contact information, phone verification, and listing history. Documents are not required.
                                    </p>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 font-bold rounded-lg"
                                >
                                    {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    {isSubmitting ? 'Submitting...' : 'Submit Verification Request'}
                                </Button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
