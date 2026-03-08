'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
    CheckCircle2, XCircle, Loader2, Eye, Download, Clock,
    Copy, Check, ShieldCheck, Users, LayoutList
} from 'lucide-react'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog'
import { format } from 'date-fns'

type AfarOrder = {
    id: string
    user_id: string
    full_name: string
    phone: string
    id_type?: string
    id_number?: string
    ghana_card?: string
    location: string
    region: string
    occupation: string
    status: 'pending' | 'processing' | 'completed' | 'cancelled'
    notes?: string
    payment_amount?: number
    created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400', icon: Clock },
    processing: { label: 'Processing', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400', icon: Clock },
    completed: { label: 'Completed', color: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400', icon: CheckCircle2 },
    cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400', icon: XCircle },
}

// One-click copy helper (shows a brief checkmark)
function CopyField({ label, value }: { label: string; value: string }) {
    const [copied, setCopied] = useState(false)
    const copy = () => {
        navigator.clipboard.writeText(value).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1800)
        })
    }
    return (
        <div className="flex items-center justify-between py-2 border-b last:border-0">
            <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                <p className="text-sm font-medium mt-0.5">{value || '—'}</p>
            </div>
            <button
                onClick={copy}
                className="ml-2 p-1.5 rounded-md hover:bg-muted transition-colors"
                title={`Copy ${label}`}
            >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
        </div>
    )
}

