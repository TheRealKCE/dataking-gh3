'use client'

import { useState, useEffect } from 'react'
import { ClassifiedsAdminSidebar } from '@/components/classifieds/admin-sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'

interface VerificationRequest {
    id: string
    seller_id: string
    status: 'pending' | 'approved' | 'rejected'
    note: string | null
    rejection_reason: string | null
    requested_at: string
    reviewed_at: string | null
    users: {
        id: string
        first_name: string
        last_name: string
        email: string
        phone_number: string
    } | null
}

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    pending: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300', icon: <Clock className="w-4 h-4" /> },
    approved: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300', icon: <CheckCircle className="w-4 h-4" /> },
    rejected: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300', icon: <AlertCircle className="w-4 h-4" /> },
}

export default function AdminSellersPage() {
    const { session } = useAuth()
    const [requests, setRequests] = useState<VerificationRequest[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending')
    const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({})
    const [expandedRequest, setExpandedRequest] = useState<string | null>(null)

    useEffect(() => {
        if (session?.access_token) {
            loadRequests()
        }
    }, [activeTab, session?.access_token])

    const loadRequests = async () => {
        try {
            setIsLoading(true)
            if (!session?.access_token) {
                setIsLoading(false)
                return
            }

            const url = new URL('/api/classifieds/admin/seller-verifications', window.location.origin)
            if (activeTab === 'pending') {
                url.searchParams.set('status', 'pending')
            }

            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${session.access_token}` },
            })

            if (!res.ok) {
                throw new Error('Failed to load verification requests')
            }

            const data = await res.json()
            setRequests(data.requests || [])
        } catch (error: any) {
            console.error('Error loading requests:', error)
            toast.error(error.message || 'Failed to load requests')
        } finally {
            setIsLoading(false)
        }
    }

    const handleReview = async (requestId: string, decision: 'approved' | 'rejected') => {
        try {
            if (!session?.access_token) {
                toast.error('Not authenticated')
                return
            }

            const body: any = { decision }
            if (decision === 'rejected') {
                const reason = rejectionReason[requestId] || ''
                if (!reason.trim()) {
                    toast.error('Please provide a rejection reason')
                    return
                }
                body.rejection_reason = reason
            }

            const res = await fetch(`/api/classifieds/admin/seller-verifications/${requestId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify(body),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Failed to review request')
            }

            toast.success(data.message || 'Request reviewed successfully')
            setRejectionReason((prev) => ({ ...prev, [requestId]: '' }))
            setExpandedRequest(null)
            await loadRequests()
        } catch (error: any) {
            console.error('Error reviewing request:', error)
            toast.error(error.message || 'Failed to review request')
        }
    }

    const displayRequests = requests

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1c] flex">
                <ClassifiedsAdminSidebar />
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1c] flex">
            <ClassifiedsAdminSidebar />

            <div className="flex-1">
                <div className="bg-white dark:bg-[#151c2c] border-b border-gray-100 dark:border-gray-800">
                    <div className="max-w-6xl mx-auto px-6 py-8">
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">Seller Verification</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">Review and approve seller verification requests</p>
                    </div>
                </div>

                <div className="max-w-6xl mx-auto px-6 py-8">
                    {/* Tabs */}
                    <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-800">
                        <button
                            onClick={() => setActiveTab('pending')}
                            className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${
                                activeTab === 'pending'
                                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            Pending ({requests.filter(r => r.status === 'pending').length})
                        </button>
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${
                                activeTab === 'all'
                                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            All ({requests.length})
                        </button>
                    </div>

                    {/* Requests List */}
                    {displayRequests.length === 0 ? (
                        <div className="bg-white dark:bg-[#151c2c] rounded-lg border border-gray-100 dark:border-gray-800 p-8 text-center">
                            <p className="text-gray-600 dark:text-gray-400">No verification requests found.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {displayRequests.map((req) => {
                                const statusConfig = STATUS_COLORS[req.status]
                                const isExpanded = expandedRequest === req.id
                                return (
                                    <div
                                        key={req.id}
                                        className="bg-white dark:bg-[#151c2c] rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden"
                                    >
                                        <div className="p-4">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                                            {req.users?.first_name} {req.users?.last_name}
                                                        </h3>
                                                        <span
                                                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${statusConfig.bg} ${statusConfig.text}`}
                                                        >
                                                            {statusConfig.icon}
                                                            {req.status}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400">{req.users?.email}</p>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400">{req.users?.phone_number}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                                                        Requested: {new Date(req.requested_at).toLocaleDateString()} at {new Date(req.requested_at).toLocaleTimeString()}
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setExpandedRequest(isExpanded ? null : req.id)}
                                                >
                                                    {isExpanded ? 'Hide' : 'View'}
                                                </Button>
                                            </div>

                                            {/* Expanded Details */}
                                            {isExpanded && (
                                                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                                                    {req.note && (
                                                        <div>
                                                            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Seller Note:</p>
                                                            <p className="text-sm text-gray-900 dark:text-white">{req.note}</p>
                                                        </div>
                                                    )}

                                                    {req.rejection_reason && (
                                                        <div>
                                                            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Rejection Reason:</p>
                                                            <p className="text-sm text-red-600 dark:text-red-400">{req.rejection_reason}</p>
                                                        </div>
                                                    )}

                                                    {/* Action Buttons */}
                                                    {req.status === 'pending' && (
                                                        <div className="space-y-3">
                                                            <Button
                                                                onClick={() => handleReview(req.id, 'approved')}
                                                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                                                            >
                                                                Approve
                                                            </Button>

                                                            <div>
                                                                <Input
                                                                    placeholder="Rejection reason (required for rejection)..."
                                                                    value={rejectionReason[req.id] || ''}
                                                                    onChange={(e) =>
                                                                        setRejectionReason((prev) => ({
                                                                            ...prev,
                                                                            [req.id]: e.target.value,
                                                                        }))
                                                                    }
                                                                    className="mb-2"
                                                                />
                                                                <Button
                                                                    onClick={() => handleReview(req.id, 'rejected')}
                                                                    variant="destructive"
                                                                    className="w-full"
                                                                >
                                                                    Reject
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
