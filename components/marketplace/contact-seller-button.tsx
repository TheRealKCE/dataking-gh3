'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { MessageCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createBrowserClient } from '@/lib/supabase'

interface ContactSellerButtonProps {
    listingId: string
    sellerId: string
}

export function ContactSellerButton({ listingId, sellerId }: ContactSellerButtonProps) {
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleContact = async () => {
        setLoading(true)
        try {
            const supabase = createBrowserClient()
            const {
                data: { user },
            } = await supabase.auth.getUser()

            if (!user) {
                router.push('/auth/login?redirect=/marketplace-domain/browse')
                return
            }

            // Create or get conversation
            const response = await fetch('/api/marketplace/conversations/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    listing_id: listingId,
                    other_user_id: sellerId,
                }),
            })

            if (!response.ok) throw new Error('Failed to create conversation')

            const data = await response.json()
            router.push(`/marketplace-domain/messages/${data.conversation_id}`)
        } catch (error) {
            console.error('[Contact Seller] Error:', error)
            toast.error('Failed to contact seller')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Button
            onClick={handleContact}
            disabled={loading}
            className="w-full"
            size="lg"
        >
            {loading ? (
                <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting conversation...
                </>
            ) : (
                <>
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Contact Seller
                </>
            )}
        </Button>
    )
}
