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
        <div className="min-h-screen flex flex-col items-center justify-start p-3 pt-8 relative overflow-hidden">
            <BackgroundBubbles />
            <FloatingWhatsApp />
            <div className="w-full max-w-sm relative z-10">
                {/* Logo - static, no animation */}
                <div className="text-center mb-4">
                    <Link href="/" className="inline-flex flex-col items-center">
                        <div className="relative w-14 h-14 mb-2">
                            <div className="w-14 h-14 rounded-xl bg-slate-900 flex items-center justify-center shadow-lg">
                                <Image
                                    src="/logo.png"
                                    alt="KING FLEXY DATA LTD"
                                    fill
                                    className="object-contain p-1"
                                    priority
                                />
                            </div>
                        </div>
                        <span className="text-lg font-bold text-slate-900 tracking-tight">
                            KING FLEXY DATA LTD
                        </span>
                        <span className="text-xs text-slate-700/80">
                            Reset your password
                        </span>
                    </Link>
                </div>

                <Card className="border-0 bg-[#E5E7EB]/80 backdrop-blur-sm shadow-xl rounded-2xl overflow-hidden">
                    <CardContent className="p-4">
                        {!success ? (
                            <form onSubmit={handleSubmit} className="space-y-3">
                                <p className="text-slate-600 text-xs text-center mb-2">
                                    Enter your email to receive a reset link.
                                </p>

                                {error && (
                                    <Alert variant="destructive" className="bg-red-500/10 border-red-500/50 py-2">
                                        <AlertDescription className="text-red-600 text-xs">{error}</AlertDescription>
                                    </Alert>
                                )}

                                <div className="space-y-1">
                                    <Label htmlFor="email" className="text-slate-700 font-semibold text-sm">Email Address</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="your@email.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            className="h-11 pl-10 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#0056B3] focus:ring-[#0056B3]/20 rounded-lg text-sm"
                                        />
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full h-11 text-base font-bold bg-[#0056B3] hover:bg-[#004494] text-white shadow-md rounded-lg"
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
                            <div className="text-center py-2">
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto mb-4">
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
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
