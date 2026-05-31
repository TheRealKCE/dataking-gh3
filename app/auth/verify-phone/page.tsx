'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { BackgroundBubbles } from '@/components/background-bubbles'
import { FloatingWhatsApp } from '@/components/floating-whatsapp'

const RESEND_COOLDOWN = 60

function maskPhone(phone: string): string {
    if (!phone || phone.length < 6) return phone
    return phone.slice(0, 3) + 'X'.repeat(phone.length - 6) + phone.slice(-3)
}

export default function VerifyPhonePage() {
    const [otp, setOtp] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSending, setIsSending] = useState(false)
    const [error, setError] = useState('')
    const [cooldown, setCooldown] = useState(0)
    const { user, dbUser, isLoading: authLoading } = useAuth()

    const sendOtp = useCallback(async () => {
        setIsSending(true)
        setError('')
        try {
            const res = await fetch('/api/auth/verify-phone/send-otp', { method: 'POST' })
            const data = await res.json()

            if (res.status === 429) {
                const retryAfter = parseInt(res.headers.get('Retry-After') || '900')
                setError(`Too many requests. Please wait ${Math.ceil(retryAfter / 60)} minutes.`)
                return
            }

            if (!res.ok) {
                setError(data.error || 'Failed to send OTP')
                return
            }

            toast.success('Verification code sent!')
            setCooldown(RESEND_COOLDOWN)
        } catch {
            setError('Failed to send OTP. Please try again.')
        } finally {
            setIsSending(false)
        }
    }, [])

    // Auto-send OTP on mount
    useEffect(() => {
        if (!authLoading && user) {
            sendOtp()
        }
    }, [authLoading, user, sendOtp])

    // Cooldown countdown
    useEffect(() => {
        if (cooldown <= 0) return
        const timer = setTimeout(() => setCooldown(c => c - 1), 1000)
        return () => clearTimeout(timer)
    }, [cooldown])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (otp.length !== 6) {
            setError('Please enter the 6-digit code')
            return
        }

        setIsSubmitting(true)
        setError('')

        try {
            const res = await fetch('/api/auth/verify-phone/confirm-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ otp }),
            })

            const data = await res.json()

            if (res.status === 410) {
                setError('Code has expired. Please request a new one.')
                return
            }

            if (!res.ok) {
                setError(data.error || 'Incorrect code. Please try again.')
                return
            }

            toast.success('Phone verified! Welcome to ARHMS.')
            // Full reload so middleware re-checks phone_verified from DB
            window.location.href = '/dashboard'
        } catch {
            setError('An unexpected error occurred. Please try again.')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    const maskedPhone = dbUser?.phone_number ? maskPhone(dbUser.phone_number) : 'your number'

    return (
        <div className="relative min-h-screen w-full flex flex-col items-center justify-center px-4 py-12 overflow-y-auto bg-background">
            <BackgroundBubbles scrollable />
            <FloatingWhatsApp variant="auth" />

            <div className="w-full max-w-[420px] relative z-10 flex flex-col items-center animate-slow-fade">
                <div className="text-center mb-10">
                    <Link href="/" className="inline-flex flex-col items-center group">
                        <div className="relative w-20 h-20 mb-6">
                            <div className="relative w-full h-full rounded-3xl overflow-hidden bg-white shadow-[0_10px_40px_-10px_rgba(212,175,55,0.35)]">
                                <Image
                                    src="/arhms-logo.png"
                                    alt="ARHMS TECHNOLOGIES"
                                    fill
                                    className="object-contain"
                                    priority
                                />
                            </div>
                        </div>
                        <h1 className="text-3xl font-black text-foreground tracking-tighter uppercase">
                            ARHMS <span className="text-blue-600">TECHNOLOGIES</span>
                        </h1>
                        <p className="text-sm font-bold text-muted-foreground tracking-widest uppercase mt-2 opacity-70">
                            Verify Your Number
                        </p>
                    </Link>
                </div>

                <Card className="w-full card-premium border-border/50 bg-card/70 backdrop-blur-xl shadow-premium overflow-hidden">
                    <CardContent className="p-8">
                        <div className="flex flex-col items-center text-center mb-6">
                            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                                <ShieldCheck className="w-8 h-8 text-primary" />
                            </div>
                            <p className="text-sm font-bold text-muted-foreground">
                                A 6-digit code was sent to
                            </p>
                            <p className="text-base font-black text-foreground mt-1 tracking-widest">
                                {maskedPhone}
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive rounded-xl">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription className="text-xs font-bold uppercase tracking-tight">{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="otp" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Verification Code</Label>
                                <Input
                                    id="otp"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    placeholder="123456"
                                    value={otp}
                                    onChange={e => {
                                        const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                                        setOtp(val)
                                        if (error) setError('')
                                    }}
                                    required
                                    className="h-14 text-center text-2xl font-black tracking-[0.5em] bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20 rounded-2xl"
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={isSubmitting || otp.length !== 6}
                                className="w-full h-14 text-base font-black uppercase tracking-[0.2em] bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 rounded-2xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                ) : (
                                    'Verify Number'
                                )}
                            </Button>
                        </form>

                        <div className="flex items-center justify-center mt-6">
                            <button
                                type="button"
                                onClick={sendOtp}
                                disabled={isSending || cooldown > 0}
                                className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary hover:text-primary/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <RefreshCw className={`w-3 h-3 ${isSending ? 'animate-spin' : ''}`} />
                                {cooldown > 0 ? `Resend in ${cooldown}s` : isSending ? 'Sending...' : 'Resend Code'}
                            </button>
                        </div>

                        <p className="text-[9px] text-center text-muted-foreground font-bold tracking-widest uppercase mt-8 opacity-40">
                            By proceeding, you agree to our <Link href="/terms" className="text-foreground hover:text-primary transition-colors">Terms</Link> & <Link href="/privacy" className="text-foreground hover:text-primary transition-colors">Policy</Link>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
