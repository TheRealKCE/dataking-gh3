'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Wifi, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { validateGhanaianPhone } from '@/lib/phone-validation'

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

        // Validate phone number
        const phoneValidation = validateGhanaianPhone(formData.phoneNumber)
        if (!phoneValidation.isValid) {
            setError(phoneValidation.error || 'Invalid phone number')
            return
        }

        // Validate password match
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match')
            return
        }

        // Validate password strength
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

            // Send welcome email (async, non-blocking)
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

            // Auto login if session is created
            if (data?.session) {
                toast.success('Account created! logging in...')
                router.push('/dashboard') // Or router.refresh() depending on logic
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
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
                <Card className="w-full max-w-md border-white/10 bg-white/5 backdrop-blur-xl">
                    <CardContent className="pt-8 text-center">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Check Your Email</h2>
                        <p className="text-white/60 mb-6">
                            We've sent a verification link to <strong className="text-white">{formData.email}</strong>.
                            Please check your inbox and click the link to verify your account.
                        </p>
                        <Link href="/auth/login">
                            <Button className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                                Go to Login
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4 py-12">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-flex items-center space-x-2">
                        <div className="relative w-12 h-12">
                            <Image
                                src="/logo.png"
                                alt="KING FLEXY DATA LTD"
                                fill
                                className="object-contain"
                                priority
                            />
                        </div>
                        <span className="text-2xl font-bold text-white">KING FLEXY DATA LTD</span>
                    </Link>
                </div>

                <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl text-white">Create Account</CardTitle>
                        <CardDescription className="text-white/60">
                            Sign up to start buying data packages
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <Alert variant="destructive" className="bg-red-500/10 border-red-500/50">
                                    <AlertDescription className="text-red-400">{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="firstName" className="text-white/80">First Name</Label>
                                    <Input
                                        id="firstName"
                                        name="firstName"
                                        placeholder="John"
                                        value={formData.firstName}
                                        onChange={handleChange}
                                        required
                                        className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lastName" className="text-white/80">Last Name</Label>
                                    <Input
                                        id="lastName"
                                        name="lastName"
                                        placeholder="Doe"
                                        value={formData.lastName}
                                        onChange={handleChange}
                                        required
                                        className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-white/80">Email</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="john@example.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phoneNumber" className="text-white/80">Phone Number</Label>
                                <Input
                                    id="phoneNumber"
                                    name="phoneNumber"
                                    type="tel"
                                    placeholder="0241234567"
                                    value={formData.phoneNumber}
                                    onChange={handleChange}
                                    required
                                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                                />
                                <p className="text-xs text-white/40">Enter a valid Ghanaian phone number</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-white/80">Password</Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Min. 8 characters"
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                        className="bg-white/10 border-white/20 text-white placeholder:text-white/40 pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword" className="text-white/80">Confirm Password</Label>
                                <Input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type="password"
                                    placeholder="Confirm your password"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
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
                                        Creating account...
                                    </>
                                ) : (
                                    'Create Account'
                                )}
                            </Button>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-white/60 text-sm">
                                Already have an account?{' '}
                                <Link href="/auth/login" className="text-blue-400 hover:text-blue-300 font-medium">
                                    Sign in
                                </Link>
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