export default function AdminAfaManagementPage() {
    const [applications, setApplications] = useState<AfarOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedApp, setSelectedApp] = useState<AfarOrder | null>(null)
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const [downloading, setDownloading] = useState(false)

    const fetchApplications = useCallback(async () => {
        const { data, error } = await (supabase
            .from('afa_orders') as any)
            .select('*')
            .order('created_at', { ascending: false })
        if (!error) setApplications(data || [])
        setLoading(false)
    }, [])

    useEffect(() => {
        fetchApplications()

        // ── Real-time subscription ──
        const channel = supabase
            .channel('afa_orders_admin')
            .on(
                'postgres_changes' as any,
                { event: '*', schema: 'public', table: 'afa_orders' },
                (payload: any) => {
                    if (payload.eventType === 'INSERT') {
                        setApplications(prev => [payload.new as AfarOrder, ...prev])
                        toast.info('New AFAR registration received!')
                    } else if (payload.eventType === 'UPDATE') {
                        setApplications(prev =>
                            prev.map(a => a.id === payload.new.id ? payload.new as AfarOrder : a)
                        )
                        // Update the modal if it's currently open
                        setSelectedApp(prev => prev?.id === payload.new.id ? payload.new as AfarOrder : prev)
                    }
                }
            )
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [fetchApplications])

    const updateStatus = async (id: string, status: string) => {
        setUpdatingId(id)
        try {
            const { error } = await (supabase.from('afa_orders') as any)
                .update({ status, updated_at: new Date().toISOString() })
                .eq('id', id)

            if (error) {
                toast.error('Failed to update status')
            } else {
                toast.success(`Status updated to "${status}"`)
            }
        } finally {
            setUpdatingId(null)
        }
    }

    const handleDownload = async (app: AfarOrder) => {
        setDownloading(true)
        try {
            // Build a clean text file with all form details
            const idNumber = app.id_number || app.ghana_card || 'N/A'
            const idType = app.id_type || 'Ghana Card'
            const lines = [
                '============================================',
                '     MTN AFAR REGISTRATION — APPLICATION    ',
                '============================================',
                '',
                `Full Name        : ${app.full_name}`,
                `Phone Number     : ${app.phone}`,
                `ID Type          : ${idType}`,
                `ID Number        : ${idNumber}`,
                `Region           : ${app.region}`,
                `City / Town      : ${app.location}`,
                `Occupation       : ${app.occupation || 'Farmer'}`,
                `Notes            : ${app.notes || 'None'}`,
                '',
                `Payment Amount   : GHS ${app.payment_amount?.toFixed(2) ?? '—'}`,
                `Status           : ${app.status.toUpperCase()}`,
                `Submitted On     : ${format(new Date(app.created_at), 'dd MMM yyyy, hh:mm a')}`,
                '',
                '============================================',
                'Submitted via KingFlexy Dashboard',
                '============================================',
            ]

            const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `AFAR_${app.full_name.replace(/\s+/g, '_')}_${app.id.slice(0, 8)}.txt`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)

            // Auto-update status to "processing" after download
            await updateStatus(app.id, 'processing')
            toast.success('Application downloaded and marked as Processing.')
        } catch (err) {
            toast.error('Download failed')
        } finally {
            setDownloading(false)
        }
    }

    // Stats
    const stats = {
        total: applications.length,
        pending: applications.filter(a => a.status === 'pending').length,
        processing: applications.filter(a => a.status === 'processing').length,
        completed: applications.filter(a => a.status === 'completed').length,
        cancelled: applications.filter(a => a.status === 'cancelled').length,
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6">

            {/* ─── Page Header ─── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Admin Console</span>
                    </div>
                    <h1 className="text-2xl font-bold">MTN AFAR Applications</h1>
                    <p className="text-sm text-muted-foreground">Manage and process incoming 30-day registration applications.</p>
                </div>
            </div>

            {/* ─── Stats Overview ─── */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                    { label: 'Total', value: stats.total, icon: LayoutList, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                    { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
                    { label: 'Processing', value: stats.processing, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                    { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
                    { label: 'Cancelled', value: stats.cancelled, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
                ].map(s => (
                    <Card key={s.label} className="border shadow-sm">
                        <CardContent className="p-4">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${s.bg}`}>
                                <s.icon className={`w-4 h-4 ${s.color}`} />
                            </div>
                            <p className="text-xs text-muted-foreground">{s.label}</p>
                            <p className="text-xl font-bold mt-0.5">{s.value}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* ─── Applications Table ─── */}
            <Card>
                <CardHeader className="p-4 border-b">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Registration Submissions
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {applications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                            <ShieldCheck className="w-10 h-10 opacity-20" />
                            <p className="text-sm">No applications submitted yet.</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <div className="hidden md:block overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Applicant</TableHead>
                                            <TableHead>ID Type</TableHead>
                                            <TableHead>Location</TableHead>
                                            <TableHead>Fee</TableHead>
                                            <TableHead>Submitted</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {applications.map(app => {
                                            const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending
                                            const StatusIcon = cfg.icon
                                            return (
                                                <TableRow key={app.id} className="hover:bg-muted/30">
                                                    <TableCell>
                                                        <div className="font-medium">{app.full_name}</div>
                                                        <div className="text-xs text-muted-foreground">{app.phone}</div>
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {app.id_type || 'Ghana Card'}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {app.location}, {app.region}
                                                    </TableCell>
                                                    <TableCell className="text-sm font-medium">
                                                        {app.payment_amount != null ? `GHS ${app.payment_amount.toFixed(2)}` : '—'}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {format(new Date(app.created_at), 'dd MMM yyyy')}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${cfg.color}`}>
                                                            <StatusIcon className="w-3 h-3" />
                                                            {cfg.label}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="gap-1.5"
                                                            onClick={() => setSelectedApp(app)}
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                            View
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile Cards */}
                            <div className="md:hidden divide-y">
                                {applications.map(app => {
                                    const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending
                                    const StatusIcon = cfg.icon
                                    return (
                                        <div key={app.id} className="p-4 flex items-center gap-3 hover:bg-muted/20">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate">{app.full_name}</p>
                                                <p className="text-xs text-muted-foreground">{app.phone}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">{app.id_type || 'Ghana Card'} • {app.location}</p>
                                                <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full mt-1 ${cfg.color}`}>
                                                    <StatusIcon className="w-2.5 h-2.5" />
                                                    {cfg.label}
                                                </span>
                                            </div>
                                            <Button size="sm" variant="outline" onClick={() => setSelectedApp(app)}>
                                                <Eye className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    )
                                })}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* ─── Application Detail Modal ─── */}
            <Dialog open={!!selectedApp} onOpenChange={(open) => { if (!open) setSelectedApp(null) }}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    {selectedApp && (() => {
                        const cfg = STATUS_CONFIG[selectedApp.status] || STATUS_CONFIG.pending
                        const StatusIcon = cfg.icon
                        const idNumber = selectedApp.id_number || selectedApp.ghana_card || 'N/A'
                        const idType = selectedApp.id_type || 'Ghana Card'
                        const isUpdating = updatingId === selectedApp.id

                        return (
                            <>
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                        <ShieldCheck className="w-5 h-5 text-yellow-500" />
                                        Application Details
                                    </DialogTitle>
                                    <DialogDescription>
                                        MTN AFAR 30-Day Registration — Submitted {format(new Date(selectedApp.created_at), 'dd MMM yyyy, hh:mm a')}
                                    </DialogDescription>
                                </DialogHeader>

                                {/* Status Badge */}
                                <div className="flex items-center justify-between py-1">
                                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase px-3 py-1 rounded-full ${cfg.color}`}>
                                        <StatusIcon className="w-3.5 h-3.5" />
                                        {cfg.label}
                                    </span>
                                    {selectedApp.payment_amount != null && (
                                        <span className="text-sm font-semibold text-muted-foreground">
                                            Fee Paid: GHS {selectedApp.payment_amount.toFixed(2)}
                                        </span>
                                    )}
                                </div>

                                {/* Field Data */}
                                <div className="rounded-xl border bg-muted/30 dark:bg-muted/10 px-4 py-1 space-y-0">
                                    <CopyField label="Full Name" value={selectedApp.full_name} />
                                    <CopyField label="Phone Number" value={selectedApp.phone} />
                                    <CopyField label="ID Type" value={idType} />
                                    <CopyField label="ID Number" value={idNumber} />
                                    <CopyField label="Region" value={selectedApp.region} />
                                    <CopyField label="City / Town" value={selectedApp.location} />
                                    <CopyField label="Occupation" value={selectedApp.occupation || 'Farmer'} />
                                    {selectedApp.notes && (
                                        <CopyField label="Notes" value={selectedApp.notes} />
                                    )}
                                </div>

                                {/* ─── Download Button ─── */}
                                <Button
                                    className="w-full gap-2 bg-yellow-500 hover:bg-yellow-600 text-white"
                                    onClick={() => handleDownload(selectedApp)}
                                    disabled={downloading}
                                >
                                    {downloading ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Downloading...</>
                                    ) : (
                                        <><Download className="w-4 h-4" /> Download Application & Set Processing</>
                                    )}
                                </Button>

                                {/* ─── Status Controls ─── */}
                                <div className="space-y-2">
                                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Update Status</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-1.5 border-yellow-300 text-yellow-700 hover:bg-yellow-50 dark:border-yellow-800 dark:text-yellow-400 dark:hover:bg-yellow-900/20"
                                            disabled={isUpdating || selectedApp.status === 'pending'}
                                            onClick={() => updateStatus(selectedApp.id, 'pending')}
                                        >
                                            {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                                            Pending
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/20"
                                            disabled={isUpdating || selectedApp.status === 'processing'}
                                            onClick={() => updateStatus(selectedApp.id, 'processing')}
                                        >
                                            {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                                            Processing
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-1.5 border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/20"
                                            disabled={isUpdating || selectedApp.status === 'completed'}
                                            onClick={() => updateStatus(selectedApp.id, 'completed')}
                                        >
                                            {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                            Completed
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                                            disabled={isUpdating || selectedApp.status === 'cancelled'}
                                            onClick={() => updateStatus(selectedApp.id, 'cancelled')}
                                        >
                                            {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                                            Cancelled
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )
                    })()}
                </DialogContent>
            </Dialog>
        </div>
    )
}
