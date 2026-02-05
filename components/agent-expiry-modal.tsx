'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
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
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Sparkles, ArrowRight, UserCheck } from 'lucide-react'
import { toast } from 'sonner'

export function AgentExpiryModal() {
    const { dbUser, refreshUser } = useAuth()
    const router = useRouter()
    const [isOpen, setIsOpen] = useState(false)
    const [isDowngrading, setIsDowngrading] = useState(false)
    const [pricing, setPricing] = useState({
        '3d': '9.99',
        '14d': '49.99',
        '30d': '99.99'
    })

    // Check if agent is expired
    const isExpired = dbUser?.role === 'agent' &&
        dbUser?.agent_expires_at &&
        new Date(dbUser.agent_expires_at) < new Date()

    // Fetch current pricing
    useEffect(() => {
        const fetchPricing = async () => {
            try {
                const { data } = await supabase
                    .from('admin_settings')
                    .select('key, value')
                    .in('key', ['agent_upgrade_price_3d', 'agent_upgrade_price_14d', 'agent_upgrade_price_30d'])

                if (data) {
                    const p3 = (data as any).find((s: any) => s.key === 'agent_upgrade_price_3d')?.value || '9.99'
                    const p14 = (data as any).find((s: any) => s.key === 'agent_upgrade_price_14d')?.value || '49.99'
                    const p30 = (data as any).find((s: any) => s.key === 'agent_upgrade_price_30d')?.value || '99.99'
                    setPricing({
                        '3d': String(p3),
                        '14d': String(p14),
                        '30d': String(p30)
                    })
                }
            } catch (error) {
                console.error('Error fetching pricing:', error)
            }
        }

        if (isExpired) {
            fetchPricing()
        }
    }, [isExpired])

    // Show modal when expired
    useEffect(() => {
        if (isExpired) {
            setIsOpen(true)
        } else {
            setIsOpen(false)
        }
    }, [isExpired])

    const handleExtendAccess = () => {
        // Temporarily close modal and redirect to upgrade page
        setIsOpen(false)
        router.push('/dashboard/upgrade')
    }

    const handleDowngrade = async () => {
        setIsDowngrading(true)
        try {
            const response = await fetch('/api/agent/downgrade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })

            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Failed to downgrade')

            toast.success('You have been returned to customer role')
            await refreshUser()
            setIsOpen(false)
        } catch (error: any) {
            console.error('Downgrade error:', error)
            toast.error(error.message || 'Failed to downgrade')
        } finally {
            setIsDowngrading(false)
        }
    }

    if (!isExpired) return null

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            // Prevent closing the modal by clicking outside or ESC
            // Only allow closing through the action buttons
            if (!open) return
        }}>
            <DialogContent className="sm:max-w-[500px]" onInteractOutside={(e) => e.preventDefault()}>
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-6 h-6 text-amber-500" />
                        <DialogTitle className="text-2xl font-black">Agent Access Expired</DialogTitle>
                    </div>
                    <DialogDescription className="text-base">
                        Your agent membership has expired. Choose an option below to continue.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Pricing Highlight */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 p-6 rounded-xl border-2 border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="w-5 h-5 text-blue-600" />
                            <h3 className="font-black text-lg text-blue-900 dark:text-blue-100">Renew Your Access</h3>
                        </div>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
                            Continue enjoying agent benefits at affordable prices:
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="bg-white dark:bg-slate-900 border-blue-300 text-blue-700 dark:text-blue-300 px-3 py-1">
                                <span className="font-black text-lg">GHS {pricing['3d']}</span>
                                <span className="text-xs ml-1">/ 3 days</span>
                            </Badge>
                            <Badge variant="outline" className="bg-white dark:bg-slate-900 border-blue-300 text-blue-700 dark:text-blue-300 px-3 py-1">
                                <span className="font-black text-lg">GHS {pricing['14d']}</span>
                                <span className="text-xs ml-1">/ 14 days</span>
                            </Badge>
                            <Badge variant="outline" className="bg-white dark:bg-slate-900 border-blue-300 text-blue-700 dark:text-blue-300 px-3 py-1">
                                <span className="font-black text-lg">GHS {pricing['30d']}</span>
                                <span className="text-xs ml-1">/ 30 days</span>
                            </Badge>
                        </div>
                    </div>

                    {/* Options */}
                    <div className="space-y-3">
                        <Button
                            onClick={handleExtendAccess}
                            className="w-full h-14 text-base font-black bg-blue-600 hover:bg-blue-700"
                            size="lg"
                        >
                            <Sparkles className="w-5 h-5 mr-2" />
                            Extend Agent Access
                            <ArrowRight className="w-5 h-5 ml-2" />
                        </Button>

                        <Button
                            onClick={handleDowngrade}
                            disabled={isDowngrading}
                            variant="outline"
                            className="w-full h-14 text-base font-bold border-2"
                            size="lg"
                        >
                            <UserCheck className="w-5 h-5 mr-2" />
                            {isDowngrading ? 'Processing...' : 'Return to Customer Role (Free)'}
                        </Button>
                    </div>

                    <p className="text-xs text-center text-muted-foreground">
                        You can always upgrade back to agent later
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    )
}
