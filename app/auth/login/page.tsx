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
        <div className="relative min-h-screen w-full flex flex-col items-center justify-center px-4 py-8 sm:py-10 overflow-y-auto">
            <BackgroundBubbles scrollable />
            <FloatingWhatsApp variant="auth" />

            <div className="w-full max-w-[380px] sm:max-w-md relative z-10 flex flex-col items-center">
                {/* Logo - professional and visible */}
                <div className="text-center mb-6">
                    <Link href="/" className="inline-flex flex-col items-center">
                        <div className="relative w-20 h-20 sm:w-24 sm:h-24 mb-3">
                            <div className="w-full h-full rounded-2xl bg-slate-900 flex items-center justify-center shadow-xl">
                                <Image
                                    src="/logo.png"
                                    alt="KING FLEXY DATA LTD"
                                    fill
                                    className="object-contain p-2"
                                    priority
                                />
                            </div>
                        </div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                            KING FLEXY DATA LTD
                        </h1>
                        <p className="text-base text-slate-600 mt-1">
                            Sign in to continue
                        </p>
                    </Link>
                </div>

                <Card className="w-full border-0 bg-[#EEEEEE]/30 backdrop-blur-md shadow-2xl rounded-2xl overflow-hidden">
                    <CardContent className="p-5 sm:p-6">
                        <form onSubmit={handleSubmit} className="space-y-4">
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
                                        className="h-12 pl-11 bg-white/95 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#0056B3] focus:ring-[#0056B3]/20 rounded-xl text-base"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="password" className="text-slate-700 font-semibold text-sm">Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="h-12 pl-11 pr-11 bg-white/95 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#0056B3] focus:ring-[#0056B3]/20 rounded-xl text-base"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="w-full sm:w-auto sm:min-w-[200px] sm:mx-auto h-12 text-base font-bold bg-sky-500 hover:bg-sky-600 text-white shadow-lg rounded-xl"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Signing in...
                                    </>
                                ) : (
                                    <>
                                        <LogIn className="w-5 h-5 mr-2" />
                                        Sign In
                                    </>
                                )}
                            </Button>
                        </form>

                        <div className="flex items-center my-4">
                            <div className="flex-1 h-px bg-slate-300/60"></div>
                            <span className="px-3 text-sm text-slate-500">OR</span>
                            <div className="flex-1 h-px bg-slate-300/60"></div>
                        </div>

                        <div className="text-center space-y-3 mt-4">
                            <p className="text-slate-600 text-sm">
                                Don't have an account?
                            </p>
                            <Button
                                asChild
                                variant="default"
                                className="w-full sm:w-auto sm:min-w-[200px] sm:mx-auto h-12 text-base font-bold bg-sky-500 hover:bg-sky-600 text-white shadow-lg rounded-xl flex items-center justify-center"
                            >
                                <Link href="/auth/signup">
                                    Create New Account
                                </Link>
                            </Button>
                        </div>

                        <div className="text-center space-y-3 mt-4">
                            <p className="text-slate-600 text-sm">
                                Forgot your password?
                            </p>
                            <Button
                                asChild
                                variant="default"
                                className="w-full sm:w-auto sm:min-w-[200px] sm:mx-auto h-12 text-base font-bold bg-sky-500 hover:bg-sky-600 text-white shadow-lg rounded-xl flex items-center justify-center"
                            >
                                <Link href="/auth/reset-password">
                                    Reset Password
                                </Link>
                            </Button>
                        </div>

                        <div className="mt-5 border-t border-slate-300/50 pt-4">
                            <div className="space-y-2">
                                <p className="text-xs font-semibold text-slate-700 text-center">Join Our Community</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <a
                                        href="https://chat.whatsapp.com/FC6jYV3VDEQ4MmdTXiFqDV?mode=gi_t"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#25D366] hover:bg-[#128C7E] text-white font-semibold text-sm transition-all duration-300 shadow-md hover:shadow-lg"
                                    >
                                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.88 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                        </svg>
                                        Group
                                    </a>
                                    <a
                                        href="https://whatsapp.com/channel/0029Vb7HTfx47XeIZz7ht232"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#25D366] hover:bg-[#128C7E] text-white font-semibold text-sm transition-all duration-300 shadow-md hover:shadow-lg"
                                    >
                                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.88 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                        </svg>
                                        Channel
                                    </a>
                                </div>
                            </div>
                        </div>

                        <p className="text-xs text-center text-slate-500 mt-4">
                            By signing in, you agree to our <Link href="/terms" className="font-semibold text-slate-700">Terms</Link> and <Link href="/privacy" className="font-semibold text-slate-700">Privacy Policy</Link>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
