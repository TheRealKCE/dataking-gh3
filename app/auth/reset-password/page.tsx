'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Wifi, Loader2, Mail, MessageCircle, Phone } from 'lucide-react'
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
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
            <BackgroundBubbles />
            <FloatingWhatsApp />
            <div className="w-full max-w-md relative z-10">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-flex items-center space-x-2 group">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110 animate-[bounce_3s_infinite]">
                            <Wifi className="w-7 h-7 text-white" />
                        </div>
                        <span className="text-2xl font-bold text-white tracking-tight drop-shadow-md group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-400 group-hover:to-purple-400 transition-all">
                            KING FLEXY DATA LTD
                        </span>
                    </Link>
                </div>

                <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl text-white font-bold tracking-wide">Reset Password</CardTitle>
                        <CardDescription className="text-white/60 text-base">
                            {success ? 'Check your email for reset instructions' : 'Enter your email to receive a reset link'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {!success ? (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {error && (
                                    <Alert variant="destructive" className="bg-red-500/10 border-red-500/50">
                                        <AlertDescription className="text-red-400">{error}</AlertDescription>
                                    </Alert>
                                )}

                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-white/80">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="Enter your email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="h-11 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 focus:ring-purple-400/20 transition-all"
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full h-11 text-base font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg shadow-purple-900/20 transition-all duration-300 hover:scale-[1.02]"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Mail className="w-4 h-4 mr-2" />
                                            Send Reset Link
                                        </>
                                    )}
                                </Button>
                            </form>
                        ) : (
                            <div className="text-center py-4">
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto mb-4 animate-[bounce_1s_ease-in-out_2]">
                                    <Mail className="w-8 h-8 text-white" />
                                </div>
                                <p className="text-white/60 mb-4">
                                    We've sent a password reset link to <strong className="text-white">{email}</strong>
                                </p>
                            </div>
                        )}

                        {/* Contact Support */}
                        <div className="mt-8 p-4 rounded-xl bg-white/5 border border-white/10">
                            <h3 className="text-sm font-medium text-white mb-3">Need Help?</h3>
                            <p className="text-xs text-white/60 mb-4">
                                If you're having trouble resetting your password, contact our support team:
                            </p>
                            <div className="space-y-2">
                                <a
                                    href="https://wa.me/233XXXXXXXXX"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm text-green-400 hover:text-green-300"
                                >
                                    <MessageCircle className="w-4 h-4" />
                                    WhatsApp Support
                                </a>
                                <a
                                    href="mailto:support@ghdata.com"
                                    className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
                                >
                                    <Mail className="w-4 h-4" />
                                    support@ghdata.com
                                </a>
                                <a
                                    href="tel:+233XXXXXXXXX"
                                    className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300"
                                >
                                    <Phone className="w-4 h-4" />
                                    Call Support
                                </a>
                            </div>
                        </div>

                        <div className="mt-6 text-center">
                            <Link href="/auth/login" className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors">
                                ← Back to Login
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
