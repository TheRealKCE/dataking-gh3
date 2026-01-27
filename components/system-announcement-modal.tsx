'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Megaphone } from 'lucide-react'
import { SystemAnnouncement } from '@/types/supabase'

export function SystemAnnouncementModal() {
    const [announcement, setAnnouncement] = useState<SystemAnnouncement | null>(null)
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        checkAnnouncements()
    }, [])

    const checkAnnouncements = async () => {
        try {
            // Fetch the most recent ACTIVE announcement
            const { data, error } = await supabase
                .from('system_announcements')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            if (error && error.code !== 'PGRST116') { // Ignore 'no rows found' error
                console.error('Error fetching announcement:', error)
                return
            }

            const announcementData = data as any

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
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                        <Megaphone className="w-6 h-6 text-primary" />
                    </div>
                    <DialogTitle className="text-center text-xl">{announcement.title}</DialogTitle>
                </DialogHeader>

                <div className="py-2">
                    <p className="text-center text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {announcement.message}
                    </p>
                </div>

                <DialogFooter className="sm:justify-center">
                    <Button
                        type="button"
                        className="w-full sm:w-auto min-w-[120px]"
                        onClick={handleDismiss}
                    >
                        Got it
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
