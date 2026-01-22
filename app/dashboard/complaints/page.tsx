'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { MessageSquare, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { Complaint } from '@/types/supabase'

export default function ComplaintsPage() {
    const { dbUser } = useAuth()
    const [complaints, setComplaints] = useState<Complaint[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [stats, setStats] = useState({
        total: 0,
        pending: 0,
        resolved: 0,
        rejected: 0,
    })

    useEffect(() => {
        if (dbUser) {
            fetchComplaints()
        }
    }, [dbUser])

    const fetchComplaints = async () => {
        try {
            const { data, error } = await supabase
                .from('complaints')
                .select('*')
                .eq('user_id', dbUser?.id as any)
                .order('created_at', { ascending: false })

            if (error) throw error
            setComplaints(data || [])

            setStats({
                total: data?.length || 0,
                pending: (data as any)?.filter((c: any) => c.status === 'pending' || c.status === 'in_review').length || 0,
                resolved: (data as any)?.filter((c: any) => c.status === 'resolved').length || 0,
                rejected: (data as any)?.filter((c: any) => c.status === 'rejected').length || 0,
            })
        } catch (error) {
            console.error('Error fetching complaints:', error)
        } finally {
            setIsLoading(false)
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

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'resolved':
                return <CheckCircle2 className="w-5 h-5 text-green-600" />
            case 'rejected':
                return <XCircle className="w-5 h-5 text-red-600" />
            case 'in_review':
                return <Clock className="w-5 h-5 text-blue-600" />
            default:
                return <AlertCircle className="w-5 h-5 text-amber-600" />
        }
    }

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-24" />
                    ))}
                </div>
                <Skeleton className="h-96" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">My Complaints</h1>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <MessageSquare className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{stats.total}</p>
                            <p className="text-xs text-muted-foreground">Total</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{stats.pending}</p>
                            <p className="text-xs text-muted-foreground">Pending</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{stats.resolved}</p>
                            <p className="text-xs text-muted-foreground">Resolved</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <XCircle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{stats.rejected}</p>
                            <p className="text-xs text-muted-foreground">Rejected</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Complaints List */}
            {complaints.length === 0 ? (
                <Card className="p-12 text-center">
                    <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No complaints filed yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        If you have an issue with an order, you can file a complaint from the My Orders page
                    </p>
                </Card>
            ) : (
                <div className="space-y-4">
                    {complaints.map((complaint) => (
                        <Card key={complaint.id}>
                            <CardContent className="p-6">
                                <div className="flex items-start gap-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${complaint.status === 'resolved' ? 'bg-green-100 dark:bg-green-900/30' :
                                        complaint.status === 'rejected' ? 'bg-red-100 dark:bg-red-900/30' :
                                            complaint.status === 'in_review' ? 'bg-blue-100 dark:bg-blue-900/30' :
                                                'bg-amber-100 dark:bg-amber-900/30'
                                        }`}>
                                        {getStatusIcon(complaint.status)}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h3 className="font-semibold">{complaint.title}</h3>
                                                <p className="text-sm text-muted-foreground mt-1">{complaint.description}</p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                {getStatusBadge(complaint.status)}
                                                <p className="text-xs text-muted-foreground mt-2">
                                                    {formatDate(complaint.created_at)}
                                                </p>
                                            </div>
                                        </div>

                                        {complaint.resolution_notes && (
                                            <div className="mt-4 p-3 rounded-lg bg-muted/50">
                                                <p className="text-sm font-medium mb-1">Resolution Notes:</p>
                                                <p className="text-sm text-muted-foreground">{complaint.resolution_notes}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
