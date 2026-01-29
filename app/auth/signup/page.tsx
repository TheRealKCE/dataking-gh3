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
            <div className="min-h-screen flex flex-col items-center justify-start p-3 pt-8 relative overflow-hidden">
                <BackgroundBubbles />
                <FloatingWhatsApp />
                <Card className="w-full max-w-sm border-0 bg-[#E5E7EB]/80 backdrop-blur-sm relative z-10 shadow-xl rounded-2xl">
                    <CardContent className="pt-6 text-center p-4">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto mb-4">
                            <Mail className="w-7 h-7 text-white" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-900 mb-2">Check Your Email</h2>
                        <p className="text-slate-600 text-sm mb-4">
                            We've sent a verification link to <strong className="text-slate-900">{formData.email}</strong>.
                        </p>
                        <Link href="/auth/login">
                            <Button className="w-full h-11 text-base font-bold bg-[#0056B3] hover:bg-[#004494] text-white shadow-md rounded-lg">
                                Go to Login
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-start p-3 pt-6 relative overflow-hidden">
            <BackgroundBubbles />
            <FloatingWhatsApp />
            <div className="w-full max-w-sm relative z-10">
                {/* Logo - static, no animation */}
                <div className="text-center mb-3">
                    <Link href="/" className="inline-flex flex-col items-center">
                        <div className="relative w-12 h-12 mb-1">
                            <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center shadow-lg">
                                <Image
                                    src="/logo.png"
                                    alt="KING FLEXY DATA LTD"
                                    fill
                                    className="object-contain p-1"
                                    priority
                                />
                            </div>
                        </div>
                        <span className="text-base font-bold text-slate-900 tracking-tight">
                            Create Your Account
                        </span>
                        <span className="text-xs text-slate-700/80">
                            Join KING FLEXY DATA LTD
                        </span>
                    </Link>
                </div>

                <Card className="border-0 bg-[#E5E7EB]/80 backdrop-blur-sm shadow-xl rounded-2xl overflow-hidden">
                    <CardContent className="p-4">
                        <form onSubmit={handleSubmit} className="space-y-2.5">
                            {error && (
                                <Alert variant="destructive" className="bg-red-500/10 border-red-500/50 py-2">
                                    <AlertDescription className="text-red-600 text-xs">{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-1">
                                <Label htmlFor="fullName" className="text-slate-700 font-semibold text-sm">Full Name</Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        id="firstName"
                                        name="firstName"
                                        placeholder="Enter your full name"
                                        value={formData.firstName}
                                        onChange={handleChange}
                                        required
                                        className="h-10 pl-10 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#0056B3] focus:ring-[#0056B3]/20 rounded-lg text-sm"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="email" className="text-slate-700 font-semibold text-sm">Email Address</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        placeholder="your@email.com"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                        className="h-10 pl-10 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#0056B3] focus:ring-[#0056B3]/20 rounded-lg text-sm"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="phoneNumber" className="text-slate-700 font-semibold text-sm">Mobile Number</Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        id="phoneNumber"
                                        name="phoneNumber"
                                        type="tel"
                                        placeholder="024*********"
                                        value={formData.phoneNumber}
                                        onChange={handleChange}
                                        required
                                        className="h-10 pl-10 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#0056B3] focus:ring-[#0056B3]/20 rounded-lg text-sm"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="password" className="text-slate-700 font-semibold text-sm">Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        id="password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Create a strong password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                        className="h-10 pl-10 pr-10 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#0056B3] focus:ring-[#0056B3]/20 rounded-lg text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <input type="hidden" name="lastName" value={formData.lastName} />
                            <input type="hidden" name="confirmPassword" value={formData.password} onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))} />

                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="w-full h-11 text-base font-bold bg-[#0056B3] hover:bg-[#004494] text-white shadow-md rounded-lg mt-1"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <UserPlus className="w-4 h-4 mr-2" />
                                        Create Account
                                    </>
                                )}
                            </Button>
                        </form>

                        <div className="flex items-center my-3">
                            <div className="flex-1 h-px bg-slate-300"></div>
                            <span className="px-3 text-xs text-slate-500">OR</span>
                            <div className="flex-1 h-px bg-slate-300"></div>
                        </div>

                        <div className="text-center">
                            <p className="text-slate-600 text-xs">
                                Already have an account?{' '}
                                <Link href="/auth/login" className="text-[#0056B3] font-bold">
                                    Sign In
                                </Link>
                            </p>
                        </div>

                        <p className="text-[10px] text-center text-slate-500 mt-3">
                            By signing up, you agree to our <Link href="/terms" className="font-semibold text-slate-700">Terms</Link> and <Link href="/privacy" className="font-semibold text-slate-700">Privacy Policy</Link>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
