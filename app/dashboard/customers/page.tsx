'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Search, Users } from 'lucide-react'

export default function CustomersPage() {
    const [customers, setCustomers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        fetchCustomers()
    }, [])

    const fetchCustomers = async () => {
        try {
            // Fetch customer purchases tracked for the current logged-in user (Agent view)
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data, error } = await supabase
                .from('customer_purchases')
                .select('*')
                .eq('user_id', user.id)
                .order('last_purchase_at', { ascending: false })

            if (error) throw error
            setCustomers(data || [])
        } catch (error) {
            console.error('Error fetching customers:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredCustomers = customers.filter(c =>
        c.customer_phone.includes(searchTerm)
    )

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">My Customers</h1>
                    <p className="text-muted-foreground">Track usage by phone numbers you have serviced</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search phone number..."
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
                                <TableHead>Customer Phone</TableHead>
                                <TableHead>Total Orders</TableHead>
                                <TableHead>Total Spent</TableHead>
                                <TableHead>First Purchase</TableHead>
                                <TableHead>Last Purchase</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredCustomers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        <div className="flex flex-col items-center">
                                            <Users className="w-8 h-8 mb-2 opacity-50" />
                                            <p>No customers found</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredCustomers.map((customer) => (
                                    <TableRow key={customer.id}>
                                        <TableCell className="font-medium">{customer.customer_phone}</TableCell>
                                        <TableCell>{customer.total_purchases}</TableCell>
                                        <TableCell>{formatCurrency(customer.total_spent)}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{formatDate(customer.first_purchase_at)}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{formatDate(customer.last_purchase_at)}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
