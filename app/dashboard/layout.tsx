'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AgentExpiryModal } from '@/components/agent-expiry-modal'
import { useAuth } from '@/contexts/auth-context'
import { UIProvider } from '@/contexts/ui-context'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { DashboardHeader } from '@/components/dashboard/header'
import { MobileBottomNav } from '@/components/dashboard/mobile-bottom-nav'
import { PageAccessGuard } from '@/components/dashboard/page-access-guard'
import { Skeleton } from '@/components/ui/skeleton'
import { FloatingWhatsApp } from '@/components/floating-whatsapp'
import { PushNotificationManager } from '@/components/PushNotificationManager'
import { cn } from '@/lib/utils'
import { useUI } from '@/contexts/ui-context'
// import { SupportChatWidget } from '@/components/dashboard/support-chat-widget'
import { SuspendedAccount } from '@/components/dashboard/SuspendedAccount'
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
        // Show a spinner instead of a blank screen while the redirect to /auth/login fires.
        // Returning null causes a visible white flash during the session hydration race condition.
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-medium text-muted-foreground">Redirecting...</p>
                </div>
            </div>
        )
    }

    const isSuspended = dbUser?.status === 'suspended' && (dbUser?.role === 'agent' || dbUser?.role === 'customer')

    if (isSuspended) {
        return (
            <div className="min-h-screen bg-background relative">
                <DashboardSidebar />
                <div className={cn(
                    "relative transition-all duration-300 ease-in-out min-h-screen flex flex-col w-full max-w-[100vw] overflow-x-hidden",
                    isCollapsed ? "lg:pl-20" : "lg:pl-80"
                )}>
                    <DashboardHeader />
                    <div className="h-16 flex-shrink-0" />
                    <main className="p-4 lg:p-6 flex-1">
                        <SuspendedAccount />
                    </main>
                    <CopyrightFooter className="bg-background/60" />
                </div>
                <FloatingWhatsApp variant="auth" />
                {/* <SupportChatWidget /> */}
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background relative">
            <PushNotificationManager />
            <AgentExpiryModal />
            <DashboardSidebar />
            <div className={cn(
                "relative transition-all duration-300 ease-in-out min-h-screen flex flex-col w-full max-w-[100vw] overflow-x-hidden",
                isCollapsed ? "lg:pl-20" : "lg:pl-80"
            )}>
                <DashboardHeader />
                <div className="h-16 flex-shrink-0" />
                <main className="p-4 pb-24 md:pb-4 lg:p-6 flex-1">
                    <PageAccessGuard>
                        {children}
                    </PageAccessGuard>
                </main>
                <CopyrightFooter className="bg-background/60" />
            </div>
            <FloatingWhatsApp variant="auth" />
            <MobileBottomNav />
            {/* <SupportChatWidget /> */}
        </div>
    )
}
