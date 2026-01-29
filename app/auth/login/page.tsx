'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Eye, EyeOff, Loader2, LogIn, Mail, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { BackgroundBubbles } from '@/components/background-bubbles'
import { FloatingWhatsApp } from '@/components/floating-whatsapp'
import { WhatsAppCommunityButtons } from '@/components/whatsapp-community-buttons'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const { signIn } = useAuth()
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setIsLoading(true)

        try {
            const { error } = await signIn(email, password)

            if (error) {
                setError(error.message)
                return
            }

            toast.success('Welcome back!')
            window.location.href = '/dashboard'
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
                            Sign in to continue
                        </p>
                    </Link>
                </div>

                <Card className="w-full border-0 bg-[#E5E7EB]/60 backdrop-blur-md shadow-xl rounded-xl overflow-hidden">
                    <CardContent className="p-4 sm:p-5">
                        <form onSubmit={handleSubmit} className="space-y-3">
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

                            <div className="space-y-1">
                                <Label htmlFor="password" className="text-slate-700 font-semibold text-xs">Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="h-10 pl-9 pr-9 bg-white/90 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#0056B3] focus:ring-[#0056B3]/20 rounded-lg text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
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
                                        Signing in...
                                    </>
                                ) : (
                                    <>
                                        <LogIn className="w-4 h-4 mr-2" />
                                        Sign In
                                    </>
                                )}
                            </Button>
                        </form>

                        <div className="flex items-center my-3">
                            <div className="flex-1 h-px bg-slate-300/60"></div>
                            <span className="px-2 text-xs text-slate-500">OR</span>
                            <div className="flex-1 h-px bg-slate-300/60"></div>
                        </div>

                        <div className="text-center">
                            <p className="text-slate-600 text-xs">
                                Don't have an account?{' '}
                                <Link href="/auth/signup" className="text-[#0056B3] font-bold">
                                    Create Account
                                </Link>
                            </p>
                        </div>

                        <div className="mt-2 text-center">
                            <Link href="/auth/reset-password" className="text-xs text-slate-500 hover:text-[#0056B3]">
                                Forgot password?
                            </Link>
                        </div>

                        <div className="mt-4 border-t border-slate-300/50 pt-3">
                            <WhatsAppCommunityButtons compact />
                        </div>

                        <p className="text-[10px] text-center text-slate-500 mt-3">
                            By signing in, you agree to our <Link href="/terms" className="font-semibold text-slate-700">Terms</Link> and <Link href="/privacy" className="font-semibold text-slate-700">Privacy Policy</Link>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
