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
        <div className="min-h-screen flex items-center justify-center p-4 pt-24 relative overflow-hidden">
            <BackgroundBubbles />
            <FloatingWhatsApp />
            <div className="w-full max-w-md relative z-10">
                {/* Logo - slower animation */}
                <div className="text-center mb-8 mt-8">
                    <Link href="/" className="inline-flex flex-col items-center group">
                        <div className="relative w-20 h-20 mb-3 transition-transform duration-700 group-hover:scale-110 animate-[pulse_4s_ease-in-out_infinite]">
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
                        <span className="text-xl font-bold text-slate-900 tracking-tight drop-shadow-sm">
                            KING FLEXY DATA LTD
                        </span>
                        <span className="text-sm text-slate-700/80 mt-1">
                            Reset your password
                        </span>
                    </Link>
                </div>

                <Card className="border-0 bg-[#E5E7EB]/80 backdrop-blur-sm shadow-2xl rounded-3xl overflow-hidden">
                    <CardContent className="p-6 pt-8">
                        {!success ? (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="text-center mb-4">
                                    <p className="text-slate-600 text-sm">
                                        Enter your email address and we'll send you a link to reset your password.
                                    </p>
                                </div>

                                {error && (
                                    <Alert variant="destructive" className="bg-red-500/10 border-red-500/50">
                                        <AlertDescription className="text-red-600">{error}</AlertDescription>
                                    </Alert>
                                )}

                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-slate-700 font-semibold">Email Address</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="your@email.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            className="h-14 pl-12 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#0056B3] focus:ring-[#0056B3]/20 transition-all rounded-xl text-base"
                                        />
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full h-14 text-lg font-bold bg-[#0056B3] hover:bg-[#004494] text-white shadow-lg shadow-blue-500/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl rounded-xl border-2 border-[#004494]"
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
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto mb-6">
                                    <Mail className="w-10 h-10 text-white" />
                                </div>
                                <h2 className="text-xl font-bold text-slate-900 mb-2">Check Your Email</h2>
                                <p className="text-slate-600 mb-4">
                                    We've sent a password reset link to <strong className="text-slate-900">{email}</strong>
                                </p>
                            </div>
                        )}

                        <div className="mt-6 text-center">
                            <Link href="/auth/login" className="text-sm text-[#0056B3] hover:text-[#004494] font-semibold transition-colors">
                                ← Back to Login
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
