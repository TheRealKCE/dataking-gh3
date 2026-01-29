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
            <div className="flex flex-col items-center gap-4 text-center">
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
            <div className="relative max-w-md mx-auto w-full">
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 scroll-smooth">
                            {filteredPackages.map((pkg) => {
                                const getBuyButtonStyle = () => {
                                    if (pkg.network === 'Telecel') {
                                        return 'bg-[#FFFFFF] text-[#E60000] hover:bg-gray-100 border-0 shadow-lg hover:shadow-xl transition-all hover:scale-105 font-bold px-6'
                                    }
                                    if (pkg.network.startsWith('AT')) {
                                        return 'bg-[#FFFFFF] text-[#0056B3] hover:bg-gray-100 border-0 shadow-lg hover:shadow-xl transition-all hover:scale-105 font-bold px-6'
                                    }
                                    return 'bg-[#1a1a1a] text-white hover:bg-black border-0 shadow-lg hover:shadow-xl transition-all hover:scale-105 font-bold px-6'
                                }

                                return (
                                    <Card
                                        key={pkg.id}
                                        className={`group overflow-hidden relative transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl cursor-pointer border-0 ${pkg.network === 'MTN' ? 'bg-[#FACC15] text-black' :
                                            pkg.network === 'Telecel' ? 'bg-[#E60000] text-white' :
                                                'bg-[#0056B3] text-white'
                                            }`}
                                        onClick={() => handlePurchaseClick(pkg)}
                                    >
                                        <CardContent className="p-4 flex flex-col h-full justify-between">
                                            <div>
                                                <div className="flex items-start justify-between mb-3 pb-2 border-b border-black/10 dark:border-white/10">
                                                    <div className="p-1.5 bg-white/20 rounded-xl backdrop-blur-sm">
                                                        <NetworkIcon network={pkg.network} size={36} variant="card" />
                                                    </div>
                                                    <Badge variant="outline" className={`text-[10px] font-bold px-2 py-0.5 border-current uppercase tracking-wider ${pkg.network === 'MTN' ? 'text-black border-black/20' : 'text-white border-white/20'
                                                        }`}>
                                                        {pkg.network}
                                                    </Badge>
                                                </div>

                                                <div className="mb-3 space-y-1">
                                                    <h3 className="text-2xl font-black tracking-tight">{pkg.size}</h3>
                                                    <p className={`text-xs font-medium line-clamp-1 ${pkg.network === 'MTN' ? 'text-black/70' : 'text-white/80'
                                                        }`}>
                                                        {pkg.description || `${pkg.size} data bundle for ${pkg.network}`}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-3 border-t border-black/5 dark:border-white/10">
                                                <span className="text-xl font-black tracking-tight">{formatCurrency(pkg.price)}</span>
                                                <Button
                                                    size="sm"
                                                    className={getBuyButtonStyle()}
                                                >
                                                    Buy Now
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="space-y-3 scroll-smooth">
                            {filteredPackages.map((pkg) => {
                                const getBuyButtonStyle = () => {
                                    if (pkg.network === 'Telecel') {
                                        return 'bg-[#FFFFFF] text-[#E60000] hover:bg-gray-100 border-0 shadow-md hover:shadow-lg transition-all hover:scale-105 font-bold px-6'
                                    }
                                    if (pkg.network.startsWith('AT')) {
                                        return 'bg-[#FFFFFF] text-[#0056B3] hover:bg-gray-100 border-0 shadow-md hover:shadow-lg transition-all hover:scale-105 font-bold px-6'
                                    }
                                    return 'bg-[#1a1a1a] text-white hover:bg-black border-0 shadow-md hover:shadow-lg transition-all hover:scale-105 font-bold px-6'
                                }

                                return (
                                    <Card
                                        key={pkg.id}
                                        className={`group hover:shadow-lg transition-all cursor-pointer border-0 mb-3 overflow-hidden ${pkg.network === 'MTN' ? 'bg-[#FACC15] text-black' :
                                            pkg.network === 'Telecel' ? 'bg-[#E60000] text-white' :
                                                'bg-[#0056B3] text-white'
                                            }`}
                                        onClick={() => handlePurchaseClick(pkg)}
                                    >
                                        <CardContent className="p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-5">
                                                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm shadow-sm">
                                                    <NetworkIcon network={pkg.network} size={40} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <h3 className="font-bold text-lg leading-none">{pkg.size}</h3>
                                                        <Badge variant="outline" className={`text-[10px] font-bold px-2 py-0.5 border-current ${pkg.network === 'MTN' ? 'text-black border-black/20' : 'text-white border-white/20'
                                                            }`}>
                                                            {pkg.network}
                                                        </Badge>
                                                    </div>
                                                    <p className={`text-xs font-medium ${pkg.network === 'MTN' ? 'text-black/70' : 'text-white/80'
                                                        }`}>
                                                        {pkg.description || 'Data Bundle'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <span className="text-xl font-black">{formatCurrency(pkg.price)}</span>
                                                <Button
                                                    size="sm"
                                                    className={getBuyButtonStyle()}
                                                >
                                                    Buy
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })}
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
