'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SystemAnnouncementModal } from '@/components/system-announcement-modal'
import { useAuth } from '@/contexts/auth-context'
import { UIProvider } from '@/contexts/ui-context'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { DashboardHeader } from '@/components/dashboard/header'
import { Skeleton } from '@/components/ui/skeleton'
import { WhatsAppButton } from '@/components/whatsapp-button'
import AgentChatFloat from '@/components/chat/AgentChatFloat'

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { user, isLoading } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/auth/login')
        }
    }, [user, isLoading, router])

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="space-y-4 w-full max-w-md p-8">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-8 w-1/2" />
                </div>
            </div>
        )
    }

    if (!user) {
        return null
    }

    return (
        <UIProvider>
            <div className="min-h-screen bg-[#E5E7EB] dark:bg-[#000000] relative">
                <SystemAnnouncementModal />
                <DashboardSidebar />
                <div className="lg:pl-80">
                    <DashboardHeader />
                    <main className="p-4 lg:p-6">
                        {children}
                    </main>
                </div>
                <WhatsAppButton />
                <AgentChatFloat />
            </div>
        </UIProvider>
    )
}
