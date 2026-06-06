'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Key,
    Copy,
    Check,
    RefreshCw,
    Trash2,
    Loader2,
    Terminal,
    ShieldCheck,
    Clock,
    AlertTriangle,
    Eye,
    EyeOff,
    Code2,
    Activity,
    Wallet,
    ShoppingCart,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate, cn } from '@/lib/utils'

type Lang = 'curl' | 'javascript' | 'nodejs' | 'python' | 'php'

interface ApiKey {
    key_prefix: string
    name: string
    status: 'pending' | 'active' | 'revoked'
    last_used_at: string | null
    created_at: string
}

interface ApiLog {
    id: string
    endpoint: string
    method: string
    status_code: number
    response_time_ms: number
    ip_address: string
    error_message: string | null
    created_at: string
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
    pending: { label: 'Pending Approval', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    active:  { label: 'Active',           className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    revoked: { label: 'Revoked',          className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

const LANGS: { id: Lang; label: string }[] = [
    { id: 'curl',       label: 'cURL'       },
    { id: 'javascript', label: 'JavaScript' },
    { id: 'nodejs',     label: 'Node.js'    },
    { id: 'python',     label: 'Python'     },
    { id: 'php',        label: 'PHP'        },
]

const BASE = 'https://www.dataking.qzz.io'
const KEY  = 'YOUR_API_KEY'

const ENDPOINTS: {
    icon: React.ElementType
    method: 'GET' | 'POST'
    path: string
    label: string
    desc: string
    snippets: Record<Lang, string>
}[] = [
    {
        icon: Wallet,
        method: 'GET',
        path: '/api/v1/wallet/balance',
        label: 'Wallet Balance',
        desc: 'Returns your current wallet balance and total amount spent.',
        snippets: {
            curl: `curl -H "Authorization: ${KEY}" \\
  ${BASE}/api/v1/wallet/balance`,

            javascript: `const response = await fetch('${BASE}/api/v1/wallet/balance', {
  headers: { 'Authorization': '${KEY}' }
});
const data = await response.json();
console.log(data);`,

            nodejs: `const axios = require('axios');

const { data } = await axios.get('${BASE}/api/v1/wallet/balance', {
  headers: { Authorization: '${KEY}' }
});
console.log(data);`,

            python: `import requests

response = requests.get(
    '${BASE}/api/v1/wallet/balance',
    headers={'Authorization': '${KEY}'}
)
print(response.json())`,

            php: `<?php
$ch = curl_init('${BASE}/api/v1/wallet/balance');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: ${KEY}'
]);
$response = curl_exec($ch);
curl_close($ch);
echo $response;`,
        },
    },
    {
        icon: ShoppingCart,
        method: 'POST',
        path: '/api/v1/data/purchase',
        label: 'Buy Data Bundle',
        desc: 'Purchase a single data bundle. Supported networks: MTN, Telecel, AT.',
        snippets: {
            curl: `curl -X POST \\
  -H "Authorization: ${KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{"network":"MTN","volume_gb":"1","recipient":"0241234567"}' \\
  ${BASE}/api/v1/data/purchase`,

            javascript: `const response = await fetch('${BASE}/api/v1/data/purchase', {
  method: 'POST',
  headers: {
    'Authorization': '${KEY}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    network: 'MTN',
    volume_gb: '1',
    recipient: '0241234567'
  })
});
const data = await response.json();
console.log(data);`,

            nodejs: `const axios = require('axios');

const { data } = await axios.post(
  '${BASE}/api/v1/data/purchase',
  { network: 'MTN', volume_gb: '1', recipient: '0241234567' },
  { headers: { Authorization: '${KEY}' } }
);
console.log(data);`,

            python: `import requests

response = requests.post(
    '${BASE}/api/v1/data/purchase',
    json={'network': 'MTN', 'volume_gb': '1', 'recipient': '0241234567'},
    headers={'Authorization': '${KEY}'}
)
print(response.json())`,

            php: `<?php
$payload = json_encode([
    'network'   => 'MTN',
    'volume_gb' => '1',
    'recipient' => '0241234567'
]);

$ch = curl_init('${BASE}/api/v1/data/purchase');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: ${KEY}',
    'Content-Type: application/json'
]);
$response = curl_exec($ch);
curl_close($ch);
echo $response;`,
        },
    },
    {
        icon: Code2,
        method: 'POST',
        path: '/api/v1/data/bulk',
        label: 'Bulk Data Purchase',
        desc: 'Purchase up to 100 data bundles in a single atomic request. Wallet is debited once for the total.',
        snippets: {
            curl: `curl -X POST \\
  -H "Authorization: ${KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "orders": [
      {"network":"MTN",     "volume_gb":"1","recipient":"0241234567"},
      {"network":"Telecel", "volume_gb":"2","recipient":"0501234567"},
      {"network":"AT",      "volume_gb":"5","recipient":"0271234567"}
    ]
  }' \\
  ${BASE}/api/v1/data/bulk`,

            javascript: `const response = await fetch('${BASE}/api/v1/data/bulk', {
  method: 'POST',
  headers: {
    'Authorization': '${KEY}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    orders: [
      { network: 'MTN',     volume_gb: '1', recipient: '0241234567' },
      { network: 'Telecel', volume_gb: '2', recipient: '0501234567' },
      { network: 'AT',      volume_gb: '5', recipient: '0271234567' }
    ]
  })
});
const data = await response.json();
console.log(data);`,

            nodejs: `const axios = require('axios');

const { data } = await axios.post(
  '${BASE}/api/v1/data/bulk',
  {
    orders: [
      { network: 'MTN',     volume_gb: '1', recipient: '0241234567' },
      { network: 'Telecel', volume_gb: '2', recipient: '0501234567' },
      { network: 'AT',      volume_gb: '5', recipient: '0271234567' }
    ]
  },
  { headers: { Authorization: '${KEY}' } }
);
console.log(data);`,

            python: `import requests

response = requests.post(
    '${BASE}/api/v1/data/bulk',
    json={
        'orders': [
            {'network': 'MTN',     'volume_gb': '1', 'recipient': '0241234567'},
            {'network': 'Telecel', 'volume_gb': '2', 'recipient': '0501234567'},
            {'network': 'AT',      'volume_gb': '5', 'recipient': '0271234567'},
        ]
    },
    headers={'Authorization': '${KEY}'}
)
print(response.json())`,

            php: `<?php
$payload = json_encode([
    'orders' => [
        ['network' => 'MTN',     'volume_gb' => '1', 'recipient' => '0241234567'],
        ['network' => 'Telecel', 'volume_gb' => '2', 'recipient' => '0501234567'],
        ['network' => 'AT',      'volume_gb' => '5', 'recipient' => '0271234567'],
    ]
]);

$ch = curl_init('${BASE}/api/v1/data/bulk');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: ${KEY}',
    'Content-Type: application/json'
]);
$response = curl_exec($ch);
curl_close($ch);
echo $response;`,
        },
    },
    {
        icon: Activity,
        method: 'GET',
        path: '/api/v1/orders/:reference',
        label: 'Order Status',
        desc: 'Check the current status of any order using its reference code.',
        snippets: {
            curl: `curl -H "Authorization: ${KEY}" \\
  ${BASE}/api/v1/orders/REF-XXXXXXXX`,

            javascript: `const ref = 'REF-XXXXXXXX';
const response = await fetch(\`${BASE}/api/v1/orders/\${ref}\`, {
  headers: { 'Authorization': '${KEY}' }
});
const data = await response.json();
console.log(data);`,

            nodejs: `const axios = require('axios');

const ref = 'REF-XXXXXXXX';
const { data } = await axios.get(\`${BASE}/api/v1/orders/\${ref}\`, {
  headers: { Authorization: '${KEY}' }
});
console.log(data);`,

            python: `import requests

ref = 'REF-XXXXXXXX'
response = requests.get(
    f'${BASE}/api/v1/orders/{ref}',
    headers={'Authorization': '${KEY}'}
)
print(response.json())`,

            php: `<?php
$ref = 'REF-XXXXXXXX';
$ch  = curl_init("${BASE}/api/v1/orders/{$ref}");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: ${KEY}'
]);
$response = curl_exec($ch);
curl_close($ch);
echo $response;`,
        },
    },
]

export default function DeveloperApiPage() {
    const { dbUser } = useAuth()
    const router = useRouter()

    const [apiKey, setApiKey] = useState<ApiKey | null | undefined>(undefined)
    const [logs, setLogs] = useState<ApiLog[]>([])
    const [logsLoading, setLogsLoading] = useState(true)

    const [generateOpen, setGenerateOpen] = useState(false)
    const [approvalOpen, setApprovalOpen] = useState(false)
    const [revokeOpen, setRevokeOpen] = useState(false)
    const [newKey, setNewKey] = useState<string | null>(null)
    const [keyCopied, setKeyCopied] = useState(false)
    const [keyVisible, setKeyVisible] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [isRevoking, setIsRevoking] = useState(false)
    const [adminWhatsapp, setAdminWhatsapp] = useState('')

    const [activeLang, setActiveLang] = useState<Lang>('curl')
    const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null)

    const fetchKey = useCallback(async () => {
        const res = await fetch('/api/user/api-keys')
        const json = await res.json()
        setApiKey(json.key ?? null)
    }, [])

    const fetchLogs = useCallback(async () => {
        setLogsLoading(true)
        try {
            const res = await fetch('/api/user/api-keys/logs')
            if (res.ok) {
                const json = await res.json()
                setLogs(json.data?.logs ?? [])
            }
        } finally {
            setLogsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchKey()
        fetchLogs()
        fetch('/api/admin-settings?keys=whatsapp_admin_number')
            .then(r => r.json())
            .then(d => { if (d.whatsapp_admin_number) setAdminWhatsapp(d.whatsapp_admin_number) })
            .catch(() => {})
    }, [fetchKey, fetchLogs])

    useEffect(() => {
        if (dbUser && dbUser.role !== 'agent' && dbUser.role !== 'admin' && dbUser.role !== 'sub-admin') {
            router.push('/dashboard/upgrade')
        }
    }, [dbUser, router])

    const handleGenerate = async () => {
        setIsGenerating(true)
        try {
            const res = await fetch('/api/user/api-keys', { method: 'POST' })
            const json = await res.json()
            if (!res.ok) {
                toast.error(json.error || 'Failed to generate key')
                return
            }
            setNewKey(json.key)
            setKeyVisible(true)
            setGenerateOpen(false)
            await fetchKey()
            setApprovalOpen(true)
        } catch {
            toast.error('Something went wrong')
        } finally {
            setIsGenerating(false)
        }
    }

    const handleRevoke = async () => {
        setIsRevoking(true)
        try {
            const res = await fetch('/api/user/api-keys', { method: 'DELETE' })
            if (!res.ok) {
                const json = await res.json()
                toast.error(json.error?.message || 'Failed to revoke key')
                return
            }
            toast.success('API key deleted')
            setApiKey(null)
            setNewKey(null)
            setRevokeOpen(false)
        } catch {
            toast.error('Something went wrong')
        } finally {
            setIsRevoking(false)
        }
    }

    const copyKey = () => {
        if (!newKey) return
        navigator.clipboard.writeText(newKey)
        setKeyCopied(true)
        toast.success('API key copied!')
        setTimeout(() => setKeyCopied(false), 2000)
    }

    const copySnippet = (id: string, text: string) => {
        navigator.clipboard.writeText(text)
        setCopiedSnippet(id)
        toast.success('Copied!')
        setTimeout(() => setCopiedSnippet(null), 2000)
    }

    const statusInfo = apiKey ? STATUS_BADGE[apiKey.status] : null

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Developer API</h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Integrate ARHMS into your own apps. Agent plan required.
                </p>
            </div>

            {/* Key Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Key className="w-4 h-4" /> Your API Key
                    </CardTitle>
                    <CardDescription>
                        Keys are shown only once when generated. Keep it secret — treat it like a password.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {apiKey === undefined ? (
                        <Skeleton className="h-16 w-full" />
                    ) : newKey ? (
                        <div className="rounded-xl border border-emerald-400/40 bg-emerald-50/50 dark:bg-emerald-900/10 p-4 space-y-3">
                            <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                                <ShieldCheck className="w-4 h-4" />
                                Key generated — copy it now, it won&apos;t be shown again
                            </div>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 text-xs font-mono bg-background rounded-lg px-3 py-2.5 border border-border/50 truncate select-all">
                                    {keyVisible ? newKey : newKey.replace(/./g, '•')}
                                </code>
                                <Button size="icon" variant="ghost" onClick={() => setKeyVisible(v => !v)} className="shrink-0">
                                    {keyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </Button>
                                <Button size="icon" variant="ghost" onClick={copyKey} className="shrink-0">
                                    {keyCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                </Button>
                            </div>
                        </div>
                    ) : apiKey ? (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', statusInfo?.className)}>
                                        {statusInfo?.label}
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Prefix: <code className="font-mono text-foreground">{apiKey.key_prefix}…</code>
                                </p>
                                {apiKey.last_used_at && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> Last used {formatDate(apiKey.last_used_at)}
                                    </p>
                                )}
                                {apiKey.status === 'pending' && (
                                    <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1 mt-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        Awaiting admin approval before you can make API calls.
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => setGenerateOpen(true)} className="gap-1.5">
                                    <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setRevokeOpen(true)} className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-500/10">
                                    <Trash2 className="w-3.5 h-3.5" /> Delete
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center py-6 gap-3 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                                <Key className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <p className="font-semibold">No API key yet</p>
                                <p className="text-sm text-muted-foreground">Generate a key to start using the API.</p>
                            </div>
                            <Button onClick={() => setGenerateOpen(true)} className="gap-2">
                                <Key className="w-4 h-4" /> Generate API Key
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Endpoints Reference */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Terminal className="w-4 h-4" /> API Endpoints
                            </CardTitle>
                            <CardDescription className="mt-1">
                                Base URL: <code className="font-mono text-foreground text-xs">{BASE}</code>
                                &nbsp;— pass your key as <code className="font-mono text-foreground text-xs">Authorization: YOUR_KEY</code>
                            </CardDescription>
                        </div>

                        {/* Language selector */}
                        <div className="flex gap-1 flex-wrap">
                            {LANGS.map(lang => (
                                <button
                                    key={lang.id}
                                    type="button"
                                    onClick={() => setActiveLang(lang.id)}
                                    className={cn(
                                        'text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors',
                                        activeLang === lang.id
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
                                    )}
                                >
                                    {lang.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {ENDPOINTS.map((ep, i) => (
                        <div key={i} className="rounded-xl border border-border/60 overflow-hidden">
                            {/* Endpoint header */}
                            <div className="flex items-center gap-3 px-4 py-3 bg-secondary/30">
                                <ep.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                                <span className={cn(
                                    'text-[10px] font-black px-1.5 py-0.5 rounded font-mono uppercase',
                                    ep.method === 'GET'
                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                                )}>
                                    {ep.method}
                                </span>
                                <code className="text-xs font-mono text-foreground">{ep.path}</code>
                                <span className="ml-auto text-xs text-muted-foreground hidden sm:block">{ep.label}</span>
                            </div>

                            {/* Snippet */}
                            <div className="px-4 py-3 space-y-2">
                                <p className="text-xs text-muted-foreground">{ep.desc}</p>
                                <div className="relative">
                                    <pre className="text-xs font-mono bg-muted/40 rounded-lg p-3 overflow-x-auto text-foreground/80 leading-relaxed whitespace-pre">
                                        {ep.snippets[activeLang]}
                                    </pre>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="absolute top-2 right-2 w-7 h-7 opacity-60 hover:opacity-100"
                                        onClick={() => copySnippet(`ep-${i}`, ep.snippets[activeLang])}
                                    >
                                        {copiedSnippet === `ep-${i}`
                                            ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                                            : <Copy className="w-3.5 h-3.5" />}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Recent Logs */}
            <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Activity className="w-4 h-4" /> Recent API Logs
                        </CardTitle>
                        <CardDescription>Last 20 requests made with your key.</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" onClick={fetchLogs} className="gap-1.5 shrink-0">
                        <RefreshCw className="w-3.5 h-3.5" /> Refresh
                    </Button>
                </CardHeader>
                <CardContent>
                    {logsLoading ? (
                        <div className="space-y-2">
                            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">No API calls yet.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="text-muted-foreground border-b border-border/50">
                                        <th className="text-left pb-2 font-semibold">Endpoint</th>
                                        <th className="text-left pb-2 font-semibold">Status</th>
                                        <th className="text-left pb-2 font-semibold hidden sm:table-cell">Time</th>
                                        <th className="text-right pb-2 font-semibold hidden md:table-cell">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30">
                                    {logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-secondary/20">
                                            <td className="py-2 pr-4">
                                                <span className={cn(
                                                    'text-[9px] font-black px-1 py-0.5 rounded font-mono mr-1.5',
                                                    log.method === 'GET'
                                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                                                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                                                )}>
                                                    {log.method}
                                                </span>
                                                <code className="text-foreground/80 truncate max-w-[180px] inline-block align-middle">{log.endpoint}</code>
                                            </td>
                                            <td className="py-2 pr-4">
                                                <span className={cn(
                                                    'font-bold',
                                                    log.status_code < 300 ? 'text-emerald-500'
                                                        : log.status_code < 500 ? 'text-yellow-500'
                                                            : 'text-red-500'
                                                )}>
                                                    {log.status_code}
                                                </span>
                                                {log.error_message && (
                                                    <span className="text-muted-foreground ml-2 hidden lg:inline">{log.error_message}</span>
                                                )}
                                            </td>
                                            <td className="py-2 pr-4 hidden sm:table-cell text-muted-foreground">{log.response_time_ms}ms</td>
                                            <td className="py-2 text-right text-muted-foreground hidden md:table-cell">{formatDate(log.created_at)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Generate / Regenerate Dialog */}
            <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{apiKey ? 'Regenerate API Key' : 'Generate API Key'}</DialogTitle>
                        <DialogDescription>
                            {apiKey
                                ? 'This will invalidate your current key immediately. Any apps using it will stop working until updated.'
                                : 'Your key will need admin approval before it becomes active. You will be notified.'}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setGenerateOpen(false)}>Cancel</Button>
                        <Button onClick={handleGenerate} disabled={isGenerating} className="gap-2">
                            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                            {apiKey ? 'Regenerate' : 'Generate'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Admin Approval Dialog — shown after key is generated */}
            <Dialog open={approvalOpen} onOpenChange={setApprovalOpen}>
                <DialogContent className="max-w-sm text-center">
                    <DialogHeader>
                        <div className="flex justify-center mb-3">
                            <div className="w-14 h-14 rounded-full bg-yellow-100 flex items-center justify-center">
                                <ShieldCheck className="w-7 h-7 text-yellow-600" />
                            </div>
                        </div>
                        <DialogTitle className="text-center">Admin Approval Required</DialogTitle>
                        <DialogDescription className="text-center">
                            Your API key has been generated but is <span className="font-semibold text-yellow-600">pending approval</span>. Contact the admin on WhatsApp to get it activated quickly.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-3 py-2">
                        <a
                            href={`https://wa.me/${adminWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi, I just generated my API key and I need admin approval to activate it. My name is ${dbUser?.first_name ?? ''} ${dbUser?.last_name ?? ''} and my email is ${dbUser?.email ?? ''}.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold text-sm transition-colors shadow-md"
                        >
                            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            Contact Admin on WhatsApp
                        </a>
                        <Button variant="outline" onClick={() => setApprovalOpen(false)} className="w-full">
                            I&apos;ll do it later
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Revoke Dialog */}
            <Dialog open={revokeOpen} onOpenChange={setRevokeOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete API Key</DialogTitle>
                        <DialogDescription>
                            This permanently deletes your API key. You can generate a new one anytime, but it will need admin approval again.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRevokeOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleRevoke} disabled={isRevoking} className="gap-2">
                            {isRevoking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            Delete Key
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
