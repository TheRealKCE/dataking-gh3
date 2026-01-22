'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

export default function AdminMtnLogsPage() {
    const [logs, setLogs] = useState<any[]>([])

    useEffect(() => {
        fetchLogs()
    }, [])

    const fetchLogs = async () => {
        const { data } = await supabase
            .from('mtn_fulfillment_tracking')
            .select(`
        *,
        orders (
          reference_code,
          phone_number
        )
      `)
            .order('created_at', { ascending: false })
            .limit(50)

        setLogs(data || [])
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">MTN Fulfillment Logs</h1>
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Time</TableHead>
                                <TableHead>Order Ref</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>API Response</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell className="text-sm text-muted-foreground">{formatDate(log.created_at)}</TableCell>
                                    <TableCell className="font-mono">{log.orders?.reference_code}</TableCell>
                                    <TableCell>{log.orders?.phone_number}</TableCell>
                                    <TableCell>
                                        <Badge variant={log.status === 'completed' ? 'completed' : log.status === 'failed' ? 'failed' : 'secondary'}>
                                            {log.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-xs truncate text-xs font-mono">
                                        {JSON.stringify(log.api_response)}
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
