'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatCurrency, generateReferenceCode } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Loader2, Package, CheckCircle2, ShoppingCart, CreditCard, Wallet, AlertCircle, Copy } from 'lucide-react'
import { toast } from 'sonner'

interface RCType {
    id: string; name: string; customer_price: number; agent_price: number; is_active: boolean
    stock?: { available: number; reserved: number; sold: number }
}

interface PurchaseSuccess {
    reference: string
    type_name: string
    vouchers: Array<{ id: string; pin: string; serial_number: string }>
}

export default function ResultsCheckerPage() {
    const { dbUser, refreshUser } = useAuth()
    const [types, setTypes] = useState<RCType[]>([])
    const [loading, setLoading] = useState(true)
    
    // Purchase form state
    const [selectedTypeId, setSelectedTypeId] = useState<string>('')
    const [quantity, setQuantity] = useState<number>(1)
    const paymentMethod = 'wallet'
    
    // Customer info form (pre-filled if possible)
    const [customerName, setCustomerName] = useState(dbUser ? `${dbUser.first_name || ''} ${dbUser.last_name || ''}`.trim() : '')
    const [customerEmail, setCustomerEmail] = useState(dbUser?.email || '')
    const [customerPhone, setCustomerPhone] = useState(dbUser?.phone_number || '')
    
    const [isPurchasing, setIsPurchasing] = useState(false)
    const [successData, setSuccessData] = useState<PurchaseSuccess | null>(null)

    const isAgent = dbUser?.role === 'agent'
    const [walletBalance, setWalletBalance] = useState(0)

    const fetchTypes = useCallback(async () => {
        setLoading(true)
        try {
            // Re-use the admin endpoint but only for fetching active types
            // In a real app we'd have a specific public/user endpoint, 
            // but we can just use supabase directly here for read access since RLS allows select_all
            const res = await fetch('/api/admin/vouchers/types')
            const json = await res.json()
            if (res.ok) {
                const active = (json.data || []).filter((t: RCType) => t.is_active && (t.stock?.available || 0) > 0)
                setTypes(active)
                if (active.length > 0 && !selectedTypeId) setSelectedTypeId(active[0].id)
            }
        } finally { setLoading(false) }
    }, [selectedTypeId])

    useEffect(() => { fetchTypes() }, [fetchTypes])
    const fetchWalletBalance = useCallback(async () => {
        if (!dbUser?.id) return
        const { data } = await (supabase.from('wallets').select('balance').eq('user_id', dbUser.id).single() as any)
        if (data) setWalletBalance(data.balance || 0)
    }, [dbUser?.id])

    useEffect(() => { fetchWalletBalance() }, [fetchWalletBalance])



    const selectedType = types.find(t => t.id === selectedTypeId)
    const unitPrice = selectedType ? (isAgent ? selectedType.agent_price : selectedType.customer_price) : 0
    const subtotal = unitPrice * quantity
    const canAffordWallet = walletBalance >= subtotal

    const handlePurchase = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedType) { toast.error('Please select a voucher type'); return }
        if (!customerName || !customerPhone) { toast.error('Name and phone are required'); return }
        if (!canAffordWallet) { toast.error('Insufficient wallet balance'); return }

        setIsPurchasing(true)
        try {
            const refCode = generateReferenceCode()
            
            if (true) {
                const res = await fetch('/api/vouchers/wallet-purchase', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        typeId: selectedType.id,
                        quantity,
                        customerName,
                        customerEmail,
                        customerPhone,
                        referenceCode: refCode
                    })
                })
                const data = await res.json()
                if (!res.ok) { throw new Error(data.error || 'Purchase failed') }
                
                toast.success('Purchase successful!')
                await refreshUser()
                await fetchWalletBalance()
                                setSuccessData({ reference: refCode, type_name: selectedType.name, vouchers: data.vouchers || [] })
                fetchTypes()
                
            }
        } catch (err: any) {
            console.error('[Purchase Error]', err)
            toast.error(err.message || 'An error occurred during purchase')
        } finally {
            setIsPurchasing(false)
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        toast.success('Copied to clipboard')
    }

    if (loading) {
        return <div className="flex-1 flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
    }

    if (types.length === 0) {
        return (
            <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-5xl mx-auto w-full">
                <Card className="border-border/50 text-center py-12">
                    <CardContent>
                        <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                        <h2 className="text-xl font-semibold mb-2">Check back soon!</h2>
                        <p className="text-muted-foreground">Results checker vouchers are currently out of stock. We are restocking soon.</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-5xl mx-auto w-full">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Buy Results Checker Vouchers</h1>
                <p className="text-muted-foreground text-sm">Purchase WAEC, NECO, and other examination result checking pins instantly.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 items-start">
                {/* Left Col: Purchase Form */}
                <Card className="border-border/50">
                    <CardHeader>
                        <CardTitle>Voucher Details</CardTitle>
                        <CardDescription>Select type and quantity</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handlePurchase} className="space-y-5">
                            
                            <div className="space-y-1.5">
                                <Label>Voucher Type</Label>
                                <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select examination..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {types.map(t => (
                                            <SelectItem key={t.id} value={t.id}>
                                                <div className="flex justify-between items-center w-full min-w-[200px]">
                                                    <span>{t.name}</span>
                                                    <span className="font-semibold text-emerald-600 ml-4">
                                                        {formatCurrency(isAgent ? t.agent_price : t.customer_price)}
                                                    </span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Quantity</Label>
                                <div className="flex items-center gap-3">
                                    <Button type="button" variant="outline" size="icon" onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}>-</Button>
                                    <Input type="number" min="1" max="100" value={quantity} onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} className="text-center w-20 font-bold" />
                                    <Button type="button" variant="outline" size="icon" onClick={() => setQuantity(quantity + 1)}>+</Button>
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <Label>Customer Details (For Delivery)</Label>
                                <Input placeholder="Full Name" value={customerName} onChange={e => setCustomerName(e.target.value)} required />
                                <Input placeholder="Phone Number (WhatsApp preferred)" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} required />
                                <Input type="email" placeholder="Email Address (Optional)" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} />
                            </div>

                            

                            {!canAffordWallet && (
                                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-md p-3 flex gap-2">
                                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-semibold text-red-800 dark:text-red-400">Insufficient Funds</p>
                                        <p className="text-xs text-red-600 dark:text-red-300">Your wallet balance is {formatCurrency(walletBalance)}. You need {formatCurrency(subtotal)}.</p>
                                    </div>
                                </div>
                            )}

                            <Button 
                                type="submit" 
                                size="lg" 
                                className="w-full h-12 text-base font-bold shadow-lg"
                                disabled={isPurchasing || !canAffordWallet}
                            >
                                {isPurchasing ? (
                                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing...</>
                                ) : (
                                    <><ShoppingCart className="w-5 h-5 mr-2" /> Pay {formatCurrency(subtotal)}</>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Right Col: Summary Panel */}
                <div className="space-y-6">
                    <Card className="border-border/50 bg-primary/5 border-primary/20">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Order Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Item:</span>
                                <span className="font-semibold">{selectedType?.name || '—'}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Unit Price:</span>
                                <span>{formatCurrency(unitPrice)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Quantity:</span>
                                <span>{quantity}x</span>
                            </div>
                            <div className="pt-3 border-t border-primary/20 flex justify-between items-center">
                                <span className="font-semibold">Total to Pay:</span>
                                <span className="text-2xl font-bold text-primary">{formatCurrency(subtotal)}</span>
                            </div>
                            {isAgent && (
                                <Badge variant="secondary" className="w-full justify-center mt-2 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                                    Agent discount applied
                                </Badge>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Success Modal */}
            <Dialog open={!!successData} onOpenChange={v => !v && setSuccessData(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <div className="mx-auto w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-3">
                            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                        </div>
                        <DialogTitle className="text-center text-xl">Purchase Successful!</DialogTitle>
                        <DialogDescription className="text-center">
                            Your payment was successful. Here are your voucher details. They have also been sent to {customerPhone}.
                        </DialogDescription>
                    </DialogHeader>
                    
                    {successData && (
                        <div className="mt-4 space-y-4">
                            <div className="bg-muted/40 p-3 rounded-lg text-sm flex justify-between items-center">
                                <span className="text-muted-foreground">Order Ref:</span>
                                <span className="font-mono font-semibold">{successData.reference}</span>
                            </div>

                            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
                                {successData.vouchers.map((v, i) => (
                                    <div key={v.id} className="border border-border/60 rounded-xl p-4 bg-card relative">
                                        <div className="absolute top-2 right-3 text-xs font-semibold text-muted-foreground/50">#{i+1}</div>
                                        <div className="space-y-2 pt-2">
                                            <div className="flex flex-col gap-1">
                                                <Label className="text-xs text-muted-foreground uppercase tracking-wide">PIN</Label>
                                                <div className="flex gap-2">
                                                    <code className="flex-1 bg-muted px-3 py-2 rounded-md text-lg font-bold tracking-widest text-primary text-center">
                                                        {v.pin}
                                                    </code>
                                                    <Button variant="outline" size="icon" className="h-auto w-12 shrink-0" onClick={() => copyToClipboard(v.pin)} title="Copy PIN">
                                                        <Copy className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Serial Number</Label>
                                                <div className="flex gap-2">
                                                    <code className="flex-1 bg-muted/50 px-3 py-1.5 rounded-md text-sm font-mono text-center">
                                                        {v.serial_number}
                                                    </code>
                                                    <Button variant="outline" size="icon" className="h-auto w-12 shrink-0" onClick={() => copyToClipboard(v.serial_number)} title="Copy Serial">
                                                        <Copy className="w-3 h-3 text-muted-foreground" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <DialogFooter className="mt-6">
                        <Button className="w-full" onClick={() => setSuccessData(null)}>Done</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}






