'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ListingCardProps {
    listing: {
        id: string
        title: string
        description: string
        price_pesewas: number
        seller_id: string
        created_at: string
        users?: {
            email: string
            phone_number: string
        }
    }
    onApprove: () => void
    onReject: (reason: string) => void
}

export function ModerationListingCard({ listing, onApprove, onReject }: ListingCardProps) {
    const [rejectMode, setRejectMode] = useState(false)
    const [rejectionReason, setRejectionReason] = useState('')
    const [loading, setLoading] = useState(false)

    const priceGhs = (listing.price_pesewas / 100).toFixed(2)

    const handleApprove = async () => {
        setLoading(true)
        onApprove()
        setLoading(false)
    }

    const handleReject = async () => {
        if (!rejectionReason.trim()) {
            alert('Please provide a rejection reason')
            return
        }
        setLoading(true)
        onReject(rejectionReason)
        setLoading(false)
        setRejectMode(false)
        setRejectionReason('')
    }

    return (
        <Card>
            <CardContent className="pt-6 space-y-4">
                {/* Header */}
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                        <h3 className="font-semibold text-lg">{listing.title}</h3>
                        <p className="text-sm text-muted-foreground">
                            GHS {priceGhs}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline">ID: {listing.id.slice(0, 8)}</Badge>
                        <Badge>
                            {new Date(listing.created_at).toLocaleDateString()}
                        </Badge>
                    </div>
                </div>

                {/* Description */}
                <div className="bg-muted p-3 rounded-lg">
                    <p className="text-sm line-clamp-4">{listing.description}</p>
                </div>

                {/* Seller Info */}
                <div className="border-t pt-3">
                    <p className="text-sm font-medium mb-2">Seller Information</p>
                    <div className="text-sm text-muted-foreground space-y-1">
                        <p>
                            <strong>Email:</strong> {listing.users?.email || 'N/A'}
                        </p>
                        <p>
                            <strong>Phone:</strong> {listing.users?.phone_number || 'N/A'}
                        </p>
                    </div>
                </div>

                {/* Rejection Mode */}
                {rejectMode && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="ml-3">
                            <div className="space-y-3">
                                <Textarea
                                    placeholder="Provide rejection reason for seller feedback..."
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    rows={3}
                                />
                            </div>
                        </AlertDescription>
                    </Alert>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-3">
                    {rejectMode ? (
                        <>
                            <Button
                                variant="destructive"
                                onClick={handleReject}
                                disabled={loading}
                            >
                                <XCircle className="w-4 h-4 mr-2" />
                                Confirm Rejection
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setRejectMode(false)
                                    setRejectionReason('')
                                }}
                                disabled={loading}
                            >
                                Cancel
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                variant="default"
                                onClick={handleApprove}
                                disabled={loading}
                            >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Approve
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={() => setRejectMode(true)}
                                disabled={loading}
                            >
                                <XCircle className="w-4 h-4 mr-2" />
                                Reject
                            </Button>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
