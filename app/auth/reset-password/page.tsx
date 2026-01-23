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
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-flex items-center space-x-2">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                            <Wifi className="w-7 h-7 text-white" />
                        </div>
                        <span className="text-2xl font-bold text-white">KING FLEXY DATA LTD</span>
                    </Link>
                </div>

                <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl text-white">Reset Password</CardTitle>
                        <CardDescription className="text-white/60">
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
                                        className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
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
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto mb-4">
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
                            <Link href="/auth/login" className="text-sm text-blue-400 hover:text-blue-300">
                                ← Back to Login
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
