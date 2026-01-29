'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { UIProvider } from '@/contexts/ui-context'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { DashboardHeader } from '@/components/dashboard/header'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ShieldAlert } from 'lucide-react'

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { user, dbUser, isLoading, isAdmin, isSubAdmin } = useAuth()
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        if (!isLoading) {
            if (!user) {
                router.push('/auth/login')
            } else if (!isAdmin && !isSubAdmin) {
                router.push('/dashboard')
            } else if (isSubAdmin && pathname && !pathname.startsWith('/admin/orders')) {
                // Redirect sub-admin to orders if they try to access other admin pages
                router.push('/admin/orders')
            }
        }
    }, [user, isAdmin, isSubAdmin, isLoading, router, pathname])

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

    if (!isAdmin && !isSubAdmin) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <Alert variant="destructive" className="max-w-md">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <AlertDescription>
                        You do not have permission to access the admin panel. Please contact an administrator if you believe this is an error.
                    </AlertDescription>
                </Alert>
            </div>
        )
    }

    return (
        <UIProvider>
            <div className="min-h-screen bg-[#E5E7EB] dark:bg-[#1A1A1A]">
                <DashboardSidebar />
                <div className="lg:pl-72">
                    <DashboardHeader />
                    <main className="p-4 lg:p-6">
                        {children}
                    </main>
                </div>
            </div>
        </UIProvider>
    )
}
