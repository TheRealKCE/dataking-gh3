'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default function AdminTransactionsPage() {
    const [transactions, setTransactions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        fetchTransactions()
    }, [])

    const fetchTransactions = async () => {
        try {
            const { data, error } = await (supabase
                .from('wallet_transactions') as any)
                .select(`
          *,
          users (
            first_name,
            last_name,
            email,
            phone_number
          )
        `)
                .order('created_at', { ascending: false })
                .limit(100)

            if (error) throw error
            setTransactions(data || [])
        } catch (error) {
            console.error('Error fetching transactions:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredTransactions = transactions.filter(txn =>
        txn.users?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        txn.users?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        txn.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        txn.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Global Transactions</h1>
                    <p className="text-muted-foreground">View all wallet transactions across the platform</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by user, reference, or description..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Reference</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTransactions.map((txn) => (
                                <TableRow key={txn.id}>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{txn.users?.first_name} {txn.users?.last_name}</span>
                                            <span className="text-xs text-muted-foreground">{txn.users?.phone_number || txn.users?.email}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">{txn.reference}</TableCell>
                                    <TableCell>
                                        <Badge variant={txn.type === 'credit' ? 'completed' : 'destructive'}>
                                            {txn.type.toUpperCase()}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-xs truncate">{txn.description}</TableCell>
                                    <TableCell className={txn.type === 'credit' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                        {txn.type === 'credit' ? '+' : '-'}{formatCurrency(txn.amount)}
                                    </TableCell>
                                    <TableCell>
                                        <span className={`text-xs capitalize ${txn.status === 'completed' ? 'text-green-600' :
                                            txn.status === 'failed' ? 'text-red-600' : 'text-amber-600'
                                            }`}>
                                            {txn.status}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {formatDate(txn.created_at)}
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
