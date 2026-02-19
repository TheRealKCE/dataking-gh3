'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Store, Upload, Phone, Mail, MessageCircle, Palette, Eye, Save, Loader2, ExternalLink, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const BRAND_PRESETS = [
    { name: 'Gold', color: '#FFCE00', accent: '#e6b800' },
    { name: 'Green', color: '#25D366', accent: '#1ebc57' },
    { name: 'Red', color: '#E60000', accent: '#cc0000' },
    { name: 'Ocean Blue', color: '#2563eb', accent: '#1e40af' },
    { name: 'Emerald', color: '#059669', accent: '#065f46' },
    { name: 'Purple', color: '#7c3aed', accent: '#5b21b6' },
    { name: 'Orange', color: '#ea580c', accent: '#c2410c' },
    { name: 'Rose', color: '#e11d48', accent: '#be123c' },
    { name: 'Teal', color: '#0d9488', accent: '#0f766e' },
    { name: 'Slate', color: '#475569', accent: '#334155' },
    { name: 'Amber', color: '#d97706', accent: '#b45309' },
]

interface ShopForm {
    shop_name: string
    shop_slug: string
    description: string
    owner_phone: string
    owner_email: string
    whatsapp_number: string
    brand_color: string
    brand_accent: string
    is_active: boolean
}

