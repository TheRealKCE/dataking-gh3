'use client'

import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
    ShieldCheck,
    FileText,
    CloudUpload,
    Loader2,
    Copy,
    Download,
    CheckCircle2,
    AlertCircle,
    XCircle,
    Info,
} from 'lucide-react'

const MAX_NUMBERS = 1000

type CheckStatus = 'registered' | 'submitted' | 'invalid' | 'not_mtn'

interface CheckResult {
    input: string
    normalized: string
    status: CheckStatus
    reason?: string
}

interface CheckSummary {
    total: number
    registered: number
    submitted: number
    invalid: number
    not_mtn: number
    duplicates: number
}

const STATUS_META: Record<CheckStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
    registered: {
        label: 'Registered',
        className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-transparent',
        icon: CheckCircle2,
    },
    submitted: {
        label: 'Not Registered',
        className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-transparent',
        icon: AlertCircle,
    },
    invalid: {
        label: 'Invalid',
        className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-transparent',
        icon: XCircle,
    },
    not_mtn: {
        label: 'Not MTN',
        className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-transparent',
        icon: Info,
    },
}

/** Split a paste on newlines, commas, semicolons, tabs or spaces. */
function parseNumbers(text: string): string[] {
    return text
        .split(/[\s,;]+/)
        .map(n => n.trim())
        .filter(Boolean)
}

