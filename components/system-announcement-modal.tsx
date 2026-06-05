'use client'

import { useEffect, useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Megaphone } from 'lucide-react'
import { SystemAnnouncement } from '@/types/supabase'

const ALLOWED_ROLES = ['customer', 'agent', 'dealer']

export function SystemAnnouncementModal({
    initialAnnouncement = null,
    userRole,
}: {
    initialAnnouncement?: Partial<SystemAnnouncement> | null
    userRole?: string
}) {
    const [announcement, setAnnouncement] = useState<Partial<SystemAnnouncement> | null>(initialAnnouncement)
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        if (userRole && !ALLOWED_ROLES.includes(userRole)) return
        checkAnnouncements()
    }, [userRole, initialAnnouncement?.id])

    const checkAnnouncements = async () => {
        try {
            let announcementData = initialAnnouncement as any
            if (!announcementData) {
                const response = await fetch('/api/public/config')
                if (!response.ok) return
                const config = await response.json()
                announcementData = config.activeSystemAnnouncements?.find((item: any) => item.visible_on === 'main_site' || item.visible_on === 'both')
            }

            if (announcementData) {
                // Check if this specific announcement has been seen in this session
                const seenKey = `announcement_seen_${announcementData.id}`
                // Use sessionStorage so it survives refresh but clears on tab close (or manual clear)
                const hasSeen = sessionStorage.getItem(seenKey)

                if (!hasSeen) {
                    setAnnouncement(announcementData)
                    setIsOpen(true)
                }
            }
        } catch (error) {
            console.error('Failed to check announcements', error)
        }
    }

    const handleDismiss = () => {
        if (announcement) {
            // Mark as seen for this session
            sessionStorage.setItem(`announcement_seen_${announcement.id}`, 'true')
            setIsOpen(false)
        }
    }

    if (!announcement) return null

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-md w-[95vw] rounded-3xl overflow-hidden p-0 gap-0 border-0 bg-white dark:bg-gray-950 shadow-2xl">
                {/* --- Fancy Storefront-like Banner Background --- */}
                <div className="relative pt-8 pb-4 bg-amber-50 dark:bg-amber-950/20 px-4 sm:px-6">
                    <div className="absolute -right-4 -top-4 w-28 h-28 opacity-[0.05] dark:opacity-[0.02] rounded-full bg-amber-600 pointer-events-none" />
                    
                    <DialogHeader className="relative z-10 flex flex-col items-center gap-3">
                        <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shadow-inner">
                            <Megaphone className="w-7 h-7 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-500 text-white mb-2 shadow-sm">
                                Official Notice
                            </span>
                            <DialogTitle className="text-center text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                                {announcement.title}
                            </DialogTitle>
                        </div>
                    </DialogHeader>
                </div>

                {/* --- Scrollable Content --- */}
                <div className="relative bg-white dark:bg-gray-950">
                    <div className="max-h-[50vh] sm:max-h-[60vh] overflow-y-auto overflow-x-hidden custom-scrollbar px-5 sm:px-8 py-6">
                        <p className="text-sm sm:text-[15px] font-medium leading-relaxed whitespace-pre-wrap text-gray-600 dark:text-gray-300 break-words">
                            {announcement.message}
                        </p>
                    </div>

                    {/* Subtle scroll fade gradient at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white dark:from-gray-950 to-transparent pointer-events-none" />
                </div>

                <DialogFooter className="bg-gray-50/80 dark:bg-gray-900/40 p-4 sm:p-5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-center">
                    <Button
                        type="button"
                        className="w-full max-w-xs font-bold shadow-md rounded-xl transition-transform active:scale-95"
                        onClick={handleDismiss}
                    >
                        Got it, thanks!
                    </Button>
                </DialogFooter>

                <style jsx global>{`
                    .custom-scrollbar::-webkit-scrollbar {
                        width: 5px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-track {
                        background: transparent;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                        background: rgba(156, 163, 175, 0.3);
                        border-radius: 10px;
                    }
                `}</style>
            </DialogContent>
        </Dialog>
    )
}
