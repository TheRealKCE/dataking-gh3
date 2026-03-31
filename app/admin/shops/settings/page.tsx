'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Settings, ArrowLeft, Save, Loader2, AlertCircle, Users, UserCheck } from 'lucide-react'
import { toast } from 'sonner'

interface RoleFeeConfig {
    paystack_fee_percent: string
    withdrawal_fee_percent: string
    withdrawal_fee_flat: string
    min_withdrawal_amount: string
}

interface GlobalSettings {
    shop_feature_enabled: boolean
    default_fulfillment_mode: 'auto' | 'manual'
    customer: RoleFeeConfig
    agent: RoleFeeConfig
}

const DEFAULTS: GlobalSettings = {
    shop_feature_enabled: true,
    default_fulfillment_mode: 'auto',
    customer: {
        paystack_fee_percent: '1.95',
        withdrawal_fee_percent: '5.0',
        withdrawal_fee_flat: '0.0',
        min_withdrawal_amount: '50.0',
    },
    agent: {
        paystack_fee_percent: '1.50',
        withdrawal_fee_percent: '3.0',
        withdrawal_fee_flat: '0.0',
        min_withdrawal_amount: '30.0',
    },
}

function RoleFeeCard({
    title,
    subtitle,
    icon: Icon,
    iconColor,
    borderColor,
    config,
    onChange,
}: {
    title: string
    subtitle: string
    icon: React.ElementType
    iconColor: string
    borderColor: string
    config: RoleFeeConfig
    onChange: (key: keyof RoleFeeConfig, value: string) => void
}) {
    return (
        <Card className={`border-2 ${borderColor}`}>
            <CardHeader className="pb-3">
                <CardTitle className={`text-sm flex items-center gap-2 ${iconColor}`}>
                    <Icon className="w-4 h-4" />
                    {title}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{subtitle}</p>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <Label htmlFor={`${title}_paystack_fee`}>Paystack Fee (%)</Label>
                    <Input
                        id={`${title}_paystack_fee`}
                        type="number"
                        min="0"
                        max="10"
                        step="0.01"
                        value={config.paystack_fee_percent}
                        onChange={(e) => onChange('paystack_fee_percent', e.target.value)}
                        className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                        Added on top of selling price to cover Paystack charges for {title.toLowerCase()} shops.
                    </p>
                </div>

                <div>
                    <Label htmlFor={`${title}_withdrawal_fee_percent`}>Withdrawal Fee (%)</Label>
                    <Input
                        id={`${title}_withdrawal_fee_percent`}
                        type="number"
                        min="0"
                        max="50"
                        step="0.1"
                        value={config.withdrawal_fee_percent}
                        onChange={(e) => onChange('withdrawal_fee_percent', e.target.value)}
                        className="mt-1"
                    />
                </div>

                <div>
                    <Label htmlFor={`${title}_withdrawal_fee_flat`}>Withdrawal Flat Fee (GHS)</Label>
                    <Input
                        id={`${title}_withdrawal_fee_flat`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={config.withdrawal_fee_flat}
                        onChange={(e) => onChange('withdrawal_fee_flat', e.target.value)}
                        className="mt-1"
                    />
                </div>

                <div>
                    <Label htmlFor={`${title}_min_withdrawal`}>Minimum Withdrawal Amount (GHS)</Label>
                    <Input
                        id={`${title}_min_withdrawal`}
                        type="number"
                        min="1"
                        step="0.01"
                        value={config.min_withdrawal_amount}
                        onChange={(e) => onChange('min_withdrawal_amount', e.target.value)}
                        className="mt-1"
                    />
                </div>
            </CardContent>
        </Card>
    )
}

export default function AdminShopSettingsPage() {
    const { dbUser, isAdmin } = useAuth()
    const router = useRouter()
    const [settings, setSettings] = useState<GlobalSettings>(DEFAULTS)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (dbUser && !isAdmin) { router.replace('/dashboard'); return }
        if (dbUser) fetchSettings()
    }, [dbUser, isAdmin])

    const fetchSettings = async () => {
        const { data } = await (supabase as any).from('shop_global_settings').select('*')
        if (data) {
            const map: Record<string, any> = {}
            for (const row of data) {
                map[row.key] = row.value
            }
            setSettings({
                shop_feature_enabled: map.shop_feature_enabled !== false && map.shop_feature_enabled !== 'false',
                default_fulfillment_mode: map.default_fulfillment_mode || DEFAULTS.default_fulfillment_mode,
                customer: {
                    paystack_fee_percent:  map.shop_paystack_fee_percent_customer  != null ? String(parseFloat(map.shop_paystack_fee_percent_customer))  : DEFAULTS.customer.paystack_fee_percent,
                    withdrawal_fee_percent: map.withdrawal_fee_percent_customer     != null ? String(parseFloat(map.withdrawal_fee_percent_customer))     : DEFAULTS.customer.withdrawal_fee_percent,
                    withdrawal_fee_flat:    map.withdrawal_fee_flat_customer        != null ? String(parseFloat(map.withdrawal_fee_flat_customer))        : DEFAULTS.customer.withdrawal_fee_flat,
                    min_withdrawal_amount:  map.min_withdrawal_amount_customer      != null ? String(parseFloat(map.min_withdrawal_amount_customer))      : DEFAULTS.customer.min_withdrawal_amount,
                },
                agent: {
                    paystack_fee_percent:  map.shop_paystack_fee_percent_agent     != null ? String(parseFloat(map.shop_paystack_fee_percent_agent))     : DEFAULTS.agent.paystack_fee_percent,
                    withdrawal_fee_percent: map.withdrawal_fee_percent_agent        != null ? String(parseFloat(map.withdrawal_fee_percent_agent))        : DEFAULTS.agent.withdrawal_fee_percent,
                    withdrawal_fee_flat:    map.withdrawal_fee_flat_agent           != null ? String(parseFloat(map.withdrawal_fee_flat_agent))           : DEFAULTS.agent.withdrawal_fee_flat,
                    min_withdrawal_amount:  map.min_withdrawal_amount_agent         != null ? String(parseFloat(map.min_withdrawal_amount_agent))         : DEFAULTS.agent.min_withdrawal_amount,
                },
            })
        }
        setLoading(false)
    }

    const updateRoleConfig = (role: 'customer' | 'agent', key: keyof RoleFeeConfig, value: string) => {
        setSettings(prev => ({
            ...prev,
            [role]: { ...prev[role], [key]: value },
        }))
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const now = new Date().toISOString()

            // NaN-safe parser: empty string → 0, valid numbers → that number.
            const safeParse = (val: string): number => {
                const n = parseFloat(val)
                return isNaN(n) ? 0 : n
            }

            const rows = [
                // Platform control
                { key: 'shop_feature_enabled',      value: settings.shop_feature_enabled,      updated_at: now },
                { key: 'default_fulfillment_mode',  value: settings.default_fulfillment_mode,  updated_at: now },
                // Customer-specific fees
                { key: 'shop_paystack_fee_percent_customer',  value: safeParse(settings.customer.paystack_fee_percent),  updated_at: now },
                { key: 'withdrawal_fee_percent_customer',     value: safeParse(settings.customer.withdrawal_fee_percent), updated_at: now },
                { key: 'withdrawal_fee_flat_customer',        value: safeParse(settings.customer.withdrawal_fee_flat),    updated_at: now },
                { key: 'min_withdrawal_amount_customer',      value: safeParse(settings.customer.min_withdrawal_amount),  updated_at: now },
                // Agent-specific fees
                { key: 'shop_paystack_fee_percent_agent',     value: safeParse(settings.agent.paystack_fee_percent),     updated_at: now },
                { key: 'withdrawal_fee_percent_agent',        value: safeParse(settings.agent.withdrawal_fee_percent),    updated_at: now },
                { key: 'withdrawal_fee_flat_agent',           value: safeParse(settings.agent.withdrawal_fee_flat),       updated_at: now },
                { key: 'min_withdrawal_amount_agent',         value: safeParse(settings.agent.min_withdrawal_amount),     updated_at: now },
            ]

            // Use the server-side API route which uses the service role client.
            // Direct browser-client upserts on shop_global_settings fail silently
            // because no write RLS policy exists for authenticated users.
            const res = await fetch('/api/admin/shop/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows }),
            })
            const result = await res.json()
            if (!res.ok) throw new Error(result.error || 'Failed to save settings')

            toast.success('Global settings saved! Changes take effect immediately for all shops without custom overrides.')
        } catch (err: any) {
            toast.error(err.message || 'Failed to save settings')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="space-y-4 max-w-2xl">
                <Skeleton className="h-8 w-48" />
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-2xl">
            <div className="flex items-center gap-3">
                <Link href="/admin/shops">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Settings className="w-5 h-5 text-emerald-600" />
                        Global Shop Settings
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Platform-wide defaults. Shops without custom overrides inherit these instantly on save.
                    </p>
                </div>
            </div>

            {/* Master Kill Switch */}
            <Card className={!settings.shop_feature_enabled ? 'border-red-500' : ''}>
                <CardHeader><CardTitle className="text-sm">Platform Control</CardTitle></CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                            <p className="text-sm font-medium">Shop Feature Enabled</p>
                            <p className="text-xs text-muted-foreground">Master kill switch — disables all shop checkouts</p>
                        </div>
                        <Switch
                            checked={settings.shop_feature_enabled}
                            onCheckedChange={(v) => setSettings(prev => ({ ...prev, shop_feature_enabled: v }))}
                        />
                    </div>
                    {!settings.shop_feature_enabled && (
                        <div className="mt-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex gap-2 text-sm text-red-700 dark:text-red-300">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>All shop checkouts are currently disabled. Customers cannot make payments.</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Role-Specific Fee Configuration */}
            <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Fee Configuration by Role
                </h2>
                <p className="text-xs text-muted-foreground mb-4">
                    These are the default fees applied to all shops based on whether the owner is a Customer or Agent.
                    Shops with custom admin-set overrides will not be affected by changes here.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <RoleFeeCard
                        title="Customer"
                        subtitle="Applies to shops owned by regular customers"
                        icon={Users}
                        iconColor="text-blue-600"
                        borderColor="border-blue-200 dark:border-blue-800"
                        config={settings.customer}
                        onChange={(key, value) => updateRoleConfig('customer', key, value)}
                    />
                    <RoleFeeCard
                        title="Agent"
                        subtitle="Applies to shops owned by subscribed agents"
                        icon={UserCheck}
                        iconColor="text-emerald-600"
                        borderColor="border-emerald-200 dark:border-emerald-800"
                        config={settings.agent}
                        onChange={(key, value) => updateRoleConfig('agent', key, value)}
                    />
                </div>
            </div>

            {/* Fulfillment */}
            <Card>
                <CardHeader><CardTitle className="text-sm">Default Fulfillment Mode</CardTitle></CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                            <p className="text-sm font-medium">Auto Fulfillment</p>
                            <p className="text-xs text-muted-foreground">Default for new shops. Can be overridden per shop.</p>
                        </div>
                        <Switch
                            checked={settings.default_fulfillment_mode === 'auto'}
                            onCheckedChange={(v) => setSettings(prev => ({ ...prev, default_fulfillment_mode: v ? 'auto' : 'manual' }))}
                        />
                    </div>
                </CardContent>
            </Card>

            <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-11 font-semibold gap-2"
            >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Save Global Settings'}
            </Button>
        </div>
    )
}
