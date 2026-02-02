'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatCurrency, getNetworkGradient, cn } from '@/lib/utils'
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
    AlertCircle,
    ShoppingCart,
    Plus
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { DataPackage } from '@/types/supabase'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, Upload } from 'lucide-react'

interface ValidationResult {
    lineNumber: number
    phoneNumber: string
    volume: number
    packagePrice: number
    isValid: boolean
    errorMessage?: string
    packageId?: string
    packageName?: string
}


const NETWORKS = ['MTN', 'Telecel', 'AT-iShare', 'AT-BigTime'] as const

export default function DataPackagesPage() {
    const { dbUser, session } = useAuth()
    const router = useRouter()
    const [packages, setPackages] = useState<DataPackage[]>([])
    const [filteredPackages, setFilteredPackages] = useState<DataPackage[]>([])
    const [selectedNetwork, setSelectedNetwork] = useState<string>('MTN')
    const [searchQuery, setSearchQuery] = useState('')
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [isLoading, setIsLoading] = useState(true)
    const [walletBalance, setWalletBalance] = useState(0)

    const [ordersToday, setOrdersToday] = useState(0)

    // Purchase dialog state
    const [selectedPackage, setSelectedPackage] = useState<DataPackage | null>(null)
    const [phoneNumber, setPhoneNumber] = useState('')
    const [phoneError, setPhoneError] = useState('')
    const [isPurchasing, setIsPurchasing] = useState(false)
    const [purchaseSuccess, setPurchaseSuccess] = useState(false)

    // Bulk Order State
    const [bulkText, setBulkText] = useState('')
    const [bulkNetwork, setBulkNetwork] = useState<string>('')
    const [validationResults, setValidationResults] = useState<ValidationResult[]>([])
    const [isValidating, setIsValidating] = useState(false)
    const [isSubmittingBulk, setIsSubmittingBulk] = useState(false)


    useEffect(() => {
        fetchPackages()
        fetchWalletBalance()
        fetchOrdersToday()
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

    const fetchOrdersToday = async () => {
        if (!dbUser) return

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const { count, error } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', dbUser.id)
            .gte('created_at', today.toISOString())
            .neq('status', 'failed')

        if (!error) {
            setOrdersToday(count || 0)
        }
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

    // Helper function to get effective price based on user role
    const getEffectivePrice = (pkg: DataPackage) => {
        // If user is agent AND agent_price is set (> 0), use agent_price
        if (dbUser?.role === 'agent' && (pkg as any).agent_price > 0) {
            return (pkg as any).agent_price
        }
        return pkg.price
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

        const effectivePrice = getEffectivePrice(selectedPackage)

        if (walletBalance < effectivePrice) {
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
            setWalletBalance(prev => prev - effectivePrice)
            setOrdersToday(prev => prev + 1)
            toast.success('Order placed successfully!')
        } catch (error: any) {
            toast.error(error.message || 'Failed to place order')
        } finally {
            setIsPurchasing(false)
        }
    }

    // Bulk Order Functions
    const parseTextInput = (text: string) => {
        const lines = text.trim().split('\n')
        return lines
            .map((line, index) => {
                const trimmed = line.trim()
                if (!trimmed) return null

                // Split by spaces or tabs
                const parts = trimmed.split(/\s+/)
                if (parts.length < 2) return null

                // Assuming format: phone volume (e.g., "0551234567 1")
                // Handle 1GB, 1gb, 1 etc.
                const phone = parts[0]
                const volStr = parts[1].toLowerCase().replace('gb', '')
                const volume = parseFloat(volStr)

                return {
                    lineNumber: index + 1,
                    phoneNumber: phone,
                    volume: volume,
                    rawLine: trimmed
                }
            })
            .filter(Boolean)
    }

    const handleValidateBulk = async () => {
        if (!bulkNetwork) {
            toast.error('Please select a network first')
            return
        }
        if (!bulkText.trim()) {
            toast.error('Please enter phone numbers')
            return
        }

        setIsValidating(true)
        const parsedLines = parseTextInput(bulkText)

        const results: ValidationResult[] = parsedLines.map((line: any) => {
            // Validate phone
            const phoneValidation = validateGhanaianPhone(line.phoneNumber)
            if (!phoneValidation.isValid) {
                return {
                    ...line,
                    packagePrice: 0,
                    isValid: false,
                    errorMessage: 'Invalid phone number'
                }
            }

            // Check network match
            const detectedNet = detectNetwork(line.phoneNumber)
            // Handle AT network variations
            const targetNet = bulkNetwork === 'AT-BigTime' || bulkNetwork === 'AT-iShare' ? 'AirtelTigo' : bulkNetwork
            if (detectedNet !== targetNet) {
                return {
                    ...line,
                    packagePrice: 0,
                    isValid: false,
                    errorMessage: `Wrong network (${detectedNet})`
                }
            }

            // Find package
            // Match volume (e.g. 1 -> 1GB, 0.5 -> 500MB is harder without exact match, assume GB for now as per prompt example)
            // User prompt example: "0551053716 1" -> 1GB

            // Try to find package with exact size match first (e.g. "1GB", "1 GB")
            const pkg = packages.find(p => {
                if (p.network !== bulkNetwork) return false
                // Extract number from size string "1GB" -> 1
                const pkgSize = p.size.toLowerCase()

                // Handle different size formats
                if (pkgSize.includes('gb')) {
                    const sizeVal = parseFloat(pkgSize.replace('gb', '').trim())
                    return sizeVal === line.volume
                } else if (pkgSize.includes('mb')) {
                    // If input is < 1, might be meant as parts of GB? 
                    // Or input "1" implies 1GB. Protocol: Input is in GB.
                    // 1000MB = 1GB
                    const sizeVal = parseFloat(pkgSize.replace('mb', '').trim())
                    return sizeVal / 1000 === line.volume
                }
                return false
            })

            if (!pkg) {
                return {
                    ...line,
                    packagePrice: 0,
                    isValid: false,
                    errorMessage: `No ${line.volume}GB package found`
                }
            }

            return {
                ...line,
                packagePrice: getEffectivePrice(pkg),
                packageId: pkg.id,
                packageName: pkg.network + ' ' + pkg.size,
                isValid: true
            }
        })

        setValidationResults(results)
        setIsValidating(false)
        if (results.length > 0) {
            toast.success(`Validated ${results.length} entries`)
        } else {
            toast.error('No valid lines found')
        }
    }

    const clearInvalid = () => {
        setValidationResults(prev => prev.filter(r => r.isValid))
    }

    const clearAllResults = () => {
        setValidationResults([])
        setBulkText('')
    }

    const handleSubmitBulkOrder = async () => {
        const validOrders = validationResults.filter(r => r.isValid)
        if (validOrders.length === 0) return

        const totalCost = validOrders.reduce((sum, order) => sum + order.packagePrice, 0)
        if (walletBalance < totalCost) {
            toast.error(`Insufficient balance. Need GHS ${formatCurrency(totalCost)}`)
            return
        }

        setIsSubmittingBulk(true)
        let successCount = 0
        let failCount = 0

        try {
            // Process sequentially to be safe with wallet balance and order creation
            for (const order of validOrders) {
                try {
                    const response = await fetch('/api/orders/purchase', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session?.access_token}`
                        },
                        body: JSON.stringify({
                            packageId: order.packageId,
                            phoneNumber: validateGhanaianPhone(order.phoneNumber).normalizedNumber,
                        }),
                    })

                    if (response.ok) {
                        successCount++
                    } else {
                        failCount++
                    }
                } catch (e) {
                    failCount++
                }
            }

            // Update stats
            fetchWalletBalance()
            fetchOrdersToday()

            if (successCount > 0) {
                toast.success(`Submitted ${successCount} orders successfully`)
                setValidationResults([])
                setBulkText('')
                setBulkNetwork('')
            }
            if (failCount > 0) {
                toast.error(`${failCount} orders failed to process`)
            }

        } catch (error) {
            toast.error('Error submitting bulk orders')
        } finally {
            setIsSubmittingBulk(false)
        }
    }
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
                <h1 className="text-2xl font-bold">Data Packages</h1>

                {/* Stats Dashboard */}
                <div className="grid grid-cols-2 gap-4 w-full max-w-md mx-auto mb-2">
                    <div className="bg-[#1A1A1A] dark:bg-[#E5E7EB] rounded-2xl p-4 text-center shadow-lg transition-colors flex flex-col items-center justify-between gap-3">
                        <div>
                            <p className="text-[#FACC15] font-medium text-xs mb-1">
                                Wallet Balance
                            </p>
                            <p className="text-[#FACC15] text-xl font-black tracking-tight leading-none">
                                {formatCurrency(walletBalance)}
                            </p>
                        </div>
                        <Button
                            size="sm"
                            className="h-7 text-[10px] uppercase font-bold tracking-wider bg-[#FACC15] text-black hover:bg-[#FACC15]/90 border-0 w-full"
                            onClick={() => router.push('/dashboard/wallet')}
                        >
                            <Plus className="w-3 h-3 mr-1" />
                            Top Up
                        </Button>
                    </div>

                    <div className="bg-[#1A1A1A] dark:bg-[#E5E7EB] rounded-2xl p-4 text-center shadow-lg transition-colors flex flex-col items-center justify-center">
                        <p className="text-[#FACC15] font-medium text-xs mb-1">
                            Orders Today
                        </p>
                        <p className="text-[#FACC15] text-xl font-black tracking-tight leading-none">
                            {ordersToday}
                        </p>
                    </div>
                </div>

                {/* Bulk Order Section - Agents Only */}
                {dbUser?.role === 'agent' && (
                    <Card className="w-full max-w-3xl mx-auto border-dashed border-2 border-[#FFCE00]/30 bg-[#1a1a1a] shadow-2xl">
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                                <Upload className="w-5 h-5 text-[#FFCE00]" />
                                <div className="text-left">
                                    <CardTitle className="text-lg text-[#FFCE00]">Bulk Orders (Excel/Text)</CardTitle>
                                    <p className="text-sm text-[#25D366]">Upload multiple phone numbers at once</p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2 text-left">
                                <Label>Select Network</Label>
                                <div className="flex gap-2 flex-wrap">
                                    {NETWORKS.map(net => (
                                        <Button
                                            key={net}
                                            variant={bulkNetwork === net ? "default" : "outline"}
                                            className={bulkNetwork === net ?
                                                (net === 'MTN' ? 'bg-[#FFCC00] text-black hover:bg-[#FFCC00]/90' :
                                                    net === 'Telecel' ? 'bg-[#E60000] text-white hover:bg-[#E60000]/90' :
                                                        'bg-[#0056B3] text-white hover:bg-[#0056B3]/90')
                                                : ''}
                                            onClick={() => setBulkNetwork(net)}
                                            size="sm"
                                        >
                                            {net}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-2 border-b border-[#FFCE00]/20">
                                <Button
                                    variant="default"
                                    className="rounded-b-none bg-[#FFCE00] hover:bg-[#FFCE00]/90 text-[#1a1a1a] font-bold"
                                    size="sm"
                                >
                                    Text Input
                                </Button>
                                <Button
                                    variant="ghost"
                                    className="rounded-b-none text-gray-500"
                                    size="sm"
                                    disabled
                                >
                                    Excel Upload
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-left block text-[#FFCE00]">Paste numbers and volumes (e.g. 0551053716 1)</Label>
                                <textarea
                                    className="flex min-h-[150px] w-full rounded-md border-0 bg-[#FFCE00] px-3 py-2 text-sm text-[#1a1a1a] placeholder:text-[#1a1a1a]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFCE00] font-mono font-bold"
                                    placeholder="One per line, e.g. 0551053716 1"
                                    value={bulkText}
                                    onChange={(e) => setBulkText(e.target.value)}
                                />
                                <p className="text-xs text-[#25D366] text-left font-medium">
                                    Format: Phone number followed by space and volume in GB
                                </p>
                            </div>

                            <Button
                                className="w-full bg-[#FFCE00] hover:bg-[#FFCE00]/90 text-[#1a1a1a] font-black"
                                onClick={handleValidateBulk}
                                disabled={isValidating}
                            >
                                {isValidating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Validating...
                                    </>
                                ) : 'Validate'}
                            </Button>

                            {/* Validation Results */}
                            {validationResults.length > 0 && (
                                <div className="mt-6 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-bold text-lg text-[#FFCE00]">Validation Results</h3>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-[#FFCE00] border-[#FFCE00]/50 hover:bg-[#FFCE00]/10 bg-transparent"
                                                onClick={clearInvalid}
                                            >
                                                <Trash2 className="w-3 h-3 mr-1" />
                                                Clear Invalid
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-[#E60000] border-[#E60000]/50 hover:bg-[#E60000]/10 bg-transparent"
                                                onClick={clearAllResults}
                                            >
                                                <Trash2 className="w-3 h-3 mr-1" />
                                                Clear All
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="rounded-md border border-[#FFCE00]/20 max-h-[250px] overflow-y-auto overflow-x-auto">
                                        <table className="w-full text-sm min-w-[500px]">
                                            <thead className="bg-black sticky top-0 z-10">
                                                <tr className="border-b border-[#FFCE00]/20">
                                                    <th className="p-3 text-left font-bold text-[#FFCE00]">#</th>
                                                    <th className="p-3 text-left font-bold text-[#FFCE00]">Phone Number</th>
                                                    <th className="p-3 text-left font-bold text-[#FFCE00]">Volume</th>
                                                    <th className="p-3 text-left font-bold text-[#FFCE00]">Price</th>
                                                    <th className="p-3 text-left font-bold text-[#FFCE00]">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#FFCE00]/10">
                                                {validationResults.map((res, i) => (
                                                    <tr key={i} className={cn(
                                                        "transition-colors",
                                                        res.isValid ? 'bg-green-500/5' : 'bg-red-500/5'
                                                    )}>
                                                        <td className="p-3 text-white/70">{res.lineNumber}</td>
                                                        <td className="p-3 font-mono text-white">{res.phoneNumber}</td>
                                                        <td className="p-3 text-white">{res.volume} GB</td>
                                                        <td className="p-3 font-bold text-[#FFCE00]">
                                                            {res.packagePrice > 0 ? formatCurrency(res.packagePrice) : '-'}
                                                        </td>
                                                        <td className="p-3">
                                                            {res.isValid ? (
                                                                <Badge className="bg-green-500/20 text-[#25D366] border border-[#25D366]/30 hover:bg-green-500/30">
                                                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                                                    Valid
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="destructive" className="bg-red-500/20 text-[#E60000] border border-[#E60000]/30 hover:bg-red-500/30">
                                                                    <AlertCircle className="w-3 h-3 mr-1" />
                                                                    {res.errorMessage || 'Invalid'}
                                                                </Badge>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-black/50 p-4 rounded-lg border border-[#FFCE00]/20">
                                        <div className="flex gap-4 text-xs">
                                            <span className="text-white/70">Total: <b className="text-white">{validationResults.length}</b></span>
                                            <span className="text-[#25D366]">Valid: <b>{validationResults.filter(r => r.isValid).length}</b></span>
                                            <span className="text-[#E60000]">Invalid: <b>{validationResults.filter(r => !r.isValid).length}</b></span>
                                        </div>
                                        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                                            <div className="text-right">
                                                <p className="text-[10px] text-[#25D366] font-bold uppercase tracking-wider">Total Cost</p>
                                                <p className="text-xl font-black text-[#FFCE00]">
                                                    {formatCurrency(validationResults.reduce((sum, r) => sum + r.packagePrice, 0))}
                                                </p>
                                            </div>
                                            <Button
                                                className="bg-[#FFCE00] hover:bg-[#FFCE00]/90 text-[#1a1a1a] font-black"
                                                onClick={handleSubmitBulkOrder}
                                                disabled={isSubmittingBulk || validationResults.filter(r => r.isValid).length === 0}
                                            >
                                                {isSubmittingBulk ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                        Wait...
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckCircle2 className="w-4 h-4 mr-2" />
                                                        SUBMIT
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

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
                                return (
                                    <Card
                                        key={pkg.id}
                                        className={`overflow-hidden relative transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl border-0 shadow-lg shadow-black/40 dark:shadow-[#E5E7EB]/20 ${pkg.network === 'MTN' ? 'bg-[#FFCC00] text-black' :
                                            pkg.network === 'Telecel' ? 'bg-[#E60000] text-white' :
                                                'bg-[#0056B3] text-white'
                                            }`}
                                    >
                                        <CardContent className="p-0 flex flex-col h-full">
                                            {/* Top Section: Logo - Size - Badge */}
                                            <div className="flex items-center justify-between p-4 pb-2 relative z-10">
                                                <div className="p-1.5 bg-white/20 rounded-full backdrop-blur-sm shadow-md transition-transform duration-300 group-hover:scale-110">
                                                    <NetworkIcon network={pkg.network} size={28} variant="card" />
                                                </div>

                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                    <h3 className={`text-4xl font-black tracking-tighter drop-shadow-sm ${pkg.network === 'MTN' ? '!text-black' : '!text-white'
                                                        }`}>
                                                        {pkg.size}
                                                    </h3>
                                                </div>

                                                <Badge className={`text-[10px] font-bold px-2 py-0.5 border-none shadow-md uppercase tracking-wider ${pkg.network === 'MTN' ? 'bg-[#004F9F] text-white' :
                                                    'bg-white text-black'
                                                    }`}>
                                                    {pkg.network}
                                                </Badge>
                                            </div>

                                            {/* Middle Content: Price & Description */}
                                            <div className="flex flex-col items-center justify-center flex-1 space-y-3 py-6 relative z-10">
                                                <div className="text-3xl lg:text-4xl font-black tracking-tighter drop-shadow-md transform transition-transform duration-300 group-hover:scale-110">
                                                    {formatCurrency(getEffectivePrice(pkg))}
                                                </div>

                                                <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wide px-4 py-1.5 rounded-full shadow-lg backdrop-blur-md border border-white/10 ${pkg.network === 'MTN' ? 'bg-black/10 text-black' : 'bg-white/10 text-white'
                                                    }`}>
                                                    <span className="animate-spin-pause text-base">⏳</span>
                                                    <span className="flex items-center gap-1">
                                                        Instant Delivery
                                                        <span className="animate-pulse">⚡</span>
                                                    </span>
                                                </div>
                                                {pkg.description && pkg.description !== 'Instant Delivery' && (
                                                    <p className={`text-[10px] font-bold opacity-90 px-4 text-center line-clamp-1`}>
                                                        {pkg.description}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Bottom: Full Width Button */}
                                            <div className="mt-auto pt-2">
                                                <Button
                                                    className={`w-full rounded-t-none rounded-b-xl h-12 text-md font-bold uppercase tracking-widest border-0 rounded-none transition-colors shadow-none ${pkg.network === 'MTN' ? 'bg-[#1a1a1a] text-white hover:bg-black' :
                                                        pkg.network === 'Telecel' ? 'bg-white text-[#E60000] hover:bg-gray-100' :
                                                            'bg-white text-[#0056B3] hover:bg-gray-100'
                                                        }`}
                                                    onClick={() => handlePurchaseClick(pkg)}
                                                >
                                                    <ShoppingCart className="w-4 h-4 mr-2" />
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
                                                <span className="text-xl font-black">{formatCurrency(getEffectivePrice(pkg))}</span>
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
                <DialogContent className="w-[95%] max-w-sm sm:max-w-md rounded-2xl p-4 sm:p-6">
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
                                            {selectedPackage && formatCurrency(getEffectivePrice(selectedPackage))}
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

                                {walletBalance < (selectedPackage ? getEffectivePrice(selectedPackage) : 0) && (
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
                                    disabled={isPurchasing || !phoneNumber || !!phoneError || walletBalance < (selectedPackage ? getEffectivePrice(selectedPackage) : 0)}
                                >
                                    {isPurchasing ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        `Pay ${selectedPackage && formatCurrency(getEffectivePrice(selectedPackage))}`
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
