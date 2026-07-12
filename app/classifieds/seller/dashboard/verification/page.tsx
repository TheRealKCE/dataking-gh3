'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { ClassifiedsSellerSidebar } from '@/components/classifieds/seller-sidebar'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'

const WhatsAppIcon = () => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="text-white">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.88 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
)

interface VerificationStatus {
    verification: any | null
    verified_at: string | null
    is_verified: boolean
}

export default function SellerVerificationPage() {
    const router = useRouter()
    const { user, dbUser, session } = useAuth()
    const [status, setStatus] = useState<VerificationStatus | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [note, setNote] = useState('')
    const [adminPhone, setAdminPhone] = useState('')
    const [showWhatsApp, setShowWhatsApp] = useState(false)

    // Admin WhatsApp number used to nudge sellers to follow up on approval.
    useEffect(() => {
        fetch('/api/public/config')
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => setAdminPhone(data?.whatsappAdminNumber || ''))
            .catch(() => setAdminPhone(''))
    }, [])

    const sellerName = [dbUser?.first_name, dbUser?.last_name].filter(Boolean).join(' ')
    const buildWhatsAppUrl = () => {
        if (!adminPhone) return ''
        const cleaned = adminPhone.replace(/\D/g, '')
        const message = encodeURIComponent(
            `Hi ARHMS Admin 👋\n\nI've submitted a seller verification request on Arhms Marketplace and would like to follow up for approval.\n\nName: ${sellerName || 'N/A'}\nEmail: ${dbUser?.email || user?.email || 'N/A'}`
        )
        return `https://wa.me/${cleaned}?text=${message}`
    }

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

                const data = await res.json().catch(() => null)

                if (!res.ok) {
                    throw new Error(data?.error || 'Failed to load verification status')
                }

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
            setShowWhatsApp(true)
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
                <div className="flex-1 min-w-0 pb-20 lg:pb-0 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1c] flex">
            <ClassifiedsSellerSidebar />

            <div className="flex-1 min-w-0 pb-20 lg:pb-0">
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

            {/* Post-submit nudge: request is recorded, ask the seller to follow up with admin for approval */}
            <Dialog open={showWhatsApp} onOpenChange={setShowWhatsApp}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Request Received — One More Step</DialogTitle>
                        <DialogDescription>
                            Your verification request has been submitted. To speed up approval, message our admin team on WhatsApp.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 mt-2">
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                            <p className="text-sm text-blue-900 dark:text-blue-100">
                                Our team will review your details and approve your verification. Tap below to contact the admin directly.
                            </p>
                        </div>

                        {adminPhone ? (
                            <a href={buildWhatsAppUrl()} target="_blank" rel="noopener noreferrer" className="block">
                                <Button className="w-full bg-gradient-to-r from-[#25D366] to-[#128C7E] hover:from-[#20ba58] hover:to-[#0fb885] text-white py-3 font-bold">
                                    <WhatsAppIcon />
                                    <span className="ml-2">Contact Admin on WhatsApp</span>
                                </Button>
                            </a>
                        ) : (
                            <Button className="w-full" disabled>
                                Contact info unavailable
                            </Button>
                        )}

                        <Button
                            variant="ghost"
                            className="w-full"
                            onClick={() => setShowWhatsApp(false)}
                        >
                            I'll do this later
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
