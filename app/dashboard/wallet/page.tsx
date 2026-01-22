'use client'

import { useEffect, useState, Suspense } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, calculatePaystackFee } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
    Wallet,
    Plus,
    ArrowUpRight,
    ArrowDownLeft,
    CreditCard,
    Smartphone,
    Building,
    Loader2,
    TrendingUp,
    TrendingDown
} from 'lucide-react'
import { toast } from 'sonner'
import { WalletTransaction } from '@/types/supabase'

const QUICK_AMOUNTS = [50, 100, 200, 500]
const MIN_AMOUNT = 5
const PAYSTACK_FEE_PERCENT = 1.95

function WalletContent() {
    const { dbUser } = useAuth()
    const [walletBalance, setWalletBalance] = useState(0)
    const [totalCredited, setTotalCredited] = useState(0)
    const [totalDebited, setTotalDebited] = useState(0)
    const [transactions, setTransactions] = useState<WalletTransaction[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [topUpAmount, setTopUpAmount] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)
    const searchParams = useSearchParams()
    const router = useRouter()

    useEffect(() => {
        if (dbUser) {
            fetchWalletData()
        }
    }, [dbUser])

    useEffect(() => {
        const success = searchParams.get('success')
        const error = searchParams.get('error')

        if (success === 'true') {
            toast.success('Wallet topped up successfully!')
            fetchWalletData()
            // Clean up URL
            router.replace('/dashboard/wallet')
        } else if (error) {
            let message = 'Failed to process payment'
            if (error === 'payment_failed') message = 'Payment was not successful'
            if (error === 'verification_failed') message = 'Could not verify payment'
            if (error === 'no_reference') message = 'Invalid payment reference'

            toast.error(message)
            // Clean up URL
            router.replace('/dashboard/wallet')
        }
    }, [searchParams, router])

    const fetchWalletData = async () => {
        try {
            // Fetch wallet
            const { data: wallet } = await supabase
                .from('wallets')
                .select('*')
                .eq('user_id', dbUser?.id as any)
                .single()

            if (wallet) {
                setWalletBalance((wallet as any).balance)
                setTotalCredited((wallet as any).total_credited)
                setTotalDebited((wallet as any).total_spent)
            }

            // Fetch recent transactions
            const { data: txns } = await supabase
                .from('wallet_transactions')
                .select('*')
                .eq('user_id', dbUser?.id as any)
                .order('created_at', { ascending: false })
                .limit(10)

            setTransactions(txns || [])
        } catch (error) {
            console.error('Error fetching wallet data:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleQuickAmount = (amount: number) => {
        setTopUpAmount(amount.toString())
    }

    const handleTopUp = async () => {
        const amount = parseFloat(topUpAmount)

        if (isNaN(amount) || amount < MIN_AMOUNT) {
            toast.error(`Minimum amount is ${formatCurrency(MIN_AMOUNT)}`)
            return
        }

        if (!dbUser?.email) {
            toast.error('Please update your profile with an email address')
            return
        }

        setIsProcessing(true)

        try {
            // Initialize payment on server
            const response = await fetch('/api/payments/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ amount }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to initialize payment')
            }

            // Redirect to Paystack checkout
            window.location.href = data.authorization_url
        } catch (error: any) {
            toast.error(error.message || 'Failed to process payment')
            setIsProcessing(false)
        }
    }

    const fee = topUpAmount ? calculatePaystackFee(parseFloat(topUpAmount) || 0, PAYSTACK_FEE_PERCENT) : 0
    const totalAmount = topUpAmount ? (parseFloat(topUpAmount) || 0) + fee : 0

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-48 w-full max-w-md" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-24" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Wallet</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Balance Card */}
                <div className="lg:col-span-1">
                    <Card className="overflow-hidden">
                        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-6 text-white">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <Wallet className="w-6 h-6" />
                                    <span className="font-medium">Your Wallet</span>
                                </div>
                                <Badge className="bg-white/20 text-white border-0">Active</Badge>
                            </div>
                            <p className="text-sm text-white/70 mb-1">Available Balance</p>
                            <p className="text-4xl font-bold mb-6">{formatCurrency(walletBalance)}</p>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
                                <div>
                                    <div className="flex items-center gap-1 text-green-300 text-sm mb-1">
                                        <TrendingUp className="w-4 h-4" />
                                        <span>Credited</span>
                                    </div>
                                    <p className="font-semibold">{formatCurrency(totalCredited)}</p>
                                </div>
                                <div>
                                    <div className="flex items-center gap-1 text-red-300 text-sm mb-1">
                                        <TrendingDown className="w-4 h-4" />
                                        <span>Spent</span>
                                    </div>
                                    <p className="font-semibold">{formatCurrency(totalDebited)}</p>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Top Up Card */}
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Plus className="w-5 h-5" />
                                Top Up Wallet
                            </CardTitle>
                            <CardDescription>
                                Add funds to your wallet using mobile money, card, or bank transfer
                            </CardDescription>
                        </CardHeader>
                        <form onSubmit={(e) => { e.preventDefault(); handleTopUp(); }}>
                            <CardContent className="space-y-6">
                                {/* Quick Amounts */}
                                <div>
                                    <Label className="text-sm text-muted-foreground mb-3 block">Quick Select</Label>
                                    <div className="grid grid-cols-4 gap-3">
                                        {QUICK_AMOUNTS.map((amount) => (
                                            <Button
                                                key={amount}
                                                type="button"
                                                variant={topUpAmount === amount.toString() ? 'default' : 'outline'}
                                                onClick={() => handleQuickAmount(amount)}
                                                className="h-12"
                                            >
                                                {formatCurrency(amount)}
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                {/* Custom Amount */}
                                <div>
                                    <Label htmlFor="amount">Custom Amount (GHS)</Label>
                                    <div className="relative mt-2">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">GHS</span>
                                        <Input
                                            id="amount"
                                            type="number"
                                            placeholder="Enter amount"
                                            value={topUpAmount}
                                            onChange={(e) => setTopUpAmount(e.target.value)}
                                            className="pl-12 h-12 text-lg"
                                            min={MIN_AMOUNT}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">Minimum: {formatCurrency(MIN_AMOUNT)}</p>
                                </div>

                                {/* Summary */}
                                {topUpAmount && parseFloat(topUpAmount) >= MIN_AMOUNT && (
                                    <div className="p-4 rounded-xl bg-muted/50 space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Top-up amount</span>
                                            <span>{formatCurrency(parseFloat(topUpAmount))}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Transaction fee ({PAYSTACK_FEE_PERCENT}%)</span>
                                            <span>{formatCurrency(fee)}</span>
                                        </div>
                                        <Separator />
                                        <div className="flex justify-between font-semibold">
                                            <span>Total to pay</span>
                                            <span className="text-primary">{formatCurrency(totalAmount)}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Payment Methods */}
                                <div>
                                    <Label className="text-sm text-muted-foreground mb-3 block">Payment Methods</Label>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="p-4 rounded-xl border bg-background text-center">
                                            <Smartphone className="w-6 h-6 mx-auto mb-2 text-yellow-500" />
                                            <span className="text-sm">Mobile Money</span>
                                        </div>
                                        <div className="p-4 rounded-xl border bg-background text-center">
                                            <CreditCard className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                                            <span className="text-sm">Card</span>
                                        </div>
                                        <div className="p-4 rounded-xl border bg-background text-center">
                                            <Building className="w-6 h-6 mx-auto mb-2 text-purple-500" />
                                            <span className="text-sm">Bank Transfer</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Pay Button */}
                                <Button
                                    type="submit"
                                    className="w-full h-12 text-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                                    disabled={isProcessing || !topUpAmount || parseFloat(topUpAmount) < MIN_AMOUNT}
                                >
                                    {isProcessing ? (
                                        <>
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="w-5 h-5 mr-2" />
                                            Top Up {topUpAmount && parseFloat(topUpAmount) >= MIN_AMOUNT && formatCurrency(parseFloat(topUpAmount))}
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        </form>
                    </Card>
                </div>
            </div>

            {/* Recent Transactions */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                    {transactions.length === 0 ? (
                        <div className="text-center py-12">
                            <Wallet className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                            <p className="text-muted-foreground">No transactions yet</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {transactions.map((txn) => (
                                <div
                                    key={txn.id}
                                    className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${txn.type === 'credit'
                                            ? 'bg-green-100 dark:bg-green-900/30'
                                            : 'bg-red-100 dark:bg-red-900/30'
                                            }`}>
                                            {txn.type === 'credit' ? (
                                                <ArrowDownLeft className="w-5 h-5 text-green-600" />
                                            ) : (
                                                <ArrowUpRight className="w-5 h-5 text-red-600" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-medium">{txn.description}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {formatDate(txn.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-semibold ${txn.type === 'credit' ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                            {txn.type === 'credit' ? '+' : '-'}{formatCurrency(txn.amount)}
                                        </p>
                                        <Badge variant={txn.status === 'completed' ? 'completed' : 'pending'} className="text-xs">
                                            {txn.status}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

export default function WalletPage() {
    return (
        <Suspense fallback={
            <div className="space-y-6 p-6">
                <Skeleton className="h-48 w-full max-w-md" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-24" />
                    ))}
                </div>
            </div>
        }>
            <WalletContent />
        </Suspense>
    )
}
