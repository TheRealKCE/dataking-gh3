'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Loader2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function AFAOrdersPage() {
    const { dbUser } = useAuth()
    const [formData, setFormData] = useState({
        full_name: '',
        phone: '',
        ghana_card: '',
        location: '',
        region: 'Greater Accra',
        occupation: '',
        notes: ''
    })
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [applicationStatus, setApplicationStatus] = useState<string | null>(null)
    const [applicationPrice, setApplicationPrice] = useState(0)
    const [walletBalance, setWalletBalance] = useState(0)
    const [loadingPrice, setLoadingPrice] = useState(true)

    useEffect(() => {
        checkExistingApplication()
        fetchApplicationPrice()
        fetchWalletBalance()
    }, [dbUser])

    const fetchApplicationPrice = async () => {
        try {
            const { data, error } = await supabase
                .from('admin_settings')
                .select('key, value')
                .in('key', ['afa_price_customer', 'afa_price_agent'])

            if (error) throw error

            const settings = data?.reduce((acc: any, curr: any) => {
                acc[curr.key] = curr.value
                return acc
            }, {})

            const userRole = dbUser?.role || 'customer'
            const price = userRole === 'agent'
                ? parseFloat(settings?.afa_price_agent || '10')
                : parseFloat(settings?.afa_price_customer || '10')

            setApplicationPrice(price)
        } catch (error) {
            console.error('Error fetching AFA price:', error)
            setApplicationPrice(15) // Default fallback
        } finally {
            setLoadingPrice(false)
        }
    }

    const fetchWalletBalance = async () => {
        if (!dbUser?.id) return
        try {
            const { data } = await (supabase
                .from('wallets')
                .select('balance')
                .eq('user_id', dbUser.id)
                .single() as any)

            if (data) setWalletBalance(data.balance || 0)
        } catch (error) {
            console.error('Error fetching wallet balance:', error)
        }
    }

    const checkExistingApplication = async () => {
        if (!dbUser) return
        const { data } = await supabase
            .from('afa_orders')
            .select('status')
            .eq('user_id', dbUser.id)
            .single()

        if (data) {
            setApplicationStatus((data as any).status)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)

        try {
            // Check wallet balance
            if (walletBalance < applicationPrice) {
                toast.error(`Insufficient balance. You need GHS ${applicationPrice.toFixed(2)} but have GHS ${walletBalance.toFixed(2)}`)
                setIsSubmitting(false)
                return
            }

            // Get user's wallet
            const { data: wallet, error: walletError } = await (supabase
                .from('wallets')
                .select('*')
                .eq('user_id', dbUser!.id)
                .single() as any)

            if (walletError || !wallet) {
                toast.error('Failed to access wallet')
                setIsSubmitting(false)
                return
            }

            // Deduct payment from wallet
            const newBalance = (wallet as any).balance - applicationPrice
            const { error: debitError } = await (supabase
                .from('wallets') as any)
                .update({
                    balance: newBalance,
                    total_spent: ((wallet as any).total_spent || 0) + applicationPrice,
                    updated_at: new Date().toISOString()
                })
                .eq('id', (wallet as any).id)

            if (debitError) {
                toast.error('Failed to process payment')
                setIsSubmitting(false)
                return
            }

            // Create wallet transaction
            await (supabase.from('wallet_transactions') as any).insert({
                wallet_id: (wallet as any).id,
                user_id: dbUser?.id,
                type: 'debit',
                amount: applicationPrice,
                description: `AFA Application Fee`,
                source: 'afa_application',
                status: 'completed'
            })

            // Submit application
            const { error } = await (supabase.from('afa_orders') as any).insert({
                user_id: dbUser?.id,
                ...formData,
                status: 'pending',
                payment_amount: applicationPrice
            })

            if (error) {
                // Rollback wallet deduction if application insert fails
                await (supabase
                    .from('wallets') as any)
                    .update({
                        balance: (wallet as any).balance,
                        total_spent: (wallet as any).total_spent,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', (wallet as any).id)

                throw error
            }

            toast.success('Application submitted successfully!')
            setApplicationStatus('pending')
            setWalletBalance(newBalance)
        } catch (error) {
            console.error('Error submitting application:', error)
            toast.error('Failed to submit application')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (applicationStatus) {
        return (
            <div className="max-w-xl mx-auto py-12">
                <Card>
                    <CardHeader className="text-center">
                        <CardTitle>Application Status</CardTitle>
                        <CardDescription>
                            Your Authorized Field Agent application
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
                            <Users className="w-8 h-8 text-blue-600" />
                        </div>
                        <h2 className="text-2xl font-bold capitalize">{applicationStatus}</h2>
                        <p className="text-muted-foreground">
                            {applicationStatus === 'pending'
                                ? 'Your application is currently under review by our team. We will contact you shortly.'
                                : applicationStatus === 'completed'
                                    ? 'Congratulations! You are now an authorized agent.'
                                    : 'Your application has been processed.'}
                        </p>
                        <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
                            Back to Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold">Become an Agent</h1>
                <p className="text-muted-foreground mt-2">
                    Apply to become an Authorized Field Agent (AFA) and earn commissions
                </p>
            </div>

            {/* Price and Balance Card */}
            {loadingPrice ? (
                <Card>
                    <CardContent className="p-6 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin" />
                    </CardContent>
                </Card>
            ) : (
                <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-800">
                    <CardContent className="p-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground mb-1">Application Fee</p>
                                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                                    GHS {applicationPrice.toFixed(2)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground mb-1">Your Balance</p>
                                <p className={`text-2xl font-bold ${walletBalance >= applicationPrice ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    GHS {walletBalance.toFixed(2)}
                                </p>
                            </div>
                        </div>
                        {walletBalance < applicationPrice ? (
                            <Alert className="mt-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                                <AlertDescription className="text-sm text-red-800 dark:text-red-300">
                                    ⚠️ Insufficient balance. Please top up your wallet to proceed with the application.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <p className="text-sm text-muted-foreground mt-4">
                                ✓ Balance after payment: <span className="font-semibold">GHS {(walletBalance - applicationPrice).toFixed(2)}</span>
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Application Form</CardTitle>
                    <CardDescription>Please provide accurate details</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Full Name</Label>
                                <Input
                                    required
                                    value={formData.full_name}
                                    onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))}
                                    placeholder="John Doe"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Phone Number</Label>
                                <Input
                                    required
                                    type="tel"
                                    value={formData.phone}
                                    onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                                    placeholder="024xxxxxxx"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Ghana Card Number</Label>
                            <Input
                                required
                                value={formData.ghana_card}
                                onChange={e => setFormData(p => ({ ...p, ghana_card: e.target.value }))}
                                placeholder="GHA-xxxxxxxxx-x"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Region</Label>
                                <Select
                                    value={formData.region}
                                    onValueChange={v => setFormData(p => ({ ...p, region: v }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Greater Accra">Greater Accra</SelectItem>
                                        <SelectItem value="Ashanti">Ashanti</SelectItem>
                                        <SelectItem value="Western">Western</SelectItem>
                                        <SelectItem value="Eastern">Eastern</SelectItem>
                                        <SelectItem value="Central">Central</SelectItem>
                                        <SelectItem value="Northern">Northern</SelectItem>
                                        <SelectItem value="Volta">Volta</SelectItem>
                                        {/* Add others as needed */}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>City/Town</Label>
                                <Input
                                    required
                                    value={formData.location}
                                    onChange={e => setFormData(p => ({ ...p, location: e.target.value }))}
                                    placeholder="Accra"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Occupation</Label>
                            <Input
                                required
                                value={formData.occupation}
                                onChange={e => setFormData(p => ({ ...p, occupation: e.target.value }))}
                                placeholder="Student, Trader, etc."
                            />
                        </div>

                        <Alert className="bg-blue-50 dark:bg-blue-900/10 border-blue-200">
                            <AlertDescription className="text-sm text-blue-800 dark:text-blue-300">
                                By submitting this form, you agree to pay GHS {applicationPrice.toFixed(2)} from your wallet for the AFA application processing fee.
                            </AlertDescription>
                        </Alert>

                        <Button
                            type="submit"
                            className="w-full"
                            disabled={isSubmitting || loadingPrice || walletBalance < applicationPrice}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Processing Payment...
                                </>
                            ) : walletBalance < applicationPrice ? (
                                <>Insufficient Balance - Top Up Wallet</>
                            ) : (
                                <>Submit Application & Pay GHS {applicationPrice.toFixed(2)}</>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
