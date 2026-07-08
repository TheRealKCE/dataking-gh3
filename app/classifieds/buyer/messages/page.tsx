'use client'

import { MessageSquare } from 'lucide-react'
import { ConversationList } from '@/components/marketplace/conversation-list'

/**
 * Messages tab (bottom-nav "Messages").
 *
 * Renders the shared ConversationList, which fetches the signed-in user's
 * marketplace conversations and polls for new messages on its own. Mobile-first
 * standalone page so the marketplace bottom nav stays in charge of navigation.
 */
export default function MessagesPage() {
    return (
        <div className="mx-auto min-h-screen max-w-3xl px-4 py-6">
            <div className="mb-6 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/20">
                    <MessageSquare className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </span>
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Messages</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Your conversations with buyers and sellers
                    </p>
                </div>
            </div>

            <ConversationList />
        </div>
    )
}
