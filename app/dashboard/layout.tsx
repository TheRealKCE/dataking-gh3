'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SystemAnnouncementModal } from '@/components/system-announcement-modal'
import { AgentExpiryModal } from '@/components/agent-expiry-modal'
import { useAuth } from '@/contexts/auth-context'
import { UIProvider } from '@/contexts/ui-context'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { DashboardHeader } from '@/components/dashboard/header'
import { PageAccessGuard } from '@/components/dashboard/page-access-guard'
import { Skeleton } from '@/components/ui/skeleton'
import { FloatingWhatsApp } from '@/components/floating-whatsapp'
import { cn } from '@/lib/utils'
import { useUI } from '@/contexts/ui-context'
// import { SupportChatWidget } from '@/components/dashboard/support-chat-widget'
import { SuspendedAccount } from '@/components/dashboard/SuspendedAccount'
import { AnnouncementBell } from '@/components/dashboard/AnnouncementBell'
import { CopyrightFooter } from '@/components/CopyrightFooter'


export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { user, dbUser, isLoading } = useAuth()
    const { isCollapsed } = useUI()
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

    const isSuspended = dbUser?.status === 'suspended' && (dbUser?.role === 'agent' || dbUser?.role === 'customer')

    if (isSuspended) {
        return (
            <div className="min-h-screen bg-[#E5E7EB] dark:bg-[#000000] relative">
                <DashboardSidebar />
                <div className={cn(
                    "relative transition-all duration-300 ease-in-out min-h-screen flex flex-col w-full max-w-[100vw] overflow-x-hidden",
                    isCollapsed ? "lg:pl-20" : "lg:pl-80"
                )}>
                    <AnnouncementBell />
                    <DashboardHeader />
                    <div className="h-16 flex-shrink-0" />
                    <main className="p-4 lg:p-6 flex-1">
                        <SuspendedAccount />
                    </main>
                    <CopyrightFooter className="bg-[#E5E7EB]/50 dark:bg-[#000000]/50" />
                </div>
                <FloatingWhatsApp variant="auth" />
                {/* <SupportChatWidget /> */}
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#E5E7EB] dark:bg-[#000000] relative">
            <SystemAnnouncementModal />
            <AgentExpiryModal />
            <DashboardSidebar />
            <div className={cn(
                "relative transition-all duration-300 ease-in-out min-h-screen flex flex-col w-full max-w-[100vw] overflow-x-hidden",
                isCollapsed ? "lg:pl-20" : "lg:pl-80"
            )}>
                <AnnouncementBell />
                <DashboardHeader />
                <div className="h-16 flex-shrink-0" />
                <main className="p-4 lg:p-6 flex-1">
                    <PageAccessGuard>
                        {children}
                    </PageAccessGuard>
                </main>
                <CopyrightFooter className="bg-[#E5E7EB]/50 dark:bg-[#000000]/50" />
            </div>
            <FloatingWhatsApp variant="auth" />
            {/* <SupportChatWidget /> */}
        </div>
    )
}
