'use client'

import { usePathname } from 'next/navigation'
import { usePageAccess } from '@/hooks/use-page-access'
import { useAuth } from '@/contexts/auth-context'
import { AlertTriangle, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'

export function PageAccessGuard({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const { isPageAccessible, loading } = usePageAccess()
    const { isAdmin } = useAuth()

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-12 w-full max-w-md" />
                <Skeleton className="h-64 w-full" />
            </div>
        )
    }

    // Admins always have access, or if the page is accessible
    const hasAccess = isAdmin || isPageAccessible(pathname)

    if (!hasAccess) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-full mb-6">
                    <AlertTriangle className="w-12 h-12 text-yellow-600 dark:text-yellow-500" />
                </div>
                <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
                    Service Maintenance
                </h1>
                <p className="text-gray-600 dark:text-gray-400 max-w-md mb-8">
                    This section is currently undergoing maintenance and is temporarily unavailable.
                    Our team is working to restore it as quickly as possible. Thank you for your patience!
                </p>
                <Link href="/dashboard">
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md transition-all">
                        <Home className="w-4 h-4 mr-2" />
                        Return to Dashboard
                    </Button>
                </Link>
            </div>
        )
    }

    return <>{children}</>
}
