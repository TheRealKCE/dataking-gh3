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
        <div className="fixed inset-0 flex flex-col items-center justify-center p-4 overflow-hidden">
            <BackgroundBubbles />
            <FloatingWhatsApp />
            <div className="w-full max-w-sm relative z-10 flex flex-col items-center">
                {/* Logo - larger and prominent */}
                <div className="text-center mb-5">
                    <Link href="/" className="inline-flex flex-col items-center">
                        <div className="relative w-20 h-20 mb-3">
                            <div className="w-20 h-20 rounded-2xl bg-slate-900 flex items-center justify-center shadow-xl">
                                <Image
                                    src="/logo.png"
                                    alt="KING FLEXY DATA LTD"
                                    fill
                                    className="object-contain p-2"
                                    priority
                                />
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight drop-shadow-sm">
                            KING FLEXY DATA LTD
                        </h1>
                        <p className="text-base text-slate-700 mt-1">
                            Reset your password
                        </p>
                    </Link>
                </div>

                <Card className="w-full border-0 bg-[#E5E7EB]/60 backdrop-blur-md shadow-xl rounded-2xl overflow-hidden">
                    <CardContent className="p-5">
                        {!success ? (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <p className="text-slate-600 text-sm text-center">
                                    Enter your email to receive a reset link.
                                </p>

                                {error && (
                                    <Alert variant="destructive" className="bg-red-500/10 border-red-500/50 py-2">
                                        <AlertDescription className="text-red-600 text-sm">{error}</AlertDescription>
                                    </Alert>
                                )}

                                <div className="space-y-1.5">
                                    <Label htmlFor="email" className="text-slate-700 font-semibold text-sm">Email Address</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="your@email.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            className="h-12 pl-11 bg-white/90 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#0056B3] focus:ring-[#0056B3]/20 rounded-xl text-base"
                                        />
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full h-12 text-base font-bold bg-[#0056B3] hover:bg-[#004494] text-white shadow-lg rounded-xl"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-5 h-5 mr-2" />
                                            Send Reset Link
                                        </>
                                    )}
                                </Button>
                            </form>
                        ) : (
                            <div className="text-center py-4">
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto mb-4">
                                    <Mail className="w-8 h-8 text-white" />
                                </div>
                                <h2 className="text-xl font-bold text-slate-900 mb-2">Check Your Email</h2>
                                <p className="text-slate-600 text-sm">
                                    Reset link sent to <strong className="text-slate-900">{email}</strong>
                                </p>
                            </div>
                        )}

                        <div className="mt-5 text-center">
                            <Link href="/auth/login" className="text-base text-[#0056B3] font-semibold">
                                ← Back to Login
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
