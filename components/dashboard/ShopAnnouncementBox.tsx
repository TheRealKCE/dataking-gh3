'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Megaphone, Loader2, CheckCircle2, Sparkles, Store, Eye } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getTone, type AnnouncementTone } from '@/lib/announcement-tones'
import { AnnouncementModal } from '@/components/announcements/announcement-modal'

interface ShopAnnouncementBoxProps {
    shopId: string
    currentAnnouncement: string | null
    currentTitle?: string | null
    currentTone?: AnnouncementTone | null
}

/**
 * Tones a shop owner may pick. `official` is deliberately excluded — the amber
 * "Official Platform Notice" badge is the platform's own voice, and letting a
 * shop wear it would let any owner pass their notice off as ours.
 */
const OWNER_TONES: { value: AnnouncementTone; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { value: 'shop', label: 'Update', Icon: Store },
    { value: 'success', label: 'Good news', Icon: Sparkles },
    { value: 'alert', label: 'Service alert', Icon: AlertTriangle },
]

export function ShopAnnouncementBox({
    shopId,
    currentAnnouncement,
    currentTitle = null,
    currentTone = null,
}: ShopAnnouncementBoxProps) {
    const [title, setTitle] = useState(currentTitle || '')
    const [announcement, setAnnouncement] = useState(currentAnnouncement || '')
    const [tone, setTone] = useState<AnnouncementTone>(currentTone || 'shop')
    const [isSaving, setIsSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [previewOpen, setPreviewOpen] = useState(false)
    // What is currently live, so "Post" can stay disabled until something changes.
    const [savedState, setSavedState] = useState({
        title: currentTitle || '',
        message: currentAnnouncement || '',
        tone: (currentTone || 'shop') as AnnouncementTone,
    })
    const MAX_CHARS = 280
    const MAX_TITLE = 80

    // The parent renders this box before it knows the announcement, so the box
    // loads its own. Without this the owner always saw an empty form and could
    // not tell whether anything was live on their storefront.
    useEffect(() => {
        let cancelled = false
        fetch('/api/shop/announcements')
            .then(r => r.json())
            .then(data => {
                if (cancelled || !data?.announcement) return
                const a = data.announcement
                const next = {
                    title: a.title || '',
                    message: a.message || '',
                    tone: (a.tone || 'shop') as AnnouncementTone,
                }
                setTitle(next.title)
                setAnnouncement(next.message)
                setTone(next.tone)
                setSavedState(next)
            })
            .catch(() => {})
        return () => { cancelled = true }
    }, [])

    const handleSave = async () => {
        if (isSaving) return
        setIsSaving(true)
        setSaved(false)
        try {
            if (!announcement.trim()) {
                // Clear announcement
                const res = await fetch('/api/shop/announcements', { method: 'DELETE' })
                if (!res.ok) throw new Error('Failed to remove announcement')
            } else {
                // Set announcement
                const res = await fetch('/api/shop/announcements', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: announcement.trim(),
                        title: title.trim() || undefined,
                        tone,
                    })
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data.message || data.error || 'Failed to save announcement')
            }

            setSavedState({ title: title.trim(), message: announcement.trim(), tone })
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
    const isUnchanged =
        announcement === savedState.message &&
        title === savedState.title &&
        tone === savedState.tone

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
                            {announcement
                                ? "Shown to customers visiting your storefront"
                                : "No current announcement—share an update with your customers"}
                        </p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">Headline (optional)</Label>
                    <Input
                        value={title}
                        onChange={e => {
                            if (e.target.value.length <= MAX_TITLE) setTitle(e.target.value)
                        }}
                        placeholder="e.g. Delivery delays today"
                        className="text-sm"
                    />
                </div>

                <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">Message</Label>
                    <Textarea
                        value={announcement}
                        onChange={e => {
                            if (e.target.value.length <= MAX_CHARS) setAnnouncement(e.target.value)
                        }}
                        rows={3}
                        className="resize-none text-sm"
                    />
                    <span className={`text-xs ${remaining < 20 ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {remaining} characters left
                    </span>
                </div>

                <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">Style</Label>
                    <div className="grid grid-cols-3 gap-2">
                        {OWNER_TONES.map(({ value, label, Icon }) => {
                            const ot = getTone(value)
                            const active = tone === value
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setTone(value)}
                                    className={cn(
                                        'flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-xl border-2 transition-all active:scale-95',
                                        active
                                            ? 'border-transparent ring-2 ring-offset-1 dark:ring-offset-gray-950 ' + ot.panel
                                            : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                                    )}
                                >
                                    <span className={cn(
                                        'w-7 h-7 rounded-lg flex items-center justify-center',
                                        active ? ot.tile : 'bg-gray-100 dark:bg-gray-800'
                                    )}>
                                        <Icon className={cn('w-3.5 h-3.5', active ? 'text-white' : 'text-gray-400')} />
                                    </span>
                                    <span className={cn(
                                        'text-[10px] font-bold uppercase tracking-wide',
                                        active ? ot.ink : 'text-muted-foreground'
                                    )}>
                                        {label}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPreviewOpen(true)}
                        disabled={!announcement.trim()}
                        className="gap-1.5"
                    >
                        <Eye className="w-3.5 h-3.5" />
                        Preview
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={isSaving || isUnchanged}
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

            {/* Renders the exact component customers see, so what the owner
                approves here is what actually ships to the storefront. */}
            <AnnouncementModal
                open={previewOpen}
                onOpenChange={setPreviewOpen}
                tone={tone}
                title={title.trim() || undefined}
                message={announcement}
                dismissLabel="Close preview"
            />
        </Card>
    )
}
