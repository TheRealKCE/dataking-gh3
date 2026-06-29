'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Loader2, Search, CheckSquare, XSquare } from 'lucide-react'
import { toast } from 'sonner'

interface ShopBuyer {
    phone_number: string
    shop_name: string
    last_purchase_at: string
    order_count: number
}

interface ShopBuyersPanelProps {
    selectedPhones: Set<string>
    onSelectionChange: (phones: Set<string>) => void
}

export function ShopBuyersPanel({ selectedPhones, onSelectionChange }: ShopBuyersPanelProps) {
    const [buyers, setBuyers] = useState<ShopBuyer[]>([])
    const [filtered, setFiltered] = useState<ShopBuyer[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<'completed' | 'all'>('completed')

    useEffect(() => {
        fetchBuyers()
    }, [statusFilter])

    useEffect(() => {
        const q = search.trim()
        setFiltered(
            q ? buyers.filter(b => b.phone_number.includes(q) || b.shop_name.toLowerCase().includes(q.toLowerCase())) : buyers
        )
    }, [buyers, search])

    const fetchBuyers = async () => {
        setLoading(true)
        try {
            const params = statusFilter === 'completed' ? '?status=completed' : ''
            const res = await fetch(`/api/admin/sms-broadcast/shop-buyers${params}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to load shop buyers')
            setBuyers(data.buyers || [])
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setLoading(false)
        }
    }

    const toggle = (phone: string) => {
        const next = new Set(selectedPhones)
        next.has(phone) ? next.delete(phone) : next.add(phone)
        onSelectionChange(next)
    }

    const selectAll = () => {
        const next = new Set(selectedPhones)
        filtered.forEach(b => next.add(b.phone_number))
        onSelectionChange(next)
    }

    const deselectAll = () => {
        const next = new Set(selectedPhones)
        filtered.forEach(b => next.delete(b.phone_number))
        onSelectionChange(next)
    }

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by phone or shop name..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll} className="flex-1">
                    <CheckSquare className="w-4 h-4 mr-2" /> Select All ({filtered.length})
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll} className="flex-1">
                    <XSquare className="w-4 h-4 mr-2" /> Deselect All
                </Button>
            </div>

            <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No shop buyers found</div>
                ) : (
                    <div className="divide-y">
                        {filtered.map(b => (
                            <label key={b.phone_number} className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer">
                                <Checkbox checked={selectedPhones.has(b.phone_number)} onCheckedChange={() => toggle(b.phone_number)} />
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium">{b.phone_number}</div>
                                    <div className="text-xs text-muted-foreground truncate">
                                        {b.shop_name} · {b.order_count} order{b.order_count > 1 ? 's' : ''}
                                    </div>
                                </div>
                            </label>
                        ))}
                    </div>
                )}
            </div>

            <div className="text-xs text-muted-foreground text-center">
                Showing {filtered.length} of {buyers.length} unique buyers across all shops
            </div>
        </div>
    )
}
