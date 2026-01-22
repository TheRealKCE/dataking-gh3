'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { CheckCircle2, XCircle } from 'lucide-react'

export default function AdminAfaManagementPage() {
    const [applications, setApplications] = useState<any[]>([])

    useEffect(() => {
        fetchApplications()
    }, [])

    const fetchApplications = async () => {
        const { data } = await supabase
            .from('afa_orders')
            .select('*')
            .order('created_at', { ascending: false })
        setApplications(data || [])
    }

    const updateStatus = async (id: string, status: string) => {
        const { error } = await (supabase.from('afa_orders') as any).update({ status }).eq('id', id)
        if (error) {
            toast.error('Failed to update status')
        } else {
            toast.success(`Application marked as ${status}`)
            fetchApplications()
        }
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">AFA Applications</h1>
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Applicant</TableHead>
                                <TableHead>GH Card</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {applications.map((app) => (
                                <TableRow key={app.id}>
                                    <TableCell>
                                        <div className="font-medium">{app.full_name}</div>
                                        <div className="text-xs text-muted-foreground">{app.phone}</div>
                                    </TableCell>
                                    <TableCell>{app.ghana_card}</TableCell>
                                    <TableCell>{app.location}, {app.region}</TableCell>
                                    <TableCell>
                                        <Badge variant={app.status === 'completed' ? 'completed' : 'secondary'}>
                                            {app.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            {app.status === 'pending' && (
                                                <>
                                                    <Button size="sm" onClick={() => updateStatus(app.id, 'completed')}>
                                                        <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                                                    </Button>
                                                    <Button size="sm" variant="destructive" onClick={() => updateStatus(app.id, 'cancelled')}>
                                                        <XCircle className="w-4 h-4 mr-1" /> Reject
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
