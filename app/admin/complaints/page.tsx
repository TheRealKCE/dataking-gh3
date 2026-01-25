'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { CheckCircle2, XCircle, Clock, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Complaint } from '@/types/supabase'

export default function AdminComplaintsPage() {
    const [complaints, setComplaints] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedComplaint, setSelectedComplaint] = useState<any>(null)
    const [resolutionNotes, setResolutionNotes] = useState('')
    const [isResolving, setIsResolving] = useState(false)

    useEffect(() => {
        fetchComplaints()
    }, [])

    const fetchComplaints = async () => {
        try {
            const { data, error } = await supabase
                .from('complaints')
                .select(`
          *,
          users (first_name, last_name, email),
          orders (reference_code)
        `)
                .order('created_at', { ascending: false })

            if (error) throw error
            setComplaints(data || [])
        } catch (error) {
            console.error('Error fetching complaints:', error)
            toast.error('Failed to load complaints')
        } finally {
            setLoading(false)
        }
    }

    const handleResolve = async (status: 'resolved' | 'rejected') => {
        if (!selectedComplaint) return

        setIsResolving(true)
        try {
            const { error } = await (supabase
                .from('complaints') as any)
                .update({
                    status,
                    resolution_notes: resolutionNotes,
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedComplaint.id)

            if (error) {
                console.error('Database update error:', error)
                throw error
            }

            setComplaints(complaints.map(c =>
                c.id === selectedComplaint.id
                    ? { ...c, status, resolution_notes: resolutionNotes, updated_at: new Date().toISOString() }
                    : c
            ))

            // Notify user
            await (supabase.from('notifications') as any).insert({
                user_id: selectedComplaint.user_id,
                title: `Complaint ${status === 'resolved' ? 'Resolved' : 'Rejected'}`,
                message: `Your complaint regarding order ${selectedComplaint.orders?.reference_code} has been ${status}.`,
                type: 'complaint_resolved',
                action_url: '/dashboard/complaints'
            })

            toast.success(`Complaint marked as ${status}`)
            setSelectedComplaint(null)
            setResolutionNotes('')
        } catch (error: any) {
            console.error('Failed to update complaint:', error)
            toast.error(error?.message || 'Failed to update complaint')
        } finally {
            setIsResolving(false)
        }
    }

    const getStatusBadge = (status: string) => {
        const variants: Record<string, 'pending' | 'processing' | 'completed' | 'failed'> = {
            pending: 'pending',
            in_review: 'processing',
            resolved: 'completed',
            rejected: 'failed',
        }
        return <Badge variant={variants[status]}>{status.replace('_', ' ')}</Badge>
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Complaints Management</h1>
                    <p className="text-muted-foreground">Handle user complaints and issues</p>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Order Ref</TableHead>
                                <TableHead>Issue</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {complaints.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        No complaints found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                complaints.map((complaint) => (
                                    <TableRow key={complaint.id}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{complaint.users?.first_name} {complaint.users?.last_name}</span>
                                                <span className="text-xs text-muted-foreground">{complaint.users?.email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-sm">
                                            {complaint.orders?.reference_code}
                                        </TableCell>
                                        <TableCell className="max-w-xs truncate">{complaint.title}</TableCell>
                                        <TableCell>{getStatusBadge(complaint.status)}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {formatDate(complaint.created_at)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm" onClick={() => setSelectedComplaint(complaint)}>
                                                View Details
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Detail/Resolution Dialog */}
            <Dialog open={!!selectedComplaint} onOpenChange={() => setSelectedComplaint(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Complaint Details</DialogTitle>
                        <DialogDescription>
                            Order: {selectedComplaint?.orders?.reference_code}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="p-3 bg-muted rounded-lg">
                            <h4 className="font-semibold text-sm mb-1">{selectedComplaint?.title}</h4>
                            <p className="text-sm text-muted-foreground">{selectedComplaint?.description}</p>
                        </div>

                        {selectedComplaint?.status === 'pending' || selectedComplaint?.status === 'in_review' ? (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Resolution Notes</label>
                                <Textarea
                                    placeholder="Explain the resolution or rejection reason..."
                                    value={resolutionNotes}
                                    onChange={(e) => setResolutionNotes(e.target.value)}
                                    rows={4}
                                />
                            </div>
                        ) : (
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <h4 className="font-semibold text-sm mb-1">Resolution</h4>
                                <p className="text-sm">{selectedComplaint?.resolution_notes}</p>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        {(selectedComplaint?.status === 'pending' || selectedComplaint?.status === 'in_review') ? (
                            <>
                                <Button variant="outline" onClick={() => handleResolve('rejected')} disabled={isResolving}>
                                    {isResolving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                    Reject
                                </Button>
                                <Button onClick={() => handleResolve('resolved')} disabled={isResolving}>
                                    {isResolving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                    Mark Resolved
                                </Button>
                            </>
                        ) : (
                            <Button variant="outline" onClick={() => setSelectedComplaint(null)}>
                                Close
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
