'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Users, Phone, ShoppingBag, Calendar, TrendingUp } from 'lucide-react'

export default function CustomersPage() {
    const [customers, setCustomers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        fetchCustomers()
    }, [])

    const fetchCustomers = async () => {
        try {
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

    // Memoized filtering for performance
    const filteredCustomers = useMemo(() =>
        customers.filter(c => c.customer_phone.includes(searchTerm)),
        [customers, searchTerm]
    )

    // Stats calculations
    const stats = useMemo(() => ({
        totalCustomers: customers.length,
        totalRevenue: customers.reduce((sum, c) => sum + (c.total_spent || 0), 0),
        totalOrders: customers.reduce((sum, c) => sum + (c.total_purchases || 0), 0)
    }), [customers])

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                    {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-20 rounded-xl" />
                    ))}
                </div>
                <Skeleton className="h-10 rounded-lg" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[...Array(6)].map((_, i) => (
                        <Skeleton key={i} className="h-32 rounded-xl" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div>
                <h1 className="text-xl font-bold">My Customers</h1>
                <p className="text-sm text-muted-foreground">Track your customer purchases</p>
            </div>

            {/* Stats Grid - 3 columns on mobile */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                    <CardContent className="p-3 text-center">
                        <Users className="w-5 h-5 mx-auto text-blue-500 mb-1" />
                        <p className="text-lg sm:text-xl font-bold">{stats.totalCustomers}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Customers</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                    <CardContent className="p-3 text-center">
                        <TrendingUp className="w-5 h-5 mx-auto text-green-500 mb-1" />
                        <p className="text-lg sm:text-xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Revenue</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                    <CardContent className="p-3 text-center">
                        <ShoppingBag className="w-5 h-5 mx-auto text-purple-500 mb-1" />
                        <p className="text-lg sm:text-xl font-bold">{stats.totalOrders}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Orders</p>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    placeholder="Search phone number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                />
            </div>

            {/* Customers Grid */}
            {filteredCustomers.length === 0 ? (
                <Card className="p-8 text-center">
                    <Users className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-muted-foreground text-sm">
                        {searchTerm ? 'No customers match your search' : 'No customers yet'}
                    </p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredCustomers.map((customer) => (
                        <Card
                            key={customer.id}
                            className="hover:shadow-md transition-shadow overflow-hidden"
                        >
                            <CardContent className="p-0">
                                {/* Phone Header */}
                                <div className="px-4 py-3 bg-gradient-to-r from-primary/5 to-primary/10 border-b">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                            <Phone className="w-4 h-4 text-primary" />
                                        </div>
                                        <span className="font-semibold text-sm truncate">
                                            {customer.customer_phone}
                                        </span>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="p-4 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-muted-foreground">Orders</span>
                                        <Badge variant="secondary" className="text-xs">
                                            {customer.total_purchases}
                                        </Badge>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-muted-foreground">Total Spent</span>
                                        <span className="font-semibold text-sm text-green-600 dark:text-green-400">
                                            {formatCurrency(customer.total_spent)}
                                        </span>
                                    </div>
                                    <div className="pt-2 border-t text-[10px] text-muted-foreground flex justify-between">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            First: {formatDate(customer.first_purchase_at)}
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            Last: {formatDate(customer.last_purchase_at)}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Results Count */}
            {filteredCustomers.length > 0 && (
                <p className="text-center text-xs text-muted-foreground">
                    Showing {filteredCustomers.length} of {customers.length} customers
                </p>
            )}
        </div>
    )
}
