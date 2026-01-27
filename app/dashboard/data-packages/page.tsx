'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatCurrency, getNetworkGradient } from '@/lib/utils'
import { validateGhanaianPhone, detectNetwork } from '@/lib/phone-validation'
import { NetworkIcon } from '@/components/network-icon'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
    Search,
    LayoutGrid,
    List,
    Wifi,
    Loader2,
    CheckCircle2,
    AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { DataPackage } from '@/types/supabase'

const NETWORKS = ['MTN', 'Telecel', 'AT-iShare', 'AT-BigTime'] as const

export default function DataPackagesPage() {
    const { dbUser, session } = useAuth()
    const [packages, setPackages] = useState<DataPackage[]>([])
    const [filteredPackages, setFilteredPackages] = useState<DataPackage[]>([])
    const [selectedNetwork, setSelectedNetwork] = useState<string>('MTN')
    const [searchQuery, setSearchQuery] = useState('')
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [isLoading, setIsLoading] = useState(true)
    const [walletBalance, setWalletBalance] = useState(0)

    // Purchase dialog state
    const [selectedPackage, setSelectedPackage] = useState<DataPackage | null>(null)
    const [phoneNumber, setPhoneNumber] = useState('')
    const [phoneError, setPhoneError] = useState('')
    const [isPurchasing, setIsPurchasing] = useState(false)
    const [purchaseSuccess, setPurchaseSuccess] = useState(false)

    useEffect(() => {
        fetchPackages()
        fetchWalletBalance()
    }, [dbUser])

    useEffect(() => {
        filterPackages()
    }, [packages, selectedNetwork, searchQuery])

    const fetchPackages = async () => {
        try {
            const { data, error } = await supabase
                .from('data_packages')
                .select('*')
                .eq('is_available', true)
                .order('sort_order', { ascending: true })

            if (error) throw error
            setPackages(data || [])
        } catch (error) {
            console.error('Error fetching packages:', error)
            toast.error('Failed to load packages')
        } finally {
            setIsLoading(false)
        }
    }

    const fetchWalletBalance = async () => {
        if (!dbUser) return

        const { data } = await supabase
            .from('wallets')
            .select('balance')
            .eq('user_id', dbUser.id)
            .single()

        setWalletBalance((data as any)?.balance || 0)
    }

    const filterPackages = () => {
        let filtered = packages

        // Filter by network
        filtered = filtered.filter(p => p.network === selectedNetwork)

        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            filtered = filtered.filter(p =>
                p.size.toLowerCase().includes(query) ||
                p.network.toLowerCase().includes(query) ||
                p.description?.toLowerCase().includes(query)
            )
        }

        setFilteredPackages(filtered)
    }

    const handlePurchaseClick = (pkg: DataPackage) => {
        setSelectedPackage(pkg)
        setPhoneNumber('')
        setPhoneError('')
        setPurchaseSuccess(false)
    }

    const handlePhoneChange = (value: string) => {
        setPhoneNumber(value)
        setPhoneError('')

        if (value.length >= 10) {
            const validation = validateGhanaianPhone(value)
            if (!validation.isValid) {
                setPhoneError(validation.error || 'Invalid phone number')
            } else if (selectedPackage) {
                // Check if network matches
                const detectedNet = detectNetwork(value)
                const packageNetwork = selectedPackage.network.includes('AT') ? 'AirtelTigo' : selectedPackage.network
                if (detectedNet !== packageNetwork && selectedPackage.network !== 'AT-BigTime') {
                    setPhoneError(`This number is for ${detectedNet}, not ${selectedPackage.network}`)
                }
            }
        }
    }

    const handlePurchase = async () => {
        if (!selectedPackage || !dbUser) return

        const validation = validateGhanaianPhone(phoneNumber)
        if (!validation.isValid) {
            setPhoneError(validation.error || 'Invalid phone number')
            return
        }

        if (walletBalance < selectedPackage.price) {
            setPhoneError('Insufficient wallet balance')
            return
        }

        setIsPurchasing(true)

        try {
            const response = await fetch('/api/orders/purchase', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    packageId: selectedPackage.id,
                    phoneNumber: validation.normalizedNumber,
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Purchase failed')
            }

            setPurchaseSuccess(true)
            setWalletBalance(prev => prev - selectedPackage.price)
            toast.success('Order placed successfully!')
        } catch (error: any) {
            toast.error(error.message || 'Failed to place order')
        } finally {
            setIsPurchasing(false)
        }
    }

    // const getNetworkIcon = (network: string) => { ... } // Removed in favor of component

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-12 w-full max-w-md" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => (
                        <Skeleton key={i} className="h-48" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Data Packages</h1>
                    <p className="text-muted-foreground">
                        Wallet Balance: <span className="font-semibold text-primary">{formatCurrency(walletBalance)}</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant={viewMode === 'grid' ? 'default' : 'outline'}
                        size="icon"
                        onClick={() => setViewMode('grid')}
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </Button>
                    <Button
                        variant={viewMode === 'list' ? 'default' : 'outline'}
                        size="icon"
                        onClick={() => setViewMode('list')}
                    >
                        <List className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    placeholder="Search packages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                />
            </div>

            {/* Network Tabs */}
            <Tabs value={selectedNetwork} onValueChange={setSelectedNetwork}>
                <TabsList className="grid grid-cols-4 gap-1 sm:gap-2 w-full">
                    {NETWORKS.map((network) => {
                        const getNetworkColor = () => {
                            if (network === 'MTN') return 'data-[state=active]:bg-[#FACC15] data-[state=active]:text-black'
                            if (network === 'Telecel') return 'data-[state=active]:bg-[#E60000] data-[state=active]:text-white'
                            return 'data-[state=active]:bg-[#0056B3] data-[state=active]:text-white'
                        }

                        return (
                            <TabsTrigger
                                key={network}
                                value={network}
                                className={`flex items-center justify-center gap-1 text-xs sm:text-sm px-2 py-2 ${getNetworkColor()}`}
                            >
                                <NetworkIcon network={network} size={24} className="mr-1" />
                                <span className="hidden sm:inline">{network}</span>
                                <span className="sm:hidden">{network === 'AT-iShare' ? 'AT-iS' : network === 'AT-BigTime' ? 'AT-BT' : network}</span>
                            </TabsTrigger>
                        )
                    })}
                </TabsList>

                <TabsContent value={selectedNetwork} className="mt-6">
                    {filteredPackages.length === 0 ? (
                        <Card className="p-12 text-center">
                            <Wifi className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                            <p className="text-muted-foreground">No packages found</p>
                        </Card>
                    ) : viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredPackages.map((pkg) => (
                                <Card
                                    key={pkg.id}
                                    className="group overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer border hover:border-primary/50"
                                    onClick={() => handlePurchaseClick(pkg)}
                                >
                                    <CardContent className="p-6">
                                        <div className="flex items-start justify-between mb-4">
                                            <NetworkIcon network={pkg.network} size={40} />
                                            <Badge variant="outline" className="border-current">
                                                {pkg.network}
                                            </Badge>
                                        </div>
                                        <h3 className="text-2xl font-bold mb-2">{pkg.size}</h3>
                                        <p className="text-sm mb-4 line-clamp-2 text-muted-foreground">
                                            {pkg.description || `${pkg.size} data bundle for ${pkg.network}`}
                                        </p>
                                        <div className="flex items-center justify-between">
                                            <span className="text-2xl font-bold">{formatCurrency(pkg.price)}</span>
                                            <Button size="sm" className="transition-colors">
                                                Buy Now
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredPackages.map((pkg) => (
                                <Card
                                    key={pkg.id}
                                    className="group hover:shadow-lg transition-all cursor-pointer border hover:border-primary/50"
                                    onClick={() => handlePurchaseClick(pkg)}
                                >
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center justify-center">
                                                <NetworkIcon network={pkg.network} size={48} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold">{pkg.size}</h3>
                                                    <Badge variant="outline" className="text-xs border-current">
                                                        {pkg.network}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground">{pkg.description}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-xl font-bold">{formatCurrency(pkg.price)}</span>
                                            <Button size="sm">Buy</Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Purchase Dialog */}
            <Dialog open={!!selectedPackage} onOpenChange={() => setSelectedPackage(null)}>
                <DialogContent>
                    {purchaseSuccess ? (
                        <div className="text-center py-6">
                            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-8 h-8 text-green-600" />
                            </div>
                            <DialogTitle className="text-xl mb-2">Order Placed Successfully!</DialogTitle>
                            <DialogDescription>
                                {selectedPackage?.size} has been ordered for {phoneNumber}.
                                Your data will be delivered shortly.
                            </DialogDescription>
                            <Button className="mt-6" onClick={() => setSelectedPackage(null)}>
                                Done
                            </Button>
                        </div>
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <span className="flex items-center justify-center">
                                        <NetworkIcon network={selectedPackage?.network || ''} size={32} />
                                    </span>
                                    Buy {selectedPackage?.size}
                                </DialogTitle>
                                <DialogDescription>
                                    Enter the phone number to receive the data bundle
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-4">
                                <div className="p-4 rounded-xl bg-muted/50">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm text-muted-foreground">Package</span>
                                        <Badge>{selectedPackage?.network}</Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-lg font-semibold">{selectedPackage?.size}</span>
                                        <span className="text-lg font-bold text-primary">
                                            {selectedPackage && formatCurrency(selectedPackage.price)}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone Number</Label>
                                    <Input
                                        id="phone"
                                        type="tel"
                                        placeholder="0241234567"
                                        value={phoneNumber}
                                        onChange={(e) => handlePhoneChange(e.target.value)}
                                        className={phoneError ? 'border-red-500' : ''}
                                    />
                                    {phoneError && (
                                        <p className="text-sm text-red-500 flex items-center gap-1">
                                            <AlertCircle className="w-4 h-4" />
                                            {phoneError}
                                        </p>
                                    )}
                                </div>

                                {walletBalance < (selectedPackage?.price || 0) && (
                                    <Alert variant="destructive">
                                        <AlertCircle className="w-4 h-4" />
                                        <AlertDescription>
                                            Insufficient balance. Please top up your wallet.
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <div className="text-sm text-muted-foreground">
                                    Wallet Balance: <span className="font-medium text-foreground">{formatCurrency(walletBalance)}</span>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setSelectedPackage(null)}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handlePurchase}
                                    disabled={isPurchasing || !phoneNumber || !!phoneError || walletBalance < (selectedPackage?.price || 0)}
                                >
                                    {isPurchasing ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        `Pay ${selectedPackage && formatCurrency(selectedPackage.price)}`
                                    )}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
