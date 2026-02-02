'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Users,
    Clock,
    Calendar,
    ShieldCheck,
    Plus,
    Save,
    Loader2,
    Search,
    RefreshCw,
    MoreVertical,
    History
} from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export default function AdminMembershipsPage() {
    const [agents, setAgents] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isSavingPrices, setIsSavingPrices] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')

    // Extension Dialog State
    const [extensionUser, setExtensionUser] = useState<any>(null)
    const [extensionDays, setExtensionDays] = useState('30')
    const [isExtending, setIsExtending] = useState(false)

    // Pricing state
    const [prices, setPrices] = useState({
        '3d': '9.99',
        '14d': '49.99',
        '30d': '99.99'
    })
    const [showStrikethrough, setShowStrikethrough] = useState(false)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        try {
            // Fetch Prices
            const { data: settingsData } = await (supabase as any)
                .from('admin_settings')
                .select('*')

            if (settingsData) {
                const p3 = settingsData.find((s: any) => s.key === 'agent_upgrade_price_3d')?.value || '9.99'
                const p14 = settingsData.find((s: any) => s.key === 'agent_upgrade_price_14d')?.value || '49.99'
                const p30 = settingsData.find((s: any) => s.key === 'agent_upgrade_price_30d')?.value || '99.99'
                const showStrike = settingsData.find((s: any) => s.key === 'show_price_strikethrough')?.value === 'true'
                setPrices({
                    '3d': String(p3),
                    '14d': String(p14),
                    '30d': String(p30)
                })
                setShowStrikethrough(showStrike)
            }

            // Fetch Agents - Ensure we get ALL agents regardless of how they were set
            const { data: agentsData, error: agentsError } = await (supabase as any)
                .from('users')
                .select('*')
                .eq('role', 'agent')
                .order('created_at', { ascending: false })

            if (agentsError) throw agentsError
            setAgents(agentsData || [])

        } catch (error: any) {
            console.error('Error fetching membership data:', error)
            toast.error('Failed to load data')
        } finally {
            setLoading(false)
        }
    }

    const handleSavePrices = async () => {
        setIsSavingPrices(true)
        try {
            const response = await fetch('/api/admin/update-prices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prices, showStrikethrough })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to update prices')
            }

            toast.success(data.message || '✅ Prices updated successfully!')
            await fetchData()
        } catch (error: any) {
            console.error('Error saving prices:', error)
            toast.error('❌ ' + error.message)
        } finally {
            setIsSavingPrices(false)
        }
    }

    const handleExtend = async () => {
        if (!extensionUser || !extensionDays) return

        const days = parseInt(extensionDays)
        if (isNaN(days) || days <= 0) {
            toast.error('Please enter a valid number of days')
            return
        }

        setIsExtending(true)
        try {
            const currentExpiry = extensionUser.agent_expires_at
            const baseDate = currentExpiry ? new Date(currentExpiry) : new Date()

            // If already expired, start from now
            const now = new Date()
            const startingPoint = baseDate > now ? baseDate : now

            const newExpiry = new Date(startingPoint)
            newExpiry.setDate(newExpiry.getDate() + days)

            const { error } = await (supabase as any)
                .from('users')
                .update({ agent_expires_at: newExpiry.toISOString() })
                .eq('id', extensionUser.id)

            if (error) throw error

            setAgents(agents.map(a => a.id === extensionUser.id ? { ...a, agent_expires_at: newExpiry.toISOString() } : a))
            toast.success(`Subscription extended by ${days} days`)
            setExtensionUser(null)
            setExtensionDays('30')
        } catch (error: any) {
            console.error('Error extending sub:', error)
            toast.error('Failed to extend subscription')
        } finally {
            setIsExtending(false)
        }
    }

    const calculateDaysLeft = (expiry: string | null) => {
        if (!expiry) return 0
        const now = new Date()
        const exp = new Date(expiry)
        const diff = exp.getTime() - now.getTime()
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
        return days > 0 ? days : 0
    }

    const filteredAgents = agents.filter(a =>
        a.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.last_name?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-8 h-8 text-amber-500" />
                    Agent Memberships
                </h1>
                <p className="text-muted-foreground font-medium">Manage pricing and subscription durations for your agents.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Pricing Manager Card */}
                <Card className="lg:col-span-1 shadow-xl border-amber-100 h-fit">
                    <CardHeader className="bg-amber-50/50">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Plus className="w-5 h-5 text-amber-600" />
                            Upgrade Pricing
                        </CardTitle>
                        <CardDescription>Set the cost for each membership tier.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>3 Days Access (GHS) - Starter</Label>
                                <Input
                                    type="number"
                                    value={prices['3d']}
                                    onChange={(e) => setPrices({ ...prices, '3d': e.target.value })}
                                    className="font-bold text-lg"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>14 Days Access (GHS)</Label>
                                <Input
                                    type="number"
                                    value={prices['14d']}
                                    onChange={(e) => setPrices({ ...prices, '14d': e.target.value })}
                                    className="font-bold text-lg border-amber-200"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>30 Days Access (GHS)</Label>
                                <Input
                                    type="number"
                                    value={prices['30d']}
                                    onChange={(e) => setPrices({ ...prices, '30d': e.target.value })}
                                    className="font-bold text-lg"
                                />
                            </div>
                        </div>
                        <div className="space-y-3 pt-2 border-t">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="strikethrough"
                                    checked={showStrikethrough}
                                    onCheckedChange={(checked) => setShowStrikethrough(checked as boolean)}
                                />
                                <Label htmlFor="strikethrough" className="text-sm font-medium cursor-pointer">
                                    Show old prices with strikethrough
                                </Label>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Enable to display previous prices crossed out when prices change
                            </p>
                        </div>
                        <Button
                            className="w-full bg-slate-900 hover:bg-slate-800 h-12 text-base font-black"
                            onClick={handleSavePrices}
                            disabled={isSavingPrices}
                        >
                            {isSavingPrices ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                            Update Prices
                        </Button>
                    </CardContent>
                </Card>

                {/* Agents List Card */}
                <Card className="lg:col-span-2 shadow-xl border-blue-50">
                    <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b gap-4">
                        <div className="space-y-1">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Users className="w-5 h-5 text-blue-600" />
                                Active Agents ({agents.length})
                            </CardTitle>
                            <CardDescription>Agents with active subscriptions.</CardDescription>
                        </div>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search agents..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 h-9 text-xs"
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex justify-center py-20">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                            </div>
                        ) : filteredAgents.length === 0 ? (
                            <div className="text-center py-20 space-y-4">
                                <p className="text-muted-foreground font-medium">No agents found.</p>
                                <Button variant="outline" size="sm" onClick={() => fetchData()}>
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Refresh
                                </Button>
                            </div>
                        ) : (
                            <>
                                {/* Desktop Table View */}
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50/50 text-slate-500 font-bold">
                                            <tr>
                                                <th className="px-6 py-4 text-left">Agent</th>
                                                <th className="px-6 py-4 text-left">Status</th>
                                                <th className="px-6 py-4 text-center">Days Left</th>
                                                <th className="px-6 py-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {filteredAgents.map((agent) => {
                                                const daysLeft = calculateDaysLeft(agent.agent_expires_at)
                                                return (
                                                    <tr key={agent.id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-black text-slate-900">{agent.first_name} {agent.last_name}</span>
                                                                <span className="text-xs text-muted-foreground">{agent.email}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {daysLeft > 0 ? (
                                                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200 uppercase text-[10px] font-black">Active</Badge>
                                                            ) : (
                                                                <Badge variant="destructive" className="uppercase text-[10px] font-black">Expired</Badge>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className={cn(
                                                                    "text-xl font-black",
                                                                    daysLeft < 5 ? "text-red-600" : "text-slate-900"
                                                                )}>{daysLeft}</span>
                                                                <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={cn("h-full", daysLeft < 5 ? "bg-red-500" : "bg-blue-500")}
                                                                        style={{ width: `${Math.min((daysLeft / 30) * 100, 100)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="sm">
                                                                        <MoreVertical className="w-4 h-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem onClick={() => {
                                                                        setExtensionUser(agent)
                                                                        setExtensionDays('30')
                                                                    }}>
                                                                        <Calendar className="w-4 h-4 mr-2" />
                                                                        Extend Access
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Card View */}
                                <div className="md:hidden space-y-4 p-4">
                                    {filteredAgents.map((agent) => {
                                        const daysLeft = calculateDaysLeft(agent.agent_expires_at)
                                        return (
                                            <div key={agent.id} className="bg-white rounded-xl border p-4 shadow-sm flex flex-col gap-3">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="font-black text-slate-900">{agent.first_name} {agent.last_name}</h3>
                                                        <p className="text-xs text-muted-foreground">{agent.email}</p>
                                                    </div>
                                                    {daysLeft > 0 ? (
                                                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200 uppercase text-[10px] font-black">Active</Badge>
                                                    ) : (
                                                        <Badge variant="destructive" className="uppercase text-[10px] font-black">Expired</Badge>
                                                    )}
                                                </div>

                                                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg">
                                                    <span className="text-xs font-bold text-slate-500">Days Remaining</span>
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                        <span className={cn(
                                                            "text-lg font-black",
                                                            daysLeft < 5 ? "text-red-600" : "text-slate-900"
                                                        )}>{daysLeft}</span>
                                                    </div>
                                                </div>

                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="w-full text-blue-600 border-blue-200 hover:bg-blue-50"
                                                    onClick={() => {
                                                        setExtensionUser(agent)
                                                        setExtensionDays('30')
                                                    }}
                                                >
                                                    <Calendar className="w-4 h-4 mr-2" />
                                                    Extend Subscription
                                                </Button>
                                            </div>
                                        )
                                    })}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Extension Dialog */}
            <Dialog open={!!extensionUser} onOpenChange={() => setExtensionUser(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Extend Subscription</DialogTitle>
                        <DialogDescription>
                            Add access days for {extensionUser?.first_name} {extensionUser?.last_name}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Number of Days to Add</Label>
                            <Input
                                type="number"
                                value={extensionDays}
                                onChange={(e) => setExtensionDays(e.target.value)}
                                placeholder="e.g 30"
                                className="font-bold text-lg"
                            />
                            <div className="flex gap-2">
                                {[3, 7, 14, 30, 90].map(d => (
                                    <Badge
                                        key={d}
                                        variant="outline"
                                        className="cursor-pointer hover:bg-slate-100"
                                        onClick={() => setExtensionDays(d.toString())}
                                    >
                                        +{d}d
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setExtensionUser(null)}>Cancel</Button>
                        <Button onClick={handleExtend} disabled={isExtending} className="bg-blue-600 hover:bg-blue-700">
                            {isExtending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calendar className="w-4 h-4 mr-2" />}
                            Add Days
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
