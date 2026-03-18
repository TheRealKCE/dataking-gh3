import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, ShieldCheck, TrendingDown } from 'lucide-react'

// Next.js config to ensure it's dynamically rendered
export const dynamic = 'force-dynamic'

export default function AdminProfitLogsPage() {
    return <AdminProfitLogsContent />
}

async function AdminProfitLogsContent() {
    const cookieStore = cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })

    // Verify Admin authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) redirect('/admin/login')

    const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single()

    if (userData?.role !== 'admin' && userData?.role !== 'sub-admin') {
        redirect('/admin')
    }

    // Fetch the latest 500 immutable logs
    const { data: logs, error } = await supabase
        .from('admin_profit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)

    if (error) {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <Card className="border-red-500 bg-red-50">
                    <CardContent className="pt-6 text-center text-red-600">
                        <AlertCircle className="w-12 h-12 mx-auto mb-4" />
                        <p className="font-semibold text-lg">Failed to load audit logs</p>
                        <p className="text-sm">{error.message}</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const losses = logs?.filter(log => log.is_loss) || []
    const latestLogs = logs || []

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6 bg-zinc-50/50 min-h-screen">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                    <ShieldCheck className="w-8 h-8 text-indigo-600" />
                    Profit Audit Logs
                </h1>
                <p className="text-muted-foreground max-w-3xl">
                    Immutable read-only ledger of every completed transaction. These records are 100% accurate at the time of purchase and are never re-calculated. They act as the absolute source of truth for the financial dashboard.
                </p>
            </div>

            {/* HIGHLIGHT: PRICING ANOMALIES (LOSSES) */}
            {losses.length > 0 && (
                <Card className="border-red-200 bg-red-50/50 shadow-sm">
                    <CardHeader className="pb-3 border-b border-red-100">
                        <CardTitle className="text-red-700 font-semibold flex items-center gap-2">
                            <TrendingDown className="w-5 h-5" />
                            Pricing Anomalies Detected ({losses.length})
                        </CardTitle>
                        <CardDescription className="text-red-600/80">
                            The system has detected transactions where the platform lost money. Review your package cost vs selling prices immediately to prevent further losses.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 max-h-[300px] overflow-auto">
                        <div className="space-y-3">
                            {losses.slice(0, 10).map(loss => (
                                <div key={loss.id} className="bg-white p-3 rounded-lg border border-red-100 flex items-center justify-between shadow-sm">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="destructive" className="bg-red-500 hover:bg-red-600">LOSS</Badge>
                                            <span className="text-sm font-medium">{formatDate(loss.created_at)}</span>
                                            <span className="text-xs text-muted-foreground border px-2 py-0.5 rounded-full uppercase bg-slate-50">{loss.channel}</span>
                                        </div>
                                        <p className="text-sm font-mono text-slate-700 bg-slate-50 px-2 py-1 rounded inline-block mt-1">
                                            {loss.calculation_note}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-red-600">{formatCurrency(loss.profit)}</p>
                                    </div>
                                </div>
                            ))}
                            {losses.length > 10 && (
                                <div className="text-center text-sm text-red-500 pt-2 font-medium">
                                    + {losses.length - 10} more loss records hidden.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* MAIN LOGS DATA TABLE */}
            <Card className="shadow-sm border-0 bg-white">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Recent Financial Logs (Last 500)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-slate-50/50 text-muted-foreground uppercase tracking-wider text-xs">
                                    <th className="py-3 px-4 font-semibold text-left">Date</th>
                                    <th className="py-3 px-4 font-semibold text-left">Type</th>
                                    <th className="py-3 px-4 font-semibold text-right">Selling/Paid</th>
                                    <th className="py-3 px-4 font-semibold text-right">Admin Cost</th>
                                    <th className="py-3 px-4 font-semibold text-right">Profit</th>
                                    <th className="py-3 px-4 font-semibold text-left">Calculation Note</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {latestLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                                            {formatDate(log.created_at)}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex flex-col gap-1 items-start">
                                                <Badge variant="outline" className="uppercase bg-slate-50">{log.channel}</Badge>
                                                <span className="text-xs text-muted-foreground px-1">{log.role_at_time}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-right font-medium">
                                            {formatCurrency(log.channel === 'main' ? log.selling_price : log.amount_paid_to_admin)}
                                        </td>
                                        <td className="py-3 px-4 text-right font-medium text-amber-700">
                                            {formatCurrency(log.admin_cost)}
                                        </td>
                                        <td className="py-3 px-4 text-right font-bold">
                                            <span className={log.is_loss ? 'text-red-600' : 'text-emerald-600'}>
                                                {log.is_loss ? '' : '+'}{formatCurrency(log.profit)}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <code className="bg-slate-50 text-slate-700 px-2 py-1 rounded text-xs whitespace-nowrap border border-slate-100">
                                                {log.calculation_note}
                                            </code>
                                        </td>
                                    </tr>
                                ))}
                                {latestLogs.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-muted-foreground bg-slate-50/30">
                                            <ShieldCheck className="w-8 h-8 mx-auto mb-3 opacity-20" />
                                            No profit logs found. Orders must be completed to appear here.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
