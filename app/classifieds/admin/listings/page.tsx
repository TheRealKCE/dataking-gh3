'use client'

import { useEffect, useState } from 'react'
import { ClassifiedsAdminSidebar } from '@/components/classifieds/admin-sidebar'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Loader2, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'
import type { ClassifiedListing } from '@/types/supabase'

export default function AdminListingsPage() {
    const { session } = useAuth()
    const [listings, setListings] = useState<ClassifiedListing[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [page, setPage] = useState(1)

    useEffect(() => {
        if (session?.access_token) {
            loadListings()
        }
    }, [session?.access_token, page])

    const loadListings = async () => {
        try {
            setIsLoading(true)
            const res = await fetch(`/api/classifieds/listings?page=${page}&limit=20&status=active`, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` },
            })

            if (res.ok) {
                const data = await res.json()
                setListings(data.listings || [])
            }
        } catch (error) {
            console.error('Error loading listings:', error)
            toast.error('Failed to load listings')
        } finally {
            setIsLoading(false)
        }
    }

    const handleArchive = async (listingId: string) => {
        if (!confirm('Remove this listing? It will be archived and hidden from the marketplace.')) return

        try {
            const res = await fetch(`/api/classifieds/listings/${listingId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({ status: 'archived' }),
            })

            if (res.ok) {
                toast.success('Listing archived')
                await loadListings()
            } else {
                const data = await res.json().catch(() => ({}))
                toast.error(data.error || 'Failed to archive listing')
            }
        } catch (error) {
            toast.error('Failed to archive listing')
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1c] flex">
            <ClassifiedsAdminSidebar />

            <div className="flex-1">
                <div className="bg-white dark:bg-[#151c2c] border-b border-gray-100 dark:border-gray-800">
                    <div className="max-w-6xl mx-auto px-6 py-8">
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">Listings</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">View and moderate all classified listings</p>
                    </div>
                </div>

                <div className="max-w-6xl mx-auto px-6 py-12">
                    {isLoading ? (
                        <div className="flex justify-center items-center py-12">
                            <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
                        </div>
                    ) : listings.length === 0 ? (
                        <div className="bg-white dark:bg-[#151c2c] rounded-xl border border-gray-100 dark:border-gray-800 p-12 text-center">
                            <p className="text-gray-600 dark:text-gray-400">No listings found</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {listings.map((listing) => (
                                <div key={listing.id} className="bg-white dark:bg-[#151c2c] rounded-xl border border-gray-100 dark:border-gray-800 p-6">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{listing.title}</h3>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{listing.description}</p>
                                            <div className="flex gap-4 mt-4 text-sm">
                                                <span className="text-gray-600 dark:text-gray-400">💰 GHS {listing.price}</span>
                                                <span className="text-gray-600 dark:text-gray-400">📍 {listing.location}</span>
                                                <span className="text-gray-600 dark:text-gray-400">👁️ {listing.view_count} views</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Link href={`/classifieds/${listing.id}`}>
                                                <Button size="sm" variant="outline">View</Button>
                                            </Link>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => handleArchive(listing.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
