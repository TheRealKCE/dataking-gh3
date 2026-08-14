'use client'

import { useState } from 'react'
import { Gift, Copy, Check, ExternalLink } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ReferralShareCardProps {
    code: string
    shareUrl: string
    /** Advertised rate. Rendered as "up to X%" — see the note below. */
    percentOfSale: number
    /** False when an admin has paused the programme. */
    enabled: boolean
}

export function ReferralShareCard({ code, shareUrl, percentOfSale, enabled }: ReferralShareCardProps) {
    const [copiedCode, setCopiedCode] = useState(false)
    const [copiedLink, setCopiedLink] = useState(false)

    const copy = async (value: string, setFlag: (v: boolean) => void, label: string) => {
        try {
            await navigator.clipboard.writeText(value)
            setFlag(true)
            toast.success(`${label} copied!`)
            setTimeout(() => setFlag(false), 2000)
        } catch {
            toast.error(`Failed to copy ${label.toLowerCase()}`)
        }
    }

    const shareToWhatsApp = () => {
        const text = encodeURIComponent(
            `Buy cheap data on ARHMS! Sign up with my link and we both win: ${shareUrl}`
        )
        window.open(`https://wa.me/?text=${text}`, '_blank')
    }

    return (
        <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border-indigo-500/20">
            <CardContent className="p-4 sm:p-6 space-y-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                        <Gift className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 dark:text-gray-100">Refer &amp; Earn</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {enabled
                                ? /* "up to" is required, not marketing hedging: a margin cap can
                                     reduce the payout on thin-margin orders, so promising a flat
                                     rate would be a promise the system knowingly breaks. */
                                  `Earn up to ${percentOfSale}% every time someone you invited buys data`
                                : 'Referral bonuses are paused right now'}
                        </p>
                    </div>
                </div>

                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                        Your Code
                    </p>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 font-mono text-lg font-bold tracking-[0.2em] text-indigo-600 dark:text-indigo-400 text-center">
                            {code}
                        </div>
                        <Button
                            onClick={() => copy(code, setCopiedCode, 'Code')}
                            variant="outline"
                            className={cn(
                                'h-12 px-3 gap-2 transition-all',
                                copiedCode
                                    ? 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800'
                                    : ''
                            )}
                        >
                            {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-gray-500" />}
                        </Button>
                    </div>
                </div>

                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                        Your Link
                    </p>
                    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-indigo-600 dark:text-indigo-400 truncate mb-2">
                        {shareUrl}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={() => copy(shareUrl, setCopiedLink, 'Link')}
                            variant="outline"
                            className={cn(
                                'flex-1 h-10 gap-2 transition-all',
                                copiedLink
                                    ? 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800'
                                    : ''
                            )}
                        >
                            {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-gray-500" />}
                            {copiedLink ? 'Copied!' : 'Copy Link'}
                        </Button>
                        <Button
                            onClick={shareToWhatsApp}
                            className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                        >
                            <ExternalLink className="w-4 h-4" />
                            WhatsApp
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
