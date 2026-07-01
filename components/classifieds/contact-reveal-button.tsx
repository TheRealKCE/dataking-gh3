'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, Mail, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SafetyTipsModal } from './safety-tips-modal'
import { toast } from 'sonner'
import type { ClassifiedListing } from '@/types/supabase'

interface ContactRevealButtonProps {
    listing: ClassifiedListing
    userId?: string
}

export function ContactRevealButton({ listing, userId }: ContactRevealButtonProps) {
    const router = useRouter()
    const [showSafetyModal, setShowSafetyModal] = useState(false)
    const [contactInfo, setContactInfo] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [revealed, setRevealed] = useState(false)

    const handleClick = () => {
        if (!userId) {
            router.push(`/auth/login?redirect=/classifieds/${listing.id}`)
            return
        }

        if (revealed) {
            return
        }

        setShowSafetyModal(true)
    }

    const handleAcknowledgeSafety = async () => {
        setIsLoading(true)
        try {
            const response = await fetch('/api/classifieds/contact-reveal', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('sb-token')}`,
                },
                body: JSON.stringify({
                    listing_id: listing.id,
                    acknowledged_safety_tips: true,
                }),
            })

            if (!response.ok) {
                throw new Error('Failed to reveal contact info')
            }

            const data = await response.json()
            setContactInfo(data)
            setRevealed(true)
            setShowSafetyModal(false)
            toast.success('Contact information revealed!')
        } catch (error: any) {
            toast.error(error.message || 'Failed to reveal contact info')
        } finally {
            setIsLoading(false)
        }
    }

    if (revealed && contactInfo) {
        return (
            <div className="space-y-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
                <p className="text-sm font-bold text-emerald-900 dark:text-emerald-300">
                    Contact Details for {contactInfo.seller_name || 'Seller'}
                </p>

                <div className="space-y-2">
                    {contactInfo.phone && (
                        <a
                            href={`tel:${contactInfo.phone}`}
                            className="flex items-center gap-2 p-3 bg-white dark:bg-[#151c2c] rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                            <Phone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            <div>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">PHONE</p>
                                <p className="font-bold text-gray-900 dark:text-white">{contactInfo.phone}</p>
                            </div>
                        </a>
                    )}

                    {contactInfo.email && (
                        <a
                            href={`mailto:${contactInfo.email}`}
                            className="flex items-center gap-2 p-3 bg-white dark:bg-[#151c2c] rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                            <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            <div>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">EMAIL</p>
                                <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{contactInfo.email}</p>
                            </div>
                        </a>
                    )}

                    {contactInfo.location && (
                        <div className="flex items-center gap-2 p-3 bg-white dark:bg-[#151c2c] rounded-lg">
                            <MapPin className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                            <div>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">LOCATION</p>
                                <p className="font-bold text-gray-900 dark:text-white">{contactInfo.location}</p>
                            </div>
                        </div>
                    )}
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-400">
                    Remember to meet in person, inspect the item before paying, and always be cautious.
                </p>
            </div>
        )
    }

    return (
        <>
            <Button
                onClick={handleClick}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-6 text-base"
            >
                {userId ? 'Reveal Seller Contact' : 'Login to Contact Seller'}
            </Button>

            <SafetyTipsModal
                open={showSafetyModal}
                onOpenChange={setShowSafetyModal}
                onAcknowledge={handleAcknowledgeSafety}
                isLoading={isLoading}
            />
        </>
    )
}
