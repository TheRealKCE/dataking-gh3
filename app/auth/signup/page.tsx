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
import { Eye, EyeOff, Loader2, UserPlus, Mail, Lock, User, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { validateGhanaianPhone } from '@/lib/phone-validation'
import { BackgroundBubbles } from '@/components/background-bubbles'
import { FloatingWhatsApp } from '@/components/floating-whatsapp'
import { WhatsAppCommunityButtons } from '@/components/whatsapp-community-buttons'

export default function SignupPage() {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phoneNumber: '',
        password: '',
        confirmPassword: '',
    })
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const { signUp } = useAuth()
    const router = useRouter()

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        const phoneValidation = validateGhanaianPhone(formData.phoneNumber)
        if (!phoneValidation.isValid) {
            setError(phoneValidation.error || 'Invalid phone number')
            return
        }

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match')
            return
        }

        if (formData.password.length < 8) {
            setError('Password must be at least 8 characters')
            return
        }

        setIsLoading(true)

        try {
            const { error, data } = await signUp({
                email: formData.email,
                password: formData.password,
                firstName: formData.firstName,
                lastName: formData.lastName,
                phoneNumber: phoneValidation.normalizedNumber,
            })

            if (error) {
                setError(error.message)
                return
            }

            fetch('/api/emails/welcome', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: formData.email,
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    phoneNumber: phoneValidation.normalizedNumber
                })
            }).catch(err => console.error('Welcome email error:', err))

            if (data?.session) {
                toast.success('Account created! logging in...')
                router.push('/dashboard')
                return
            }

            setSuccess(true)
            toast.success('Account created successfully!')
        } catch (err) {
            setError('An unexpected error occurred')
        } finally {
            setIsLoading(false)
        }
    }

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 pt-24 relative overflow-hidden">
                <BackgroundBubbles />
                <FloatingWhatsApp />
                <Card className="w-full max-w-md border-0 bg-[#E5E7EB]/80 backdrop-blur-sm relative z-10 shadow-2xl rounded-3xl">
                    <CardContent className="pt-8 text-center p-8">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto mb-6">
                            <Mail className="w-10 h-10 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Check Your Email</h2>
                        <p className="text-slate-600 mb-6">
                            We've sent a verification link to <strong className="text-slate-900">{formData.email}</strong>.
                            Please check your inbox and click the link to verify your account.
                        </p>
                        <Link href="/auth/login">
                            <Button className="w-full h-14 text-lg font-bold bg-[#0056B3] hover:bg-[#004494] text-white shadow-lg shadow-blue-500/30 transition-all duration-300 hover:scale-[1.02] rounded-xl border-2 border-[#004494]">
                                Go to Login
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 pt-20 pb-8 relative overflow-hidden">
            <BackgroundBubbles />
            <FloatingWhatsApp />
            <div className="w-full max-w-md relative z-10">
                {/* Logo - slower animation */}
                <div className="text-center mb-6 mt-8">
                    <Link href="/" className="inline-flex flex-col items-center group">
                        <div className="relative w-16 h-16 mb-2 transition-transform duration-700 group-hover:scale-110 animate-[pulse_4s_ease-in-out_infinite]">
                            <div className="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center shadow-xl">
                                <Image
                                    src="/logo.png"
                                    alt="KING FLEXY DATA LTD"
                                    fill
                                    className="object-contain p-1"
                                    priority
                                />
                            </div>
                        </div>
                        <span className="text-2xl font-bold text-slate-900 tracking-tight drop-shadow-sm">
                            Create Your Account
                        </span>
                        <span className="text-sm text-slate-700/80 mt-1">
                            Join KING FLEXY DATA LTD
                        </span>
                    </Link>
                </div>

                <Card className="border-0 bg-[#E5E7EB]/80 backdrop-blur-sm shadow-2xl rounded-3xl overflow-hidden">
                    <CardContent className="p-6 pt-8">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <Alert variant="destructive" className="bg-red-500/10 border-red-500/50">
                                    <AlertDescription className="text-red-600">{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="fullName" className="text-slate-700 font-semibold">Full Name</Label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <Input
                                        id="firstName"
                                        name="firstName"
                                        placeholder="Enter your full name"
                                        value={formData.firstName}
                                        onChange={handleChange}
                                        required
                                        className="h-14 pl-12 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#0056B3] focus:ring-[#0056B3]/20 transition-all rounded-xl text-base"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-slate-700 font-semibold">Email Address</Label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        placeholder="your@email.com"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                        className="h-14 pl-12 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#0056B3] focus:ring-[#0056B3]/20 transition-all rounded-xl text-base"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phoneNumber" className="text-slate-700 font-semibold">Mobile Number</Label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <Input
                                        id="phoneNumber"
                                        name="phoneNumber"
                                        type="tel"
                                        placeholder="024*********"
                                        value={formData.phoneNumber}
                                        onChange={handleChange}
                                        required
                                        className="h-14 pl-12 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#0056B3] focus:ring-[#0056B3]/20 transition-all rounded-xl text-base"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-slate-700 font-semibold">Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <Input
                                        id="password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Create a strong password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                        className="h-14 pl-12 pr-12 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#0056B3] focus:ring-[#0056B3]/20 transition-all rounded-xl text-base"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            <input type="hidden" name="lastName" value={formData.lastName} />

                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="w-full h-14 text-lg font-bold bg-[#0056B3] hover:bg-[#004494] text-white shadow-lg shadow-blue-500/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl rounded-xl border-2 border-[#004494]"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Creating account...
                                    </>
                                ) : (
                                    <>
                                        <UserPlus className="w-5 h-5 mr-2" />
                                        Create Account
                                    </>
                                )}
                            </Button>
                        </form>

                        <div className="flex items-center my-6">
                            <div className="flex-1 h-px bg-slate-300"></div>
                            <span className="px-4 text-sm text-slate-500">OR</span>
                            <div className="flex-1 h-px bg-slate-300"></div>
                        </div>

                        <div className="text-center">
                            <p className="text-slate-600 text-sm">
                                Already have an account?{' '}
                                <Link href="/auth/login" className="text-[#0056B3] hover:text-[#004494] font-bold transition-colors">
                                    Sign In
                                </Link>
                            </p>
                        </div>

                        <div className="mt-6 border-t border-slate-300 pt-6">
                            <WhatsAppCommunityButtons />
                        </div>

                        <p className="text-xs text-center text-slate-500 mt-6">
                            By signing up, you agree to our <Link href="/terms" className="font-semibold text-slate-700 hover:text-[#0056B3]">Terms</Link> and <Link href="/privacy" className="font-semibold text-slate-700 hover:text-[#0056B3]">Privacy Policy</Link>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
