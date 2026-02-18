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
import { Settings, ArrowLeft, Save, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface GlobalSettings {
    shop_feature_enabled: boolean
    withdrawal_fee_percent: number
    withdrawal_fee_flat: number
    min_withdrawal_amount: number
    shop_paystack_fee_percent: number
    default_fulfillment_mode: 'auto' | 'manual'
}

const DEFAULTS: GlobalSettings = {
    shop_feature_enabled: true,
    withdrawal_fee_percent: 5,
    withdrawal_fee_flat: 0,
    min_withdrawal_amount: 10,
    shop_paystack_fee_percent: 1.95,
    default_fulfillment_mode: 'auto',
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
                withdrawal_fee_percent: parseFloat(map.withdrawal_fee_percent) || DEFAULTS.withdrawal_fee_percent,
                withdrawal_fee_flat: parseFloat(map.withdrawal_fee_flat) || DEFAULTS.withdrawal_fee_flat,
                min_withdrawal_amount: parseFloat(map.min_withdrawal_amount) || DEFAULTS.min_withdrawal_amount,
                shop_paystack_fee_percent: parseFloat(map.shop_paystack_fee_percent) || DEFAULTS.shop_paystack_fee_percent,
                default_fulfillment_mode: map.default_fulfillment_mode || DEFAULTS.default_fulfillment_mode,
            })
        }
        setLoading(false)
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const rows = [
                { key: 'shop_feature_enabled', value: settings.shop_feature_enabled },
                { key: 'withdrawal_fee_percent', value: settings.withdrawal_fee_percent },
                { key: 'withdrawal_fee_flat', value: settings.withdrawal_fee_flat },
                { key: 'min_withdrawal_amount', value: settings.min_withdrawal_amount },
                { key: 'shop_paystack_fee_percent', value: settings.shop_paystack_fee_percent },
                { key: 'default_fulfillment_mode', value: settings.default_fulfillment_mode },
            ]

            for (const row of rows) {
                await (supabase as any).from('shop_global_settings').upsert(
                    { key: row.key, value: row.value, updated_at: new Date().toISOString() },
                    { onConflict: 'key' }
                )
            }

            toast.success('Global settings saved!')
        } catch (err: any) {
            toast.error(err.message || 'Failed to save settings')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="space-y-4 max-w-lg">
                <Skeleton className="h-8 w-48" />
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-lg">
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
                    <p className="text-muted-foreground text-sm">Platform-wide defaults for all shops.</p>
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

            {/* Fees */}
            <Card>
                <CardHeader><CardTitle className="text-sm">Fee Configuration</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="paystack_fee">Default Paystack Fee (%)</Label>
                        <Input
                            id="paystack_fee"
                            type="number"
                            min="0"
                            max="10"
                            step="0.01"
                            value={settings.shop_paystack_fee_percent}
                            onChange={(e) => setSettings(prev => ({ ...prev, shop_paystack_fee_percent: parseFloat(e.target.value) || 0 }))}
                            className="mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Added on top of selling price to cover Paystack charges. Can be overridden per shop.</p>
                    </div>

                    <div>
                        <Label htmlFor="withdrawal_fee_percent">Withdrawal Fee (%)</Label>
                        <Input
                            id="withdrawal_fee_percent"
                            type="number"
                            min="0"
                            max="50"
                            step="0.1"
                            value={settings.withdrawal_fee_percent}
                            onChange={(e) => setSettings(prev => ({ ...prev, withdrawal_fee_percent: parseFloat(e.target.value) || 0 }))}
                            className="mt-1"
                        />
                    </div>

                    <div>
                        <Label htmlFor="withdrawal_fee_flat">Withdrawal Flat Fee (GHS)</Label>
                        <Input
                            id="withdrawal_fee_flat"
                            type="number"
                            min="0"
                            step="0.01"
                            value={settings.withdrawal_fee_flat}
                            onChange={(e) => setSettings(prev => ({ ...prev, withdrawal_fee_flat: parseFloat(e.target.value) || 0 }))}
                            className="mt-1"
                        />
                    </div>

                    <div>
                        <Label htmlFor="min_withdrawal">Minimum Withdrawal Amount (GHS)</Label>
                        <Input
                            id="min_withdrawal"
                            type="number"
                            min="1"
                            step="0.01"
                            value={settings.min_withdrawal_amount}
                            onChange={(e) => setSettings(prev => ({ ...prev, min_withdrawal_amount: parseFloat(e.target.value) || 1 }))}
                            className="mt-1"
                        />
                    </div>
                </CardContent>
            </Card>

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
