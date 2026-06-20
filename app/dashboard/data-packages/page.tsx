'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { formatCurrency, getNetworkGradient, cn } from '@/lib/utils'
import { generateReferenceCode } from '@/lib/utils'
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
    Check,
    AlertCircle,
    ShoppingCart,
    Plus,
    DollarSign,
    X,
    FileSpreadsheet,
    FileText,
    CloudUpload,
    ExternalLink,
    Receipt
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


const ALL_NETWORKS = ['MTN', 'Telecel', 'AT-iShare', 'AT-BigTime', 'Special MTN Mashup', 'EXPRESS MTN'] as const

export default function DataPackagesPage() {
    const { dbUser, session } = useAuth()
    const router = useRouter()
    const searchParams = useSearchParams()

    const [packages, setPackages] = useState<DataPackage[]>([])
    const [filteredPackages, setFilteredPackages] = useState<DataPackage[]>([])
    const [selectedNetwork, setSelectedNetwork] = useState<string>(
        searchParams.get('network') || 'MTN'
    )
    const [searchQuery, setSearchQuery] = useState('')
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [isLoading, setIsLoading] = useState(true)
    const [walletBalance, setWalletBalance] = useState(0)
    const [hideMashup, setHideMashup] = useState(false)
    const [hideExpressMtn, setHideExpressMtn] = useState(false)

    const [ordersToday, setOrdersToday] = useState(0)

    // Purchase dialog state
    const [selectedPackage, setSelectedPackage] = useState<DataPackage | null>(null)
    const [phoneNumber, setPhoneNumber] = useState('')
    const [phoneError, setPhoneError] = useState('')
    const [isPurchasing, setIsPurchasing] = useState(false)
    const [purchaseSuccess, setPurchaseSuccess] = useState(false)
    const [purchaseDetails, setPurchaseDetails] = useState<{
        referenceCode: string
        network: string
        size: string
        phoneNumber: string
        price: number
        newBalance: number
    } | null>(null)
    // Idempotency: Generate a new referenceCode each time the modal opens
    const [currentReferenceCode, setCurrentReferenceCode] = useState('')

    // Bulk success modal state
    const [bulkSuccess, setBulkSuccess] = useState(false)
    const [bulkSuccessDetails, setBulkSuccessDetails] = useState<{
        ordersPlaced: number
        totalCost: number
        newBalance: number
        orders: { phoneNumber: string; volume: number; packagePrice: number }[]
    } | null>(null)

    // Bulk Order State
    const [bulkInputType, setBulkInputType] = useState<'text' | 'excel' | null>(null)
    const [bulkText, setBulkText] = useState('')
    const [bulkNetwork, setBulkNetwork] = useState<string>('')
    const [validationResults, setValidationResults] = useState<ValidationResult[]>([])
    const [isValidating, setIsValidating] = useState(false)
    const [isSubmittingBulk, setIsSubmittingBulk] = useState(false)
    const [bulkFile, setBulkFile] = useState<File | null>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const totalBulkData = validationResults.reduce((sum, r) => sum + (r.isValid ? r.volume : 0), 0)
    const totalBulkCost = validationResults.reduce((sum, r) => sum + (r.isValid ? r.packagePrice : 0), 0)


    useEffect(() => {
        fetchPackages()
        fetchWalletBalance()
        fetchOrdersToday()
        fetchMashupSetting()
    }, [dbUser])

    useEffect(() => {
        filterPackages()
    }, [packages, selectedNetwork, searchQuery])

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
        }
    }, [bulkText])

    const fetchMashupSetting = async () => {
        try {
            const res = await fetch('/api/admin-settings?keys=special_mtn_mashup_hidden,express_mtn_hidden')
            if (res.ok) {
                const settings = await res.json()
                setHideMashup(String(settings.special_mtn_mashup_hidden) === 'true')
                setHideExpressMtn(String(settings.express_mtn_hidden) === 'true')
            }
        } catch (_) {
            // fallback
        }
    }

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
        if (dbUser?.role === 'dealer' && (pkg as any).dealer_price > 0) {
            return (pkg as any).dealer_price
        }
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
        setPurchaseDetails(null)
        // Generate a fresh idempotency key each time the modal opens
        setCurrentReferenceCode(generateReferenceCode())
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
                // 'Special MTN Mashup' uses MTN numbers, so treat it as MTN for validation
                const detectedNet = detectNetwork(value)
                const packageNetwork = (selectedPackage.network === 'Special MTN Mashup' || selectedPackage.network === 'EXPRESS MTN')
                    ? 'MTN'
                    : selectedPackage.network.includes('AT') ? 'AirtelTigo' : selectedPackage.network
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
                    referenceCode: currentReferenceCode, // idempotency key
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Purchase failed')
            }

            setPurchaseSuccess(true)
            setPurchaseDetails({
                referenceCode: data.order.reference_code,
                network: data.order.network,
                size: data.order.size,
                phoneNumber: data.order.phone_number,
                price: data.order.price,
                newBalance: data.order.new_balance,
            })
            setWalletBalance(typeof data.order?.new_balance === 'number' ? data.order.new_balance : (prev: number) => prev - effectivePrice)
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

    const validateLines = (parsedLines: any[]) => {
        if (!bulkNetwork) {
            toast.error('Please select a network first')
            return []
        }

        return parsedLines.map((line: any) => {
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
            const targetNet = bulkNetwork === 'AT-BigTime' || bulkNetwork === 'AT-iShare' ? 'AirtelTigo' : bulkNetwork
            if (detectedNet !== targetNet) {
                return {
                    ...line,
                    packagePrice: 0,
                    isValid: false,
                    errorMessage: `Wrong network (${detectedNet})`
                }
            }

            const pkg = packages.find(p => {
                if (p.network !== bulkNetwork) return false
                const pkgSize = p.size.toLowerCase()

                if (pkgSize.includes('gb')) {
                    const sizeVal = parseFloat(pkgSize.replace('gb', '').trim())
                    return sizeVal === line.volume
                } else if (pkgSize.includes('mb')) {
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
        const results = validateLines(parsedLines)

        setValidationResults(results)
        setIsValidating(false)
        if (results.length > 0) {
            toast.success(`Validated ${results.length} entries`)
        } else {
            toast.error('No valid lines found')
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setBulkFile(file)
            toast.success(`File ${file.name} selected`)
        }
    }

    const handleValidateExcel = async () => {
        if (!bulkNetwork) {
            toast.error('Please select a network first')
            return
        }
        if (!bulkFile) {
            toast.error('Please select an Excel file')
            return
        }

        setIsValidating(true)
        const reader = new FileReader()
        reader.onload = async (e) => {
            const data = e.target?.result
            if (!data) {
                setIsValidating(false)
                return
            }

            try {
                const XLSX = await import('xlsx')
                const workbook = XLSX.read(data, { type: 'binary' })
                const sheetName = workbook.SheetNames[0]
                const worksheet = workbook.Sheets[sheetName]
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

                // Assuming columns: Phone, Volume
                const parsedLines = jsonData.map((row, index) => {
                    if (index === 0 && (row[0]?.toString().toLowerCase().includes('phone') || row[0]?.toString().length > 10)) {
                        // Skip header if it looks like one
                        if (row[0]?.toString().toLowerCase().includes('phone')) return null
                    }

                    const phone = row[0]?.toString().trim()
                    const volumeStr = row[1]?.toString().toLowerCase().replace('gb', '').trim()
                    const volume = parseFloat(volumeStr)

                    if (!phone || isNaN(volume)) return null

                    return {
                        lineNumber: index + 1,
                        phoneNumber: phone,
                        volume: volume,
                        rawLine: row.join(' ')
                    }
                }).filter(Boolean)

                const results = validateLines(parsedLines)
                setValidationResults(results)
                toast.success(`Validated ${results.length} entries from Excel`)
            } catch (error) {
                toast.error('Error parsing Excel file')
            } finally {
                setIsValidating(false)
            }
        }
        reader.readAsBinaryString(bulkFile)
    }

    const clearInvalid = () => {
        setValidationResults(prev => prev.filter(r => r.isValid))
    }

    const clearAllResults = () => {
        setValidationResults([])
        setBulkText('')
        setBulkFile(null)
    }

    const deleteResult = (index: number) => {
        setValidationResults(prev => prev.filter((_, i) => i !== index))
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

        try {
            const response = await fetch('/api/orders/bulk-purchase', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    orders: validOrders.map(order => ({
                        packageId: order.packageId,
                        phoneNumber: validateGhanaianPhone(order.phoneNumber).normalizedNumber,
                        packagePrice: order.packagePrice,
                    }))
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Bulk order failed')
            }

            setBulkSuccessDetails({
                ordersPlaced: data.ordersPlaced,
                totalCost: data.totalCost,
                newBalance: data.newBalance,
                orders: validOrders.map(o => ({
                    phoneNumber: o.phoneNumber,
                    volume: o.volume,
                    packagePrice: o.packagePrice,
                })),
            })
            setBulkSuccess(true)
            setValidationResults([])
            setBulkText('')
            fetchWalletBalance()
            fetchOrdersToday()

        } catch (error: any) {
            toast.error(error.message || 'Error submitting bulk orders')
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
            <div className="flex items-center justify-between">
                <div className="flex-1 text-center">
                    <h1 className="text-2xl font-bold">Data Packages</h1>
                </div>
            </div>

            <div className="flex flex-col items-center gap-4 text-center">

                {/* Stats Dashboard */}
                <div id="stats-dashboard" className="grid grid-cols-2 gap-4 w-full max-w-md mx-auto mb-2">
                    <div className="bg-[#1A1A1A] dark:bg-[#E5E7EB] rounded-2xl p-4 text-center shadow-md lg:shadow-lg transition-colors flex flex-col items-center justify-between gap-3">
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

                    <div className="bg-[#1A1A1A] dark:bg-[#E5E7EB] rounded-2xl p-4 text-center shadow-md lg:shadow-lg transition-colors flex flex-col items-center justify-center">
                        <p className="text-[#FACC15] font-medium text-xs mb-1">
                            Orders Today
                        </p>
                        <p className="text-[#FACC15] text-xl font-black tracking-tight leading-none">
                            {ordersToday}
                        </p>
                    </div>
                </div>

                {/* Bulk Order Section - Agents, Admins, and Sub-Admins */}
                {(dbUser?.role === 'agent' || dbUser?.role === 'admin' || dbUser?.role === 'sub-admin') && (
                    <div id="bulk-order-section" className="w-full max-w-3xl mx-auto space-y-4">
                        {/* New Yellow Header Box */}
                        <div className="bg-[#FFCE00] rounded-3xl p-6 shadow-md lg:shadow-xl relative overflow-hidden">
                            <div className="flex items-start gap-4 relative z-10">
                                <div className="bg-[#1A1A1A] p-3 rounded-2xl shadow-lg">
                                    <CloudUpload className="w-6 h-6 text-[#FFCE00]" />
                                </div>
                                <div className="text-left">
                                    <h2 className="text-xl font-black text-black leading-tight">Bulk Orders Import</h2>
                                    <p className="text-sm font-bold text-black opacity-70">Import multiple orders at once via Excel or Text</p>
                                </div>
                            </div>

                            {/* Toggles */}
                            <div className="flex gap-3 mt-6 relative z-10">
                                <Button
                                    onClick={() => setBulkInputType(bulkInputType === 'text' ? null : 'text')}
                                    className={cn(
                                        "flex-1 h-12 rounded-xl font-bold transition-all duration-300",
                                        bulkInputType === 'text'
                                            ? "bg-[#1A1A1A] text-[#FFCE00] shadow-lg scale-105"
                                            : "bg-white text-black hover:bg-white/90"
                                    )}
                                >
                                    <FileText className="w-4 h-4 mr-2" />
                                    Text Input
                                </Button>
                                <Button
                                    onClick={() => setBulkInputType(bulkInputType === 'excel' ? null : 'excel')}
                                    className={cn(
                                        "flex-1 h-12 rounded-xl font-bold transition-all duration-300",
                                        bulkInputType === 'excel'
                                            ? "bg-[#1A1A1A] text-[#FFCE00] shadow-lg scale-105"
                                            : "bg-white text-black hover:bg-white/90"
                                    )}
                                >
                                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                                    Excel Import
                                </Button>
                            </div>
                        </div>

                        {/* Conditional Forms */}
                        {bulkInputType && (
                            <Card className="border-0 bg-transparent shadow-none animate-in fade-in slide-in-from-top-4 duration-500">
                                <CardContent className="p-0 space-y-4">
                                    <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-md lg:shadow-lg border border-gray-100 dark:border-zinc-800">
                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <Label className="text-[#E60000] font-black text-xs uppercase tracking-widest">Select Network</Label>
                                                <div className="flex gap-2 flex-wrap">
                                                    {ALL_NETWORKS.filter(net => (!hideMashup || net !== 'Special MTN Mashup') && (!hideExpressMtn || net !== 'EXPRESS MTN')).map(net => (
                                                        <Button
                                                            key={net}
                                                            variant={bulkNetwork === net ? "default" : "outline"}
                                                            className={cn(
                                                                "h-8 text-[10px] font-bold px-3 rounded-full transition-all",
                                                                bulkNetwork === net ?
                                                                    (net === 'MTN' ? 'bg-[#FFCC00] text-black hover:bg-[#FFCC00]/90 border-0' :
                                                                        net === 'Telecel' ? 'bg-[#E60000] text-white hover:bg-[#E60000]/90 border-0' :
                                                                            'bg-[#0056B3] text-white hover:bg-[#0056B3]/90 border-0')
                                                                    : 'bg-transparent border-gray-200 dark:border-zinc-700'
                                                            )}
                                                            onClick={() => setBulkNetwork(net)}
                                                            size="sm"
                                                        >
                                                            {net}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>

                                            {bulkInputType === 'text' ? (
                                                <div className="space-y-4">
                                                    <div className="text-center space-y-1 py-2">
                                                        <h3 className="text-lg font-black text-black dark:text-white">Enter Your Orders</h3>
                                                        <p className="text-xs font-bold text-gray-400">One order per line (e.g below)</p>
                                                    </div>

                                                    <div className="relative group">
                                                        <textarea
                                                            ref={textareaRef}
                                                            wrap="off"
                                                            className="w-full rounded-2xl border-2 border-gray-50 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/50 px-4 py-3 text-[11px] leading-[1.6] text-black dark:text-white placeholder:text-gray-300 dark:placeholder:text-zinc-600 focus:outline-none focus:border-[#FFCE00] transition-colors font-mono font-bold overflow-x-auto whitespace-pre"
                                                            placeholder={`0246677889 2\n0546627266 3`}
                                                            value={bulkText}
                                                            onChange={(e) => setBulkText(e.target.value)}
                                                        />
                                                    </div>

                                                    <Button
                                                        className="w-full bg-[#FFCE00] hover:bg-[#FFCE00]/90 text-black font-black py-6 rounded-2xl shadow-lg shadow-[#FFCE00]/20 text-sm"
                                                        onClick={handleValidateBulk}
                                                        disabled={isValidating}
                                                    >
                                                        {isValidating ? (
                                                            <>
                                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                                Validating...
                                                            </>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <Check className="w-4 h-4" />
                                                                Validate Orders
                                                            </div>
                                                        )}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    <div className="text-center space-y-1 py-2">
                                                        <h3 className="text-lg font-black text-black dark:text-white">Excel Import</h3>
                                                        <p className="text-xs font-bold text-gray-400">Upload your sheet with Phone and Volume columns</p>
                                                    </div>

                                                    <div
                                                        className="border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl p-8 text-center bg-gray-50/30 dark:bg-zinc-800/30 hover:bg-gray-50/50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer relative"
                                                        onClick={() => document.getElementById('excel-upload')?.click()}
                                                    >
                                                        <input
                                                            id="excel-upload"
                                                            type="file"
                                                            accept=".xlsx, .xls, .csv"
                                                            className="hidden"
                                                            onChange={handleFileChange}
                                                            title="Upload Excel File"
                                                        />
                                                        <div className="flex flex-col items-center gap-2">
                                                            <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800">
                                                                <Upload className="w-5 h-5 text-[#FFCE00]" />
                                                            </div>
                                                            <p className="text-xs font-bold text-black dark:text-white">
                                                                {bulkFile ? bulkFile.name : 'Click to upload Excel file'}
                                                            </p>
                                                            <p className="text-[10px] text-gray-400">or drag and drop here</p>
                                                        </div>
                                                    </div>

                                                    {bulkFile && (
                                                        <Button
                                                            className="w-full bg-[#FFCE00] hover:bg-[#FFCE00]/90 text-black font-black py-6 rounded-2xl shadow-lg shadow-[#FFCE00]/20 text-sm"
                                                            onClick={handleValidateExcel}
                                                            disabled={isValidating}
                                                        >
                                                            {isValidating ? (
                                                                <>
                                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                                    Validating...
                                                                </>
                                                            ) : (
                                                                <div className="flex items-center gap-2">
                                                                    <Check className="w-4 h-4" />
                                                                    Validate Excel
                                                                </div>
                                                            )}
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Validation Results */}
                                    {validationResults.length > 0 && (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <div className="bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-lg border border-gray-100 dark:border-zinc-800">
                                                <div className="bg-[#FFCE00] px-6 py-4 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="bg-white/20 p-1 rounded-lg">
                                                            <CheckCircle2 className="w-4 h-4 text-black" />
                                                        </div>
                                                        <h3 className="font-black text-black">Order List ({validationResults.length})</h3>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 text-[10px] font-bold text-black hover:bg-black/10 px-2"
                                                            onClick={clearInvalid}
                                                        >
                                                            Clear All Invalid
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 text-[10px] font-bold text-red-600 hover:bg-red-50 px-2"
                                                            onClick={clearAllResults}
                                                        >
                                                            Clear All
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="max-h-[300px] overflow-y-auto">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-gray-50/50 dark:bg-zinc-800/50 border-b border-gray-100 dark:border-zinc-800">
                                                            <tr>
                                                                <th className="px-6 py-3 text-left font-black text-gray-400">STATUS</th>
                                                                <th className="px-6 py-3 text-left font-black text-gray-400">RECIPIENT</th>
                                                                <th className="px-6 py-3 text-left font-black text-gray-400">DATA</th>
                                                                <th className="px-6 py-3 text-left font-black text-gray-400">PRICE</th>
                                                                <th className="px-0 py-3 text-center"></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                                                            {validationResults.map((res, i) => (
                                                                <tr key={i} className="group hover:bg-gray-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                                                                    <td className="px-6 py-4">
                                                                        <div className={cn(
                                                                            "w-2 h-2 rounded-full",
                                                                            res.isValid ? "bg-[#25D366]" : "bg-[#E60000]"
                                                                        )} />
                                                                    </td>
                                                                    <td className="px-6 py-4 font-bold text-black dark:text-white">{res.phoneNumber}</td>
                                                                    <td className="px-6 py-4 font-bold text-gray-500">{res.volume} GB</td>
                                                                    <td className="px-6 py-4 font-black text-black dark:text-white">
                                                                        {res.packagePrice > 0 ? formatCurrency(res.packagePrice) : '-'}
                                                                    </td>
                                                                    <td className="px-2 py-4">
                                                                        <button
                                                                            onClick={() => deleteResult(i)}
                                                                            className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all"
                                                                            title="Delete result"
                                                                            aria-label="Delete result"
                                                                        >
                                                                            <X className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            {/* Summary Container */}
                                            <div className="bg-[#FFCE00] rounded-3xl p-4 shadow-xl relative overflow-hidden max-w-md mx-auto w-full">
                                                <div className="grid grid-cols-2 gap-4 relative z-10 items-center">
                                                    <div className="text-center space-y-0.5 border-r border-black/10">
                                                        <p className="text-[9px] font-black text-black uppercase tracking-widest opacity-60">Total Cost</p>
                                                        <h2 className="text-2xl font-black text-black leading-tight">{formatCurrency(totalBulkCost)}</h2>
                                                        <p className="text-[9px] font-bold text-black opacity-60 uppercase tracking-tighter">Order value</p>
                                                    </div>
                                                    <div className="text-center space-y-0.5">
                                                        <p className="text-[9px] font-black text-black uppercase tracking-widest opacity-60">Total Data</p>
                                                        <h2 className="text-2xl font-black text-black leading-tight">{totalBulkData} <span className="text-sm">GB</span></h2>
                                                        <p className="text-[9px] font-bold text-black opacity-60 uppercase tracking-tighter">Data Volume</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Submit Section */}
                                            <div className="flex flex-col items-center justify-center gap-4 py-4 max-w-md mx-auto w-full">
                                                {walletBalance < totalBulkCost ? (
                                                    <Link href="/dashboard/wallet" className="w-full">
                                                        <Button
                                                            className="w-full bg-[#FFCE00] text-black hover:bg-[#FFCE00]/90 font-black py-6 rounded-2xl shadow-xl shadow-yellow-500/20 text-sm h-auto uppercase tracking-widest"
                                                        >
                                                            <DollarSign className="w-5 h-5 mr-2" />
                                                            Recharge Wallet
                                                        </Button>
                                                    </Link>
                                                ) : (
                                                    <Button
                                                        className="w-full bg-black text-[#FFCE00] hover:bg-black/90 font-black py-5 rounded-2xl shadow-xl shadow-black/10 text-sm h-auto flex flex-col items-center gap-1"
                                                        onClick={handleSubmitBulkOrder}
                                                        disabled={isSubmittingBulk || validationResults.filter(r => r.isValid).length === 0}
                                                    >
                                                        {isSubmittingBulk ? (
                                                            <div className="flex items-center">
                                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                                Processing...
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="text-[10px] font-bold opacity-60 flex items-center gap-1 mb-1 bg-white/10 px-3 py-0.5 rounded-full">
                                                                    <DollarSign className="w-2.5 h-2.5" />
                                                                    Wallet Balance: {formatCurrency(walletBalance)}
                                                                </div>
                                                                <div className="flex items-center gap-2 text-base tracking-widest">
                                                                    <CheckCircle2 className="w-5 h-5" />
                                                                    SUBMIT ORDERS
                                                                </div>
                                                            </>
                                                        )}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>
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
            <div id="package-filters" className="relative max-w-md mx-auto w-full">
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
                <TabsList className={`grid gap-1 sm:gap-2 w-full ${hideMashup && hideExpressMtn ? 'grid-cols-4' : (hideMashup || hideExpressMtn) ? 'grid-cols-5' : 'grid-cols-6'}`}>
                    {ALL_NETWORKS.filter(network => (!hideMashup || network !== 'Special MTN Mashup') && (!hideExpressMtn || network !== 'EXPRESS MTN')).map((network) => {
                        const getNetworkColor = () => {
                            if (network === 'MTN' || network === 'Special MTN Mashup' || network === 'EXPRESS MTN') return 'data-[state=active]:bg-[#FACC15] data-[state=active]:text-black'
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
                                <span className="hidden sm:inline">{network === 'Special MTN Mashup' ? 'Special Mashup' : network === 'EXPRESS MTN' ? 'Express MTN' : network}</span>
                                <span className="sm:hidden">{network === 'AT-iShare' ? 'AT-iS' : network === 'AT-BigTime' ? 'AT-BT' : network === 'Special MTN Mashup' ? 'Mashup' : network === 'EXPRESS MTN' ? 'Xpress' : network}</span>
                            </TabsTrigger>
                        )
                    })}
                </TabsList>

                <TabsContent id="packages-grid" value={selectedNetwork} className="mt-6">
                    {filteredPackages.length === 0 ? (
                        <Card className="p-12 text-center">
                            <Wifi className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                            <p className="text-muted-foreground">No packages found</p>
                        </Card>
                    ) : viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredPackages.map((pkg) => {
                                const isMtn = pkg.network === 'MTN'
                                const isMashup = pkg.network === 'Special MTN Mashup' || pkg.network === 'EXPRESS MTN'
                                const isTelecel = pkg.network === 'Telecel'

                                return (
                                    <Card
                                        key={pkg.id}
                                        className={`overflow-hidden relative isolate border border-border/50 shadow-md dark:shadow-[#E5E7EB]/20 ${isMtn || isMashup ? 'bg-[#FFCC00] text-black shadow-black/20' :
                                            isTelecel ? 'bg-[#E60000] text-white shadow-black/20' :
                                                'bg-[#0056B3] text-white shadow-black/20'
                                        }`}
                                    >
                                        <CardContent className="p-0 flex flex-col h-full">
                                            {/* Top Section: Logo - Size - Badge */}
                                            <div className="flex items-center justify-between p-4 pb-2 relative z-10">
                                                <div className="p-1.5 bg-white/20 rounded-full shadow-md">
                                                    <NetworkIcon network={pkg.network} size={28} variant="card" />
                                                </div>

                                                <div className="absolute inset-y-0 left-[52px] right-[80px] flex items-center justify-center pointer-events-none">
                                                    <h3 className={`font-black tracking-tight text-center leading-tight ${isMtn || isMashup ? '!text-black' : '!text-white'} ${isMashup ? 'text-xl sm:text-2xl w-[120%]' : 'text-4xl'}`}>
                                                        {pkg.size}
                                                    </h3>
                                                </div>

                                                <Badge className={`text-[10px] font-bold px-2 py-0.5 border-none shadow-md uppercase tracking-wider z-10 ${isMtn ? 'bg-[#004F9F] text-white' :
                                                    isMashup ? 'bg-white text-[#004F9F]' :
                                                    'bg-white text-black'
                                                    }`}>
                                                    {isMashup ? 'MASHUP' : pkg.network}
                                                </Badge>
                                            </div>

                                            {/* Middle Content: Price & Description */}
                                            <div className="flex flex-col items-center justify-center flex-1 space-y-3 py-6 relative z-10">
                                                <div className="text-3xl lg:text-4xl font-black tracking-tighter">
                                                    {formatCurrency(getEffectivePrice(pkg))}
                                                </div>

                                                <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wide px-4 py-1.5 rounded-full border border-white/10 ${isMtn || isMashup ? 'bg-black/10 text-black' : 'bg-white/10 text-white'
                                                    }`}>
                                                    <span className="text-base">⏳</span>
                                                    <span className="flex items-center gap-1">
                                                        Instant Delivery
                                                        <span>⚡</span>
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
                                                    variant="outline"
                                                    className={`w-full rounded-t-none rounded-b-xl h-12 text-md font-bold uppercase tracking-widest border-0 transition-colors shadow-none ${isMtn || isMashup ? 'bg-black text-white hover:bg-black/90' :
                                                        isTelecel ? 'bg-white text-[#E60000] hover:bg-gray-100' :
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
                        <div className="space-y-3">
                            {filteredPackages.map((pkg) => {
                                const getBuyButtonStyle = () => {
                                    if (pkg.network === 'Telecel') {
                                        return 'bg-white text-[#E60000] hover:bg-gray-100 border-0 shadow-md font-bold px-6'
                                    }
                                    if (pkg.network.startsWith('AT')) {
                                        return 'bg-white text-[#0056B3] hover:bg-gray-100 border-0 shadow-md font-bold px-6'
                                    }
                                    return 'bg-black text-white hover:bg-black/90 border-0 shadow-md font-bold px-6'
                                }

                                return (
                                    <Card
                                        key={pkg.id}
                                        className={`cursor-pointer border border-border/50 mb-3 overflow-hidden ${pkg.network === 'MTN' ? 'bg-[#FACC15] text-black' :
                                            pkg.network === 'Telecel' ? 'bg-[#E60000] text-white' :
                                                'bg-[#0056B3] text-white'
                                            }`}
                                        onClick={() => handlePurchaseClick(pkg)}
                                    >
                                        <CardContent className="p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-5">
                                                <div className="p-2 bg-white/20 rounded-xl shadow-sm">
                                                    <NetworkIcon network={pkg.network} size={40} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <h3 className="font-black text-xl sm:text-2xl leading-tight">{pkg.size}</h3>
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
                                                    variant="outline"
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
                        <div className="py-4 space-y-5">
                            {/* Success Icon */}
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                    <CheckCircle2 className="w-7 h-7 text-green-600" />
                                </div>
                                <DialogTitle className="text-lg font-black">Order Placed!</DialogTitle>
                                <p className="text-xs text-muted-foreground text-center">Your data bundle is being processed</p>
                            </div>

                            {/* Order Summary */}
                            {purchaseDetails && (
                                <div className="bg-muted/50 rounded-2xl p-4 space-y-3">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Recipient</span>
                                        <span className="font-bold">{purchaseDetails.phoneNumber}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Package</span>
                                        <span className="font-bold">{purchaseDetails.network} {purchaseDetails.size}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Amount Paid</span>
                                        <span className="font-black text-primary">{formatCurrency(purchaseDetails.price)}</span>
                                    </div>
                                    <div className="border-t border-border/50 pt-2 flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Ref</span>
                                        <span className="font-mono text-xs text-muted-foreground">{purchaseDetails.referenceCode}</span>
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => setSelectedPackage(null)}
                                >
                                    Done
                                </Button>
                                <Button
                                    className="flex-1 bg-primary text-primary-foreground"
                                    onClick={() => { setSelectedPackage(null); router.push('/dashboard/my-orders') }}
                                >
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    View Orders
                                </Button>
                            </div>
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

            {/* Bulk Order Success Modal */}
            <Dialog open={bulkSuccess} onOpenChange={() => setBulkSuccess(false)}>
                <DialogContent className="w-[95%] max-w-sm sm:max-w-md rounded-2xl p-4 sm:p-6">
                    <div className="space-y-5">
                        {/* Success header */}
                        <div className="flex flex-col items-center gap-2 pt-2">
                            <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <CheckCircle2 className="w-7 h-7 text-green-600" />
                            </div>
                            <DialogTitle className="text-lg font-black text-center">
                                {bulkSuccessDetails?.ordersPlaced} Orders Placed!
                            </DialogTitle>
                            <p className="text-xs text-muted-foreground text-center">All your data bundles are being processed</p>
                        </div>

                        {/* Summary stats */}
                        {bulkSuccessDetails && (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-muted/50 rounded-xl p-3 text-center">
                                    <p className="text-xs text-muted-foreground mb-1">Total Cost</p>
                                    <p className="font-black text-base">{formatCurrency(bulkSuccessDetails.totalCost)}</p>
                                </div>
                                <div className="bg-muted/50 rounded-xl p-3 text-center">
                                    <p className="text-xs text-muted-foreground mb-1">New Balance</p>
                                    <p className="font-black text-base">{formatCurrency(bulkSuccessDetails.newBalance)}</p>
                                </div>
                            </div>
                        )}

                        {/* Scrollable order list */}
                        {bulkSuccessDetails && bulkSuccessDetails.orders.length > 0 && (
                            <div className="rounded-xl border border-border/50 overflow-hidden">
                                <div className="bg-muted/30 px-4 py-2 border-b border-border/50">
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Order Summary</p>
                                </div>
                                <div className="overflow-y-auto max-h-[40vh]">
                                    {bulkSuccessDetails.orders.map((o, i) => (
                                        <div key={i} className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                                                <span className="text-sm font-medium">{o.phoneNumber}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                <span className="font-semibold">{o.volume}GB</span>
                                                <span className="font-black text-foreground">{formatCurrency(o.packagePrice)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => setBulkSuccess(false)}
                            >
                                Done
                            </Button>
                            <Button
                                className="flex-1 bg-primary text-primary-foreground"
                                onClick={() => { setBulkSuccess(false); router.push('/dashboard/my-orders') }}
                            >
                                <ExternalLink className="w-4 h-4 mr-2" />
                                View Orders
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
