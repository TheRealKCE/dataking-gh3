'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Mail, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { BackgroundBubbles } from '@/components/background-bubbles'
import { FloatingWhatsApp } from '@/components/floating-whatsapp'
import { WhatsAppCommunityButtons } from '@/components/whatsapp-community-buttons'

export default function ResetPasswordPage() {
    const [email, setEmail] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setIsLoading(true)

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/update-password`,
            })

            if (error) {
                setError(error.message)
                return
            }

            setSuccess(true)
            toast.success('Password reset email sent!')
        } catch (err) {
            setError('An unexpected error occurred')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center px-3 py-6 sm:p-4 overflow-y-auto">
            <BackgroundBubbles />
            <FloatingWhatsApp variant="auth" />
            <div className="w-full max-w-[340px] sm:max-w-sm relative z-10 flex flex-col items-center">
                {/* Logo - compact and visible */}
                <div className="text-center mb-4">
                    <Link href="/" className="inline-flex flex-col items-center">
                        <div className="relative w-16 h-16 sm:w-18 sm:h-18 mb-2">
                            <div className="w-full h-full rounded-xl bg-slate-900 flex items-center justify-center shadow-lg">
                                <Image
                                    src="/logo.png"
                                    alt="KING FLEXY DATA LTD"
                                    fill
                                    className="object-contain p-1.5"
                                    priority
                                />
                            </div>
                        </div>
                        <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                            KING FLEXY DATA LTD
                        </h1>
                        <p className="text-sm text-slate-600 mt-0.5">
                            Reset your password
                        </p>
                    </Link>
                </div>

                <Card className="w-full border-0 bg-[#E5E7EB]/60 backdrop-blur-md shadow-xl rounded-xl overflow-hidden">
                    <CardContent className="p-4 sm:p-5">
                        {!success ? (
                            <form onSubmit={handleSubmit} className="space-y-3">
                                <p className="text-slate-600 text-xs text-center">
                                    Enter your email to receive a reset link.
                                </p>

                                {error && (
                                    <Alert variant="destructive" className="bg-red-500/10 border-red-500/50 py-2">
                                        <AlertDescription className="text-red-600 text-xs">{error}</AlertDescription>
                                    </Alert>
                                )}

                                <div className="space-y-1">
                                    <Label htmlFor="email" className="text-slate-700 font-semibold text-xs">Email Address</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="your@email.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            className="h-10 pl-9 bg-white/90 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#0056B3] focus:ring-[#0056B3]/20 rounded-lg text-sm"
                                        />
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full h-10 text-sm font-bold bg-[#0056B3] hover:bg-[#004494] text-white shadow-md rounded-lg"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4 mr-2" />
                                            Send Reset Link
                                        </>
                                    )}
                                </Button>
                            </form>
                        ) : (
                            <div className="text-center py-3">
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto mb-3">
                                    <Mail className="w-7 h-7 text-white" />
                                </div>
                                <h2 className="text-lg font-bold text-slate-900 mb-2">Check Your Email</h2>
                                <p className="text-slate-600 text-sm">
                                    Reset link sent to <strong className="text-slate-900">{email}</strong>
                                </p>
                            </div>
                        )}

                        <div className="mt-4 text-center">
                            <Link href="/auth/login" className="text-sm text-[#0056B3] font-semibold">
                                ← Back to Login
                            </Link>
                        </div>

                        <div className="mt-4 border-t border-slate-300/50 pt-3">
                            <WhatsAppCommunityButtons compact />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
