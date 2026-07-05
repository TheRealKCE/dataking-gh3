'use client'

import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Loader2, CheckCircle2 } from 'lucide-react'

interface GetVerifiedDialogProps {
    sellerName?: string
    sellerEmail?: string
}

const WhatsAppIcon = () => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="text-white">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.88 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
)

export function GetVerifiedDialog({ sellerName, sellerEmail }: GetVerifiedDialogProps) {
    const [open, setOpen] = useState(false)
    const [adminPhone, setAdminPhone] = useState<string>('')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!open) return

        const fetchConfig = async () => {
            try {
                const response = await fetch('/api/public/config')
                if (!response.ok) throw new Error('Failed to fetch config')
                const data = await response.json()
                setAdminPhone(data.whatsappAdminNumber || '')
            } catch (error) {
                console.error('[GetVerified] Failed to fetch admin phone:', error)
                setAdminPhone('')
            } finally {
                setLoading(false)
            }
        }

        fetchConfig()
    }, [open])

    const buildWhatsAppUrl = () => {
        if (!adminPhone) return ''
        const cleaned = adminPhone.replace(/\D/g, '')
        const message = encodeURIComponent(
            `Hi ARHMS Admin 👋\n\nI'd like to get my seller profile verified on Arhms Marketplace.\n\nName: ${sellerName || 'N/A'}\nEmail: ${sellerEmail || 'N/A'}`
        )
        return `https://wa.me/${cleaned}?text=${message}`
    }

    const waUrl = buildWhatsAppUrl()

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                    Get Verified
                </Button>
            </DialogTrigger>

            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Get Your Seller Profile Verified</DialogTitle>
                    <DialogDescription>
                        Contact our admin team to start the verification process
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-6">
                    {/* Info Card */}
                    <Card className="p-4 bg-blue-50 border-blue-200">
                        <div className="flex gap-3">
                            <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-blue-900 space-y-2">
                                <p className="font-medium">Manual Verification Required</p>
                                <p>
                                    To get your seller profile verified on Arhms Marketplace, please contact our admin team on WhatsApp. Our team will review your details and approve your verification.
                                </p>
                            </div>
                        </div>
                    </Card>

                    {/* WhatsApp Button */}
                    {loading ? (
                        <Button className="w-full" disabled>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Loading contact info...
                        </Button>
                    ) : adminPhone ? (
                        <a href={waUrl} target="_blank" rel="noopener noreferrer" className="block">
                            <Button className="w-full bg-gradient-to-r from-[#25D366] to-[#128C7E] hover:from-[#20ba58] hover:to-[#0fb885]">
                                <WhatsAppIcon />
                                <span className="ml-2">Contact Admin on WhatsApp</span>
                            </Button>
                        </a>
                    ) : (
                        <Button className="w-full" disabled>
                            Unable to load contact info
                        </Button>
                    )}

                    {!adminPhone && !loading && (
                        <p className="text-xs text-muted-foreground text-center">
                            Unable to load contact information. Please try again shortly.
                        </p>
                    )}

                    <p className="text-xs text-muted-foreground text-center">
                        You'll be taken to WhatsApp to start the conversation
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    )
}