export default function MtnRegistrationPage() {
    const [inputType, setInputType] = useState<'text' | 'excel'>('text')
    const [text, setText] = useState('')
    const [file, setFile] = useState<File | null>(null)
    const [isChecking, setIsChecking] = useState(false)
    const [results, setResults] = useState<CheckResult[] | null>(null)
    const [summary, setSummary] = useState<CheckSummary | null>(null)
    const [filter, setFilter] = useState<CheckStatus | 'all'>('all')
    const fileInputRef = useRef<HTMLInputElement>(null)

    const pastedNumbers = useMemo(() => parseNumbers(text), [text])
    const overLimit = pastedNumbers.length > MAX_NUMBERS

    const runCheck = async (numbers: string[]) => {
        if (numbers.length === 0) {
            toast.error('Add at least one number')
            return
        }
        if (numbers.length > MAX_NUMBERS) {
            toast.error(`You can check up to ${MAX_NUMBERS} numbers at a time`)
            return
        }

        setIsChecking(true)
        setResults(null)
        setSummary(null)
        setFilter('all')

        try {
            const response = await fetch('/api/mtn/check-registration', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ numbers }),
            })

            const data = await response.json()

            if (!response.ok) {
                toast.error(data?.error || 'Could not check these numbers')
                return
            }

            setResults(data.results)
            setSummary(data.summary)

            if (data.summary.submitted > 0) {
                toast.success(`${data.summary.registered} registered · ${data.summary.submitted} NOT registered (sent to MTN)`)
            } else {
                toast.success(`All ${data.summary.registered} MTN numbers are registered`)
            }
        } catch (error) {
            toast.error('Network error. Please try again.')
        } finally {
            setIsChecking(false)
        }
    }

    const handleCheckExcel = async () => {
        if (!file) {
            toast.error('Please select a file first')
            return
        }

        setIsChecking(true)
        const reader = new FileReader()
        reader.onload = async (e) => {
            const data = e.target?.result
            if (!data) {
                setIsChecking(false)
                return
            }

            try {
                const XLSX = await import('xlsx')
                const workbook = XLSX.read(data, { type: 'binary' })
                const worksheet = workbook.Sheets[workbook.SheetNames[0]]
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

                const numbers = jsonData.map((row, index) => {
                    const cell = row[0]?.toString().trim()
                    if (!cell) return null
                    // Skip a header row if it looks like one
                    if (index === 0 && /phone|number|msisdn/i.test(cell)) return null
                    return cell
                }).filter(Boolean) as string[]

                if (numbers.length === 0) {
                    toast.error('No numbers found in the first column')
                    setIsChecking(false)
                    return
                }

                setIsChecking(false)
                await runCheck(numbers)
            } catch (error) {
                toast.error('Could not read that file')
                setIsChecking(false)
            }
        }
        reader.readAsBinaryString(file)
    }

    const filteredResults = useMemo(() => {
        if (!results) return []
        return filter === 'all' ? results : results.filter(r => r.status === filter)
    }, [results, filter])

    const copySubmitted = async () => {
        const numbers = (results || []).filter(r => r.status === 'submitted').map(r => r.normalized)
        if (numbers.length === 0) {
            toast.error('Every number is already registered')
            return
        }
        await navigator.clipboard.writeText(numbers.join('\n'))
        toast.success(`Copied ${numbers.length} numbers`)
    }

    const downloadCsv = () => {
        if (!results || results.length === 0) return
        const rows = [
            ['Number', 'Status', 'Note'],
            ...results.map(r => [r.normalized || r.input, STATUS_META[r.status].label, r.reason || '']),
        ]
        const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `mtn-registration-check-${new Date().toISOString().slice(0, 10)}.csv`
        link.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h1 className="text-2xl sm:text-3xl font-bold">Check MTN Number Registration</h1>
                <p className="text-base text-muted-foreground mt-1">
                    See which MTN numbers are registered for data before you order
                </p>
            </div>

            <div className="max-w-3xl mx-auto space-y-6">
                {/* Explainer */}
                <div className="flex items-start gap-3 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/40 p-4">
                    <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-xl shrink-0">
                        <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                    </div>
                    <p className="text-base text-amber-900 dark:text-amber-200 text-left leading-relaxed">
                        Numbers that are <strong>not registered</strong> are sent to MTN automatically. Registration can
                        take <strong>up to 2 weeks</strong> — orders placed for them are held and delivered
                        automatically once it completes. You can check up to{' '}
                        <strong>{MAX_NUMBERS.toLocaleString()}</strong> numbers at once.
                    </p>
                </div>

                {/* Input */}
                <Card className="rounded-3xl">
                    <CardHeader>
                        <CardTitle className="text-lg">Enter numbers</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-3">
                            <Button
                                type="button"
                                variant={inputType === 'text' ? 'default' : 'outline'}
                                className="flex-1 h-11 rounded-xl font-bold"
                                onClick={() => setInputType('text')}
                            >
                                <FileText className="w-4 h-4 mr-2" />
                                Paste Numbers
                            </Button>
                            <Button
                                type="button"
                                variant={inputType === 'excel' ? 'default' : 'outline'}
                                className="flex-1 h-11 rounded-xl font-bold"
                                onClick={() => setInputType('excel')}
                            >
                                <CloudUpload className="w-4 h-4 mr-2" />
                                Excel / CSV
                            </Button>
                        </div>

                        {inputType === 'text' ? (
                            <div className="space-y-2">
                                <Textarea
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    placeholder={'0551234567\n0244000000\n0591112222'}
                                    className="min-h-[200px] font-mono text-base rounded-xl"
                                />
                                <div className="flex items-center justify-between text-sm">
                                    <span className={cn('font-medium', overLimit ? 'text-red-600' : 'text-muted-foreground')}>
                                        {pastedNumbers.length.toLocaleString()} / {MAX_NUMBERS.toLocaleString()} numbers
                                    </span>
                                    {text && (
                                        <button
                                            type="button"
                                            className="text-muted-foreground hover:text-foreground underline"
                                            onClick={() => setText('')}
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                                {overLimit && (
                                    <p className="text-xs text-red-600">
                                        Too many numbers. Remove {(pastedNumbers.length - MAX_NUMBERS).toLocaleString()} and try again.
                                    </p>
                                )}
                                <Button
                                    className="w-full h-12 rounded-xl font-bold"
                                    disabled={isChecking || overLimit || pastedNumbers.length === 0}
                                    onClick={() => runCheck(pastedNumbers)}
                                >
                                    {isChecking ? (
                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Checking…</>
                                    ) : (
                                        <><ShieldCheck className="w-4 h-4 mr-2" />Check Numbers</>
                                    )}
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    className="hidden"
                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full border-2 border-dashed rounded-2xl p-8 text-center hover:bg-muted/50 transition-colors"
                                >
                                    <CloudUpload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                                    <p className="text-sm font-medium">
                                        {file ? file.name : 'Click to choose an Excel or CSV file'}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Phone numbers in the first column
                                    </p>
                                </button>
                                <Button
                                    className="w-full h-12 rounded-xl font-bold"
                                    disabled={isChecking || !file}
                                    onClick={handleCheckExcel}
                                >
                                    {isChecking ? (
                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Checking…</>
                                    ) : (
                                        <><ShieldCheck className="w-4 h-4 mr-2" />Check Numbers</>
                                    )}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {isChecking && (
                    <div className="space-y-3">
                        <Skeleton className="h-20 w-full rounded-2xl" />
                        <Skeleton className="h-48 w-full rounded-2xl" />
                    </div>
                )}

                {/* Results */}
                {results && summary && !isChecking && (
                    <Card className="rounded-3xl">
                        <CardHeader>
                            <CardTitle className="text-xl">Results</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Summary chips double as filters */}
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setFilter('all')}
                                    className={cn(
                                        'px-4 py-2 rounded-full text-sm font-bold border transition-colors',
                                        filter === 'all' ? 'bg-foreground text-background border-transparent' : 'hover:bg-muted'
                                    )}
                                >
                                    All {summary.total}
                                </button>
                                {(Object.keys(STATUS_META) as CheckStatus[]).map((status) => {
                                    const count = summary[status]
                                    if (!count) return null
                                    const meta = STATUS_META[status]
                                    return (
                                        <button
                                            key={status}
                                            type="button"
                                            onClick={() => setFilter(status)}
                                            className={cn(
                                                'px-4 py-2 rounded-full text-sm font-bold transition-all',
                                                meta.className,
                                                filter === status && 'ring-2 ring-offset-1 ring-current'
                                            )}
                                        >
                                            {meta.label} {count}
                                        </button>
                                    )
                                })}
                            </div>

                            {summary.duplicates > 0 && (
                                <p className="text-sm text-muted-foreground">
                                    {summary.duplicates} duplicate {summary.duplicates === 1 ? 'number was' : 'numbers were'} checked only once.
                                </p>
                            )}

                            {/* Table */}
                            <div className="overflow-x-auto max-h-[560px] overflow-y-auto rounded-xl border">
                                <table className="w-full text-base">
                                    <thead className="bg-muted/50 sticky top-0">
                                        <tr>
                                            <th className="text-left font-semibold px-4 py-3">Number</th>
                                            <th className="text-left font-semibold px-4 py-3">Status</th>
                                            <th className="text-left font-semibold px-4 py-3 hidden sm:table-cell">Note</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredResults.map((result, index) => {
                                            const meta = STATUS_META[result.status]
                                            const Icon = meta.icon
                                            return (
                                                <tr key={`${result.input}-${index}`} className="border-t">
                                                    <td className="px-4 py-3.5 font-mono font-semibold text-lg whitespace-nowrap">
                                                        {result.normalized || result.input}
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <Badge className={cn('gap-1.5 font-semibold text-sm px-3 py-1', meta.className)}>
                                                            <Icon className="w-4 h-4" />
                                                            {meta.label}
                                                        </Badge>
                                                        {/* The Note column is hidden on phones, so repeat it here */}
                                                        {(result.reason || result.status === 'submitted') && (
                                                            <p className="sm:hidden text-xs text-muted-foreground mt-1">
                                                                {result.reason || 'Sent to MTN · up to 2 weeks'}
                                                            </p>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-sm text-muted-foreground hidden sm:table-cell">
                                                        {result.reason || (result.status === 'submitted' ? 'Sent to MTN · up to 2 weeks' : '')}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <Button variant="outline" className="h-11 rounded-xl text-base" onClick={copySubmitted}>
                                    <Copy className="w-4 h-4 mr-2" />
                                    Copy not-registered numbers
                                </Button>
                                <Button variant="outline" className="h-11 rounded-xl text-base" onClick={downloadCsv}>
                                    <Download className="w-4 h-4 mr-2" />
                                    Download CSV
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
