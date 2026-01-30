'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Clock, Mail, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'

export default function PendingApprovalPage() {
    const { user, signOut } = useAuth()
    const router = useRouter()

    useEffect(() => {
        // If not logged in, redirect to home
        if (!user) {
            router.push('/')
        }
    }, [user, router])

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-yellow-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
            <Card className="max-w-md w-full">
                <CardHeader className="text-center pb-4">
                    <div className="mx-auto w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mb-4">
                        <Clock className="w-8 h-8 text-yellow-600 dark:text-yellow-500" />
                    </div>
                    <CardTitle className="text-2xl">Account Pending Approval</CardTitle>
                    <CardDescription className="text-base mt-2">
                        Your registration is being reviewed
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4">
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <div className="flex gap-3">
                                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-blue-900 dark:text-blue-100">
                                    <p className="font-semibold mb-1">What happens next?</p>
                                    <ul className="space-y-1 text-blue-800 dark:text-blue-200">
                                        <li>• Our admin team will review your registration</li>
                                        <li>• You'll receive an email once approved</li>
                                        <li>• This usually takes 24-48 hours</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className="text-center text-sm text-muted-foreground">
                            <Mail className="w-4 h-4 inline mr-1" />
                            Check your email for updates
                        </div>

                        <div className="pt-4 border-t space-y-3">
                            <p className="text-sm text-muted-foreground text-center">
                                Need help or have questions?
                            </p>
                            <p className="text-sm font-medium text-center">
                                Contact: <a href="mailto:support@kingflexydataltd.com" className="text-blue-600 hover:underline">support@kingflexydataltd.com</a>
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => signOut()}
                        >
                            Sign Out
                        </Button>
                        <Button
                            asChild
                            className="flex-1"
                        >
                            <Link href="/">
                                Go to Homepage
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
