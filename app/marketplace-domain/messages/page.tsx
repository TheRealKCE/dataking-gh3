import { createRouteHandlerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { ConversationList } from '@/components/marketplace/conversation-list'

export const metadata = {
    title: 'Messages | Arhms Marketplace',
    description: 'Your marketplace conversations',
}

export default async function MessagesPage() {
    const supabase = await createRouteHandlerClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login?redirect=/marketplace-domain/messages')
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="container py-8 max-w-4xl">
                <h1 className="text-3xl font-bold mb-2">Messages</h1>
                <p className="text-muted-foreground mb-8">
                    Your conversations with buyers and sellers
                </p>

                <ConversationList />
            </div>
        </div>
    )
}
