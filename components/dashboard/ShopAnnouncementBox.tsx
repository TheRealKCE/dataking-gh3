'use client'

import { useState } from 'react'
import { Megaphone, Loader2, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface ShopAnnouncementBoxProps {
    shopId: string
    currentAnnouncement: string | null
}

export function ShopAnnouncementBox({ shopId, currentAnnouncement }: ShopAnnouncementBoxProps) {
    const [announcement, setAnnouncement] = useState(currentAnnouncement || '')
    const [isSaving, setIsSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const MAX_CHARS = 280

    const handleSave = async () => {
        if (isSaving) return
        setIsSaving(true)
        setSaved(false)
        try {
            const { error } = await (supabase as any)
                .from('shop_profiles')
                .update({ announcement: announcement.trim() || null, updated_at: new Date().toISOString() })
                .eq('id', shopId)

            if (error) throw error

            setSaved(true)
            toast.success('Announcement updated!')
            setTimeout(() => setSaved(false), 3000)
        } catch (err: any) {
            toast.error(err.message || 'Failed to save announcement')
        } finally {
            setIsSaving(false)
        }
    }

    const remaining = MAX_CHARS - announcement.length

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-md">
                        <Megaphone className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                        <CardTitle className="text-base font-bold">Shop Announcement</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Shown to customers visiting your storefront
                        </p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                <Textarea
                    placeholder="e.g. 🎉 Flash sale today! MTN 5GB for just GHS 12. Order now!"
                    value={announcement}
                    onChange={e => {
                        if (e.target.value.length <= MAX_CHARS) setAnnouncement(e.target.value)
                    }}
                    rows={3}
                    className="resize-none text-sm"
                />
                <div className="flex items-center justify-between">
                    <span className={`text-xs ${remaining < 20 ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {remaining} characters left
                    </span>
                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={isSaving || announcement === (currentAnnouncement || '')}
                        className="gap-1.5"
                    >
                        {isSaving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : saved ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                            <Megaphone className="w-3.5 h-3.5" />
                        )}
                        {isSaving ? 'Saving...' : saved ? 'Saved!' : 'Post Announcement'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
