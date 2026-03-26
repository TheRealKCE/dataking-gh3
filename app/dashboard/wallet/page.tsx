'use client'

import { useEffect, useState, Suspense } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, calculatePaystackFee, cn } from '@/lib/utils'
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
    TrendingDown,
    AlertTriangle,
    MessageSquare,
    MessageCircle,
    Send,
    Copy,
    Check
} from 'lucide-react'
import { toast } from 'sonner'
import { WalletTransaction } from '@/types/supabase'
import { useTutorial } from '@/hooks/useTutorial'
import { HelpButton } from '@/components/tutorial/HelpButton'

const QUICK_AMOUNTS = [50, 100, 200, 500]
const MIN_AMOUNT = 5

function WalletContent() {
    const { dbUser, isAdmin } = useAuth()
    const router = useRouter()
    const [walletBalance, setWalletBalance] = useState(0)
    const [totalCredited, setTotalCredited] = useState(0)
    const [totalDebited, setTotalDebited] = useState(0)
    const [transactions, setTransactions] = useState<WalletTransaction[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [topUpAmount, setTopUpAmount] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)
    const [paystackFeePercent, setPaystackFeePercent] = useState(1.95)
    const searchParams = useSearchParams()

    // Tutorial hook
    const userRole = dbUser?.role === 'agent' ? 'agent' : 'customer'
    const { startTutorial } = useTutorial(userRole as 'customer' | 'agent', '/wallet')

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
            const [walletRes, txnsRes, feeSettingRes] = await Promise.all([
                // Fetch wallet
                supabase
                    .from('wallets')
                    .select('*')
                    .eq('user_id', dbUser?.id as any)
                    .single(),

                // Fetch top-up transactions
                supabase
                    .from('wallet_transactions')
                    .select('*')
                    .eq('user_id', dbUser?.id as any)
                    .eq('type', 'credit')
                    .or('source.eq.payment,source.eq.admin')
                    .order('created_at', { ascending: false })
                    .limit(50),

                // Fetch settings
                supabase
                    .from('admin_settings')
                    .select('value')
                    .eq('key', 'paystack_fee_percent')
                    .single()
            ])

            const wallet = walletRes.data
            const txns = txnsRes.data
            const feeSetting = feeSettingRes.data

            if (wallet) {
                setWalletBalance((wallet as any).balance)
                setTotalCredited((wallet as any).total_credited)
                setTotalDebited((wallet as any).total_spent)
            }

            setTransactions(txns || [])

            if ((feeSetting as any)?.value) {
                const val = (feeSetting as any).value
                // Handle possible string "1.95" or number 1.95
                const parsed = typeof val === 'string' ? parseFloat(val) : (typeof val === 'number' ? val : 1.95)
                if (!isNaN(parsed)) setPaystackFeePercent(parsed)
            }
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

    const fee = topUpAmount ? calculatePaystackFee(parseFloat(topUpAmount) || 0, paystackFeePercent) : 0
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Load Wallet</h1>
                    <p className="text-muted-foreground">Top up your wallet to continue shopping</p>
                </div>
                <HelpButton onClick={startTutorial} />
            </div>

            {/* Balance Card at top for Agents */}
            {dbUser?.role === 'agent' && (
                <div className="w-full">
                    <Card id="wallet-balance-card" className="overflow-hidden border-2 border-[#1A1A1A] shadow-lg">
                        <div className="bg-[#1A1A1A] p-6 text-white">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <Wallet className="w-6 h-6 text-[#FACC15]" />
                                    <span className="font-semibold uppercase tracking-widest text-xs text-[#FACC15]">Wallet Balance</span>
                                </div>
                                <Badge className="bg-[#FACC15] text-black border-0 font-bold">Active</Badge>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
                                <div>
                                    <p className="text-sm text-gray-400 mb-1">Available Balance</p>
                                    <p className="text-4xl font-black">{formatCurrency(walletBalance)}</p>
                                </div>
                                <div className="flex gap-8 pt-4 sm:pt-0 border-t sm:border-t-0 border-gray-800">
                                    <div>
                                        <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
                                            <TrendingUp className="w-3.5 h-3.5" />
                                            <span>Credited</span>
                                        </div>
                                        <p className="font-bold text-lg">{formatCurrency(totalCredited)}</p>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
                                            <TrendingDown className="w-3.5 h-3.5" />
                                            <span>Spent</span>
                                        </div>
                                        <p className="font-bold text-lg">{formatCurrency(totalDebited)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Universal Manual Top Up Instructions */}
            <Card id="quick-topup-card" className="border-2 border-gray-100 bg-white overflow-hidden shadow-xl">
                <CardHeader className="bg-white py-4 border-b border-gray-50">
                    <div className="flex flex-col text-left">
                        <CardTitle className="text-black text-lg sm:text-xl font-semibold flex items-center gap-2">
                            <Plus className="w-5 h-5 text-[#FACC15]" />
                            Quick Top Up
                        </CardTitle>
                        <span className="text-xs sm:text-sm font-bold text-[#25D366] ml-7">No Paystack Charges (Manual Approval)</span>
                    </div>
                </CardHeader>
                <CardContent className="pt-8 space-y-8">
                    <div className="space-y-8">
                        {/* Step 1 */}
                        <div className="flex gap-5">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#FACC15] flex items-center justify-center text-sm font-bold text-black shadow-sm">1</div>
                            <div className="text-sm sm:text-base font-medium text-black leading-relaxed pt-1">
                                Send payment via Mobile Money:
                                <div className="mt-2 space-y-2">
                                    {[
                                        { label: 'MTN', value: '0551617309' },
                                        { label: 'Telecel', value: '0507193592' },
                                        { label: 'Name', value: 'Felix Boahen' }
                                    ].map((item) => (
                                        <div key={item.label} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200 group">
                                            <span className="text-xs font-bold text-gray-500 uppercase">{item.label}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-yellow-700">{item.value}</span>
                                                <Button
                                                    variant="ghost" size="icon" className="h-6 w-6"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(item.value)
                                                        toast.success(`${item.label} copied!`)
                                                    }}
                                                >
                                                    <Copy className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="flex gap-5">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#FACC15] flex items-center justify-center text-sm font-bold text-black shadow-sm">2</div>
                            <div className="space-y-4 pt-1 flex-1">
                                <p className="text-sm sm:text-base font-medium text-black leading-relaxed">
                                    Use the reference below for instant detection, or send your receipt via WhatsApp/SMS.
                                </p>
                                
                                <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-between group">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Required Reference</span>
                                        <span className="text-base font-black text-blue-900 tracking-tight">
                                            {dbUser?.first_name} {dbUser?.last_name || ''}
                                        </span>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="bg-white border-blue-200 hover:bg-blue-100 text-blue-600 font-bold gap-2"
                                        onClick={() => {
                                            const ref = `${dbUser?.first_name} ${dbUser?.last_name || ''}`.trim()
                                            navigator.clipboard.writeText(ref)
                                            toast.success('Reference copied!')
                                        }}
                                    >
                                        <Copy className="w-4 h-4" />
                                        Copy
                                    </Button>
                                </div>

                                <div className="flex flex-wrap items-center gap-6 mt-4">
                                    <Link
                                        href={`sms:0551617309?body=Please I have sent the money so credit my account for me, account name is: ${dbUser?.first_name} ${dbUser?.last_name || dbUser?.email || 'N/A'}`}
                                        className="group flex flex-col items-center gap-2"
                                    >
                                        <div className="p-3 rounded-full hover:bg-blue-50 transition-colors">
                                            <MessageCircle className="w-8 h-8 text-[#007AFF]" strokeWidth={2} />
                                        </div>
                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter group-hover:text-[#007AFF]">tap here to send sms</span>
                                    </Link>
                                    <Link
                                        href={`https://wa.me/233551617309?text=${encodeURIComponent(`Please I have sent the money so credit my account for me, account name is: ${dbUser?.first_name} ${dbUser?.last_name || dbUser?.email || 'N/A'}`)}`}
                                        target="_blank"
                                        className="group flex flex-col items-center gap-2"
                                    >
                                        <div className="p-3 rounded-full hover:bg-green-50 transition-colors">
                                            <MessageCircle className="w-8 h-8 text-[#25D366]" strokeWidth={2} />
                                        </div>
                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter group-hover:text-[#25D366]">tap here to send whatsapp</span>
                                    </Link>
                                </div>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div className="flex gap-5">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#FACC15] flex items-center justify-center text-sm font-bold text-black shadow-sm">3</div>
                            <p className="text-sm sm:text-base font-medium text-black leading-relaxed pt-1">
                                Wait for Admin final approval message and refresh your page thank you (Credit is Instant after Approval).
                            </p>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-gray-50">
                        <div className="inline-flex items-center gap-2 text-yellow-600 bg-yellow-50 px-4 py-2 rounded-xl">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-sm font-bold uppercase tracking-wide">
                                Minimum Amount: GH₵ 10.00
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>




            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className={dbUser?.role === 'agent' ? 'lg:col-span-3' : 'lg:col-span-1'}>
                    <Card className={cn("overflow-hidden", dbUser?.role === 'agent' && "hidden")}>
                        <div className="bg-[#FACC15] p-6 text-[#1A1A1A]">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <Wallet className="w-6 h-6" />
                                    <span className="font-medium">Your Wallet</span>
                                </div>
                                <Badge className="bg-[#1A1A1A]/10 text-[#1A1A1A] border-0">Active</Badge>
                            </div>
                            <p className="text-sm text-[#1A1A1A]/70 mb-1">Available Balance</p>
                            <p className="text-4xl font-bold mb-6">{formatCurrency(walletBalance)}</p>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#1A1A1A]/10">
                                <div>
                                    <div className="flex items-center gap-1 text-[#1A1A1A]/70 text-sm mb-1">
                                        <TrendingUp className="w-4 h-4" />
                                        <span>Credited</span>
                                    </div>
                                    <p className="font-semibold">{formatCurrency(totalCredited)}</p>
                                </div>
                                <div>
                                    <div className="flex items-center gap-1 text-[#1A1A1A]/70 text-sm mb-1">
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
                <div id="top-up-form" className={dbUser?.role === 'agent' ? 'lg:col-span-3' : 'lg:col-span-2'}>
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col">
                                <CardTitle className="text-base sm:text-lg flex items-center gap-2 font-semibold text-black">
                                    <Plus className="w-5 h-5 text-blue-600" />
                                    Top Up Wallet
                                </CardTitle>
                                {dbUser?.role === 'agent' && (
                                    <span className="text-xs sm:text-sm font-bold text-[#E60000] ml-7">Paystack Charges Applied</span>
                                )}
                            </div>
                            <CardDescription className="mt-2">
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
                                            <span className="text-muted-foreground">Transaction fee ({paystackFeePercent}%)</span>
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
            <Card id="recent-activity">
                <CardHeader>
                    <CardTitle>{dbUser?.role === 'agent' ? 'Recent Activity' : 'Today'}</CardTitle>
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
