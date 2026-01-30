'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { XCircle, Mail, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'

export default function AccountRejectedPage() {
    const { user, signOut } = useAuth()
    const router = useRouter()

    useEffect(() => {
        // Auto sign out if user is still logged in
        if (user) {
            signOut()
        }
    }, [user, signOut])

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
            <Card className="max-w-md w-full">
                <CardHeader className="text-center pb-4">
                    <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
                        <XCircle className="w-8 h-8 text-red-600 dark:text-red-500" />
                    </div>
                    <CardTitle className="text-2xl">Account Not Approved</CardTitle>
                    <CardDescription className="text-base mt-2">
                        Your registration was not approved
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4">
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <p className="text-sm text-red-900 dark:text-red-100">
                                Unfortunately, your account registration could not be approved at this time.
                            </p>
                        </div>

                        <div className="pt-4 border-t space-y-3">
                            <p className="text-sm text-muted-foreground text-center">
                                If you believe this is an error or need clarification:
                            </p>
                            <div className="flex items-center justify-center gap-2 text-sm">
                                <Mail className="w-4 h-4 text-muted-foreground" />
                                <a href="mailto:support@kingflexydataltd.com" className="font-medium text-blue-600 hover:underline">
                                    support@kingflexydataltd.com
                                </a>
                            </div>
                        </div>
                    </div>

                    <Button
                        asChild
                        className="w-full"
                    >
                        <Link href="/">
                            <Home className="w-4 h-4 mr-2" />
                            Return to Homepage
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
