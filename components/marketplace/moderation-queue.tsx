'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Pagination } from '@/components/ui/pagination'
import { toast } from 'sonner'
import { ModerationListingCard } from './moderation-listing-card'

interface Listing {
    id: string
    title: string
    description: string
    category_id: string
    price_pesewas: number
    seller_id: string
    moderation_status: string
    rejection_reason?: string
    created_at: string
    users?: {
        email: string
        phone_number: string
    }
}

interface PaginationData {
    page: number
    limit: number
    total: number
    pages: number
}

export function ModerationQueue() {
    const [status, setStatus] = useState('pending')
    const [listings, setListings] = useState<Listing[]>([])
    const [pagination, setPagination] = useState<PaginationData>({
        page: 1,
        limit: 20,
        total: 0,
        pages: 0,
    })
    const [loading, setLoading] = useState(true)

    // Fetch listings
    const fetchListings = async (pageNum = 1) => {
        setLoading(true)
        try {
            const response = await fetch(
                `/api/marketplace/moderation/queue?status=${status}&page=${pageNum}&limit=20`
            )
            const data = await response.json()

            if (!response.ok) throw new Error(data.error)

            setListings(data.listings || [])
            setPagination(data.pagination)
        } catch (error) {
            console.error('[ModerationQueue] Fetch error:', error)
            toast.error('Failed to load listings')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchListings()
    }, [status])

    const handleAction = async (listingId: string, action: string, reason?: string) => {
        try {
            const response = await fetch('/api/marketplace/moderation/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    listing_id: listingId,
                    action,
                    reason,
                }),
            })

            if (!response.ok) throw new Error('Failed to update listing')

            toast.success(`Listing ${action}`)
            fetchListings()
        } catch (error) {
            console.error('[ModerationQueue] Action error:', error)
            toast.error('Failed to process action')
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Moderation Queue</CardTitle>
                <CardDescription>
                    Review and approve/reject marketplace listings
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
                <Tabs value={status} onValueChange={setStatus}>
                    <TabsList>
                        <TabsTrigger value="pending">
                            Pending
                            <Badge variant="secondary" className="ml-2">
                                {pagination.total}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger value="approved">Approved</TabsTrigger>
                        <TabsTrigger value="rejected">Rejected</TabsTrigger>
                        <TabsTrigger value="flagged">Flagged</TabsTrigger>
                    </TabsList>

                    <TabsContent value={status} className="space-y-4 mt-4">
                        {loading ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Loading listings...
                            </div>
                        ) : listings.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                No {status} listings
                            </div>
                        ) : (
                            <>
                                <div className="space-y-4">
                                    {listings.map((listing) => (
                                        <ModerationListingCard
                                            key={listing.id}
                                            listing={listing}
                                            onApprove={() => handleAction(listing.id, 'approved')}
                                            onReject={(reason) =>
                                                handleAction(listing.id, 'rejected', reason)
                                            }
                                        />
                                    ))}
                                </div>

                                {pagination.pages > 1 && (
                                    <div className="flex justify-center gap-2 mt-6">
                                        <Button
                                            variant="outline"
                                            disabled={pagination.page === 1}
                                            onClick={() => fetchListings(pagination.page - 1)}
                                        >
                                            Previous
                                        </Button>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-muted-foreground">
                                                Page {pagination.page} of {pagination.pages}
                                            </span>
                                        </div>
                                        <Button
                                            variant="outline"
                                            disabled={pagination.page === pagination.pages}
                                            onClick={() => fetchListings(pagination.page + 1)}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    )
}
