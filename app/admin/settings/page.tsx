'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'

export default function AdminSettingsPage() {
    const [settings, setSettings] = useState<any>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Form states
    const [paystackFee, setPaystackFee] = useState('1.95')
    const [mtnAdjustment, setMtnAdjustment] = useState('0')
    const [supportEmail, setSupportEmail] = useState('')
    const [autoFulfillment, setAutoFulfillment] = useState(true)

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('admin_settings')
                .select('*')

            if (error) throw error

            const settingsMap = data.reduce((acc: any, curr: any) => {
                acc[curr.key] = curr.value
                return acc
            }, {})

            setSettings(settingsMap)

            // Initialize form values
            setPaystackFee(settingsMap.paystack_fee_percent || '1.95')
            setMtnAdjustment(settingsMap.mtn_price_adjustment || '0')
            setSupportEmail(settingsMap.support_email || '')
            setAutoFulfillment(settingsMap.auto_fulfillment_enabled === 'true')

        } catch (error) {
            console.error('Error fetching settings:', error)
            toast.error('Failed to load settings')
        } finally {
            setLoading(false)
        }
    }

    const saveSettings = async () => {
        setSaving(true)
        try {
            const updates = [
                { key: 'paystack_fee_percent', value: paystackFee },
                { key: 'mtn_price_adjustment', value: mtnAdjustment },
                { key: 'support_email', value: supportEmail },
                { key: 'auto_fulfillment_enabled', value: String(autoFulfillment) }
            ]

            const { error } = await supabase
                .from('admin_settings')
                .upsert(updates)

            if (error) throw error
            toast.success('Settings saved successfully')
        } catch (error) {
            console.error('Error saving settings:', error)
            toast.error('Failed to save settings')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>
    }

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">System Settings</h1>
                    <p className="text-muted-foreground">Configure detailed platform parameters</p>
                </div>
                <Button onClick={saveSettings} disabled={saving}>
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                </Button>
            </div>

            <Tabs defaultValue="general">
                <TabsList>
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="fees">Fees & Pricing</TabsTrigger>
                    <TabsTrigger value="fulfillment">Fulfillment</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Support Information</CardTitle>
                            <CardDescription>Contact details displayed to users</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Support Email</Label>
                                <Input
                                    value={supportEmail}
                                    onChange={(e) => setSupportEmail(e.target.value)}
                                    placeholder="support@ghdata.com"
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="fees" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Payment & Fees</CardTitle>
                            <CardDescription>Configure transaction fees</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Paystack Fee Percentage (%)</Label>
                                <Input
                                    type="number"
                                    value={paystackFee}
                                    onChange={(e) => setPaystackFee(e.target.value)}
                                    step="0.01"
                                />
                                <p className="text-xs text-muted-foreground">Fee passed on to users during wallet top-up</p>
                            </div>
                            <div className="space-y-2">
                                <Label>MTN Price Adjustment (GHS)</Label>
                                <Input
                                    type="number"
                                    value={mtnAdjustment}
                                    onChange={(e) => setMtnAdjustment(e.target.value)}
                                    step="0.01"
                                />
                                <p className="text-xs text-muted-foreground">Additional markup fee for all MTN packages</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="fulfillment" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Auto Fulfillment</CardTitle>
                            <CardDescription>Control automated order processing</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Enable Auto-Fulfillment</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Automatically process orders via APIs
                                    </p>
                                </div>
                                <Switch
                                    checked={autoFulfillment}
                                    onCheckedChange={setAutoFulfillment}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