export default function ShopSetupPage() {
    const { dbUser, isAdmin, isSubAdmin } = useAuth()
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [existingShopId, setExistingShopId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [logoUrl, setLogoUrl] = useState<string | null>(null)
    const [logoPreview, setLogoPreview] = useState<string | null>(null)
    const [slugTaken, setSlugTaken] = useState(false)
    const [slugChecking, setSlugChecking] = useState(false)

    const [form, setForm] = useState<ShopForm>({
        shop_name: '',
        shop_slug: '',
        description: '',
        owner_phone: '',
        owner_email: '',
        whatsapp_number: '',
        brand_color: '#2563eb',
        brand_accent: '#1e40af',
        is_active: true,
    })

    useEffect(() => {
        if (dbUser && !isAdmin && !isSubAdmin) {
            router.replace('/dashboard')
            return
        }
        if (dbUser) fetchExistingShop()
    }, [dbUser, isAdmin, isSubAdmin])

    const fetchExistingShop = async () => {
        const { data } = await ((supabase as any)
            .from('shop_profiles')
            .select('*')
            .eq('owner_id', dbUser!.id)
            .single())

        if (data) {
            setExistingShopId(data.id)
            setLogoUrl(data.logo_url)
            setLogoPreview(data.logo_url)
            setForm({
                shop_name: data.shop_name || '',
                shop_slug: data.shop_slug || '',
                description: data.description || '',
                owner_phone: data.owner_phone || '',
                owner_email: data.owner_email || '',
                whatsapp_number: data.whatsapp_number || '',
                brand_color: data.brand_color || '#2563eb',
                brand_accent: data.brand_accent || '#1e40af',
                is_active: data.is_active ?? true,
            })
        }
        setLoading(false)
    }

    const generateSlug = (name: string) => {
        return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    }

    const handleNameChange = (value: string) => {
        setForm(prev => ({
            ...prev,
            shop_name: value,
            shop_slug: existingShopId ? prev.shop_slug : generateSlug(value),
        }))
    }

    const checkSlug = async (slug: string) => {
        if (!slug || slug.length < 3) return
        setSlugChecking(true)
        const { data } = await ((supabase as any)
            .from('shop_profiles')
            .select('id')
            .eq('shop_slug', slug)
            .neq('owner_id', dbUser!.id)
            .single())
        setSlugTaken(!!data)
        setSlugChecking(false)
    }

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Logo must be under 5MB')
            return
        }
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            toast.error('Only JPG, PNG, or WEBP images allowed')
            return
        }

        // Preview
        const reader = new FileReader()
        reader.onload = (ev) => setLogoPreview(ev.target?.result as string)
        reader.readAsDataURL(file)

        setUploading(true)
        try {
            const ext = file.name.split('.').pop()
            const path = `${dbUser!.id}/logo.${ext}`
            const { error } = await (supabase.storage.from('shop-logos').upload(path, file, { upsert: true }))
            if (error) throw error
            const { data: urlData } = (supabase.storage.from('shop-logos').getPublicUrl(path))
            setLogoUrl(urlData.publicUrl)
            toast.success('Logo uploaded!')
        } catch (err) {
            toast.error('Upload failed. Please try again.')
            setLogoPreview(logoUrl)
        } finally {
            setUploading(false)
        }
    }

    const handleSave = async () => {
        if (!form.shop_name.trim()) { toast.error('Shop name is required'); return }
        if (!form.shop_slug.trim() || form.shop_slug.length < 3) { toast.error('Slug must be at least 3 characters'); return }
        if (!form.owner_phone.trim()) { toast.error('Owner phone is required'); return }
        if (slugTaken) { toast.error('This slug is already taken'); return }

        setSaving(true)
        try {
            const payload = {
                owner_id: dbUser!.id,
                shop_name: form.shop_name.trim(),
                shop_slug: form.shop_slug.trim(),
                description: form.description.trim(),
                owner_phone: form.owner_phone.trim(),
                owner_email: form.owner_email.trim() || null,
                whatsapp_number: form.whatsapp_number.trim() || null,
                brand_color: form.brand_color,
                brand_accent: form.brand_accent,
                logo_url: logoUrl,
                is_active: form.is_active,
                updated_at: new Date().toISOString(),
            }

            if (existingShopId) {
                const { error } = await ((supabase as any).from('shop_profiles').update(payload).eq('id', existingShopId))
                if (error) throw error
            } else {
                const { error } = await ((supabase as any).from('shop_profiles').insert(payload))
                if (error) throw error
            }

            toast.success(existingShopId ? 'Shop updated!' : 'Shop created! Awaiting admin approval.')
            router.push('/dashboard/shop')
        } catch (err: any) {
            toast.error(err.message || 'Failed to save shop')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="space-y-6 max-w-2xl">
                <Skeleton className="h-8 w-48" />
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
        )
    }

    const shopUrl = form.shop_slug ? `https://kingflexygh.com/shop/${form.shop_slug}` : ''

    return (
        <div className="space-y-6 max-w-2xl">
            {/* Header */}
            <div className="space-y-4">
                <Link href="/dashboard/shop">
                    <Button variant="ghost" size="sm" className="w-fit gap-2 -ml-2 text-muted-foreground hover:text-emerald-600 transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Shop Dashboard
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Store className="w-6 h-6 text-emerald-600" />
                        {existingShopId ? 'Edit Shop' : 'Create Your Shop'}
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        {existingShopId ? 'Update your shop details and branding.' : 'Set up your reseller storefront. An admin will review and approve it.'}
                    </p>
                </div>
            </div>

            {/* Basic Info */}
            <Card>
                <CardHeader><CardTitle className="text-base">Shop Details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="shop_name">Shop Name *</Label>
                        <Input
                            id="shop_name"
                            value={form.shop_name}
                            onChange={(e) => handleNameChange(e.target.value)}
                            placeholder="e.g. Kofi's Data Shop"
                            className="mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">This will be the browser title on your shop page.</p>
                    </div>

                    <div>
                        <Label htmlFor="shop_slug">Shop URL Slug *</Label>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-muted-foreground whitespace-nowrap">/shop/</span>
                            <Input
                                id="shop_slug"
                                value={form.shop_slug}
                                onChange={(e) => {
                                    const slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                                    setForm(prev => ({ ...prev, shop_slug: slug }))
                                    checkSlug(slug)
                                }}
                                placeholder="kofi-data-shop"
                                className={cn(slugTaken && 'border-red-500 focus-visible:ring-red-500')}
                            />
                            {slugChecking && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                        </div>
                        {slugTaken && <p className="text-xs text-red-500 mt-1">This slug is already taken. Choose another.</p>}
                        {form.shop_slug && !slugTaken && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                Preview: <span className="font-mono">{shopUrl}</span>
                                <a href={shopUrl} target="_blank" rel="noopener noreferrer" className="ml-1">
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </p>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={form.description}
                            onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Describe your shop (shown as subtitle and meta description)"
                            rows={3}
                            className="mt-1"
                        />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                            <p className="text-sm font-medium">Shop Active</p>
                            <p className="text-xs text-muted-foreground">Toggle to temporarily hide your shop</p>
                        </div>
                        <Switch
                            checked={form.is_active}
                            onCheckedChange={(v) => setForm(prev => ({ ...prev, is_active: v }))}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Contact Info */}
            <Card>
                <CardHeader><CardTitle className="text-base">Contact Information</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="owner_phone" className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5" /> Owner Phone *
                        </Label>
                        <Input
                            id="owner_phone"
                            value={form.owner_phone}
                            onChange={(e) => setForm(prev => ({ ...prev, owner_phone: e.target.value }))}
                            placeholder="0244123456"
                            className="mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Displayed as contact on your shop page.</p>
                    </div>

                    <div>
                        <Label htmlFor="owner_email" className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5" /> Email (Optional)
                        </Label>
                        <Input
                            id="owner_email"
                            type="email"
                            value={form.owner_email}
                            onChange={(e) => setForm(prev => ({ ...prev, owner_email: e.target.value }))}
                            placeholder="yourname@email.com"
                            className="mt-1"
                        />
                    </div>

                    <div>
                        <Label htmlFor="whatsapp_number" className="flex items-center gap-1.5">
                            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp Number (Optional)
                        </Label>
                        <Input
                            id="whatsapp_number"
                            value={form.whatsapp_number}
                            onChange={(e) => setForm(prev => ({ ...prev, whatsapp_number: e.target.value.replace(/\D/g, '') }))}
                            placeholder="233244123456"
                            className="mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Format: <span className="font-mono">233XXXXXXXXX</span> → becomes a floating WhatsApp button on your shop.
                            {form.whatsapp_number && (
                                <> Link: <a href={`https://wa.me/${form.whatsapp_number}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline">wa.me/{form.whatsapp_number}</a></>
                            )}
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Branding */}
            <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Palette className="w-4 h-4" /> Branding</CardTitle></CardHeader>
                <CardContent className="space-y-5">
                    {/* Logo Upload */}
                    <div>
                        <Label>Shop Logo (Max 5MB — JPG, PNG, WEBP)</Label>
                        <div
                            className="mt-2 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {logoPreview ? (
                                <div className="flex flex-col items-center gap-3">
                                    <div className="relative w-20 h-20 rounded-xl overflow-hidden border">
                                        <Image src={logoPreview} alt="Logo preview" fill className="object-contain" />
                                    </div>
                                    <p className="text-xs text-muted-foreground">Click to change logo</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                    {uploading ? (
                                        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                                    ) : (
                                        <Upload className="w-8 h-8" />
                                    )}
                                    <p className="text-sm font-medium">{uploading ? 'Uploading...' : 'Click to upload logo'}</p>
                                    <p className="text-xs">JPG, PNG, WEBP up to 5MB</p>
                                </div>
                            )}
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={handleLogoUpload}
                        />
                    </div>

                    {/* Color Presets */}
                    <div>
                        <Label>Brand Color</Label>
                        <div className="grid grid-cols-4 gap-2 mt-2">
                            {BRAND_PRESETS.map((preset) => (
                                <button
                                    key={preset.name}
                                    type="button"
                                    onClick={() => setForm(prev => ({ ...prev, brand_color: preset.color, brand_accent: preset.accent }))}
                                    className={cn(
                                        'flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all',
                                        form.brand_color.toLowerCase() === preset.color.toLowerCase()
                                            ? 'border-gray-900 dark:border-white scale-105 shadow-md'
                                            : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                                    )}
                                >
                                    <div className="w-8 h-8 rounded-full shadow-sm" style={{ backgroundColor: preset.color }} />
                                    <span className="text-[10px] font-medium text-center leading-tight">{preset.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Live Preview */}
                    <div>
                        <Label className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> Preview</Label>
                        <div className="mt-2 rounded-xl border overflow-hidden shadow-sm">
                            <div className="p-6 text-center" style={{ backgroundColor: form.brand_color }}>
                                <div className="flex flex-col items-center gap-3">
                                    {logoPreview ? (
                                        <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-white shadow-lg flex-shrink-0">
                                            <Image src={logoPreview} alt="Logo" fill className="object-contain" />
                                        </div>
                                    ) : (
                                        <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 shadow-lg">
                                            <Store className="w-8 h-8 text-white" />
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <p className="text-white font-black text-lg truncate leading-tight">{form.shop_name || 'Your Shop Name'}</p>
                                        <p className="text-white/80 text-xs mt-1 line-clamp-2 max-w-[200px] mx-auto">{form.description || 'Your shop description appears here.'}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-3 bg-white dark:bg-gray-900 flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Buy Now button preview:</span>
                                <button
                                    className="text-xs text-white font-bold px-3 py-1.5 rounded-lg"
                                    style={{ backgroundColor: form.brand_color }}
                                >
                                    Buy Now
                                </button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Save */}
            <Button
                onClick={handleSave}
                disabled={saving || uploading || slugTaken}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-base font-semibold gap-2"
            >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {saving ? 'Saving...' : existingShopId ? 'Save Changes' : 'Create Shop'}
            </Button>
            {/* Danger Zone */}
            {existingShopId && (
                <div className="pt-8 border-t">
                    <h3 className="text-sm font-medium text-red-600 mb-2">Danger Zone</h3>
                    <div className="flex items-center justify-between p-4 border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900 rounded-lg">
                        <div>
                            <p className="font-medium text-red-900 dark:text-red-200">Delete Shop</p>
                            <p className="text-xs text-red-700/80 dark:text-red-300/80">
                                Permanently delete your shop, orders, and wallet. This action cannot be undone.
                            </p>
                        </div>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={async () => {
                                if (window.confirm('Are you absolutely sure?\n\nThis will permanently delete your shop, all orders, and your profit wallet.\nThis action cannot be undone.')) {
                                    setSaving(true)
                                    try {
                                        const { error } = await supabase.rpc('delete_shop_data')
                                        if (error) throw error
                                        toast.success('Shop deleted successfully')
                                        router.replace('/dashboard/shop')
                                    } catch (err: any) {
                                        toast.error(err.message || 'Failed to delete shop')
                                        setSaving(false)
                                    }
                                }
                            }}
                            disabled={saving}
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete Shop'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
