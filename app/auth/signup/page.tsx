'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Eye, EyeOff, Loader2, UserPlus, Mail, Lock, User, Phone, Store, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { validateGhanaianPhone } from '@/lib/phone-validation'
import { BackgroundBubbles } from '@/components/background-bubbles'
import { FloatingWhatsApp } from '@/components/floating-whatsapp'
import { getCachedPricing } from '@/lib/pricing-cache'

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
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    const [lockoutMinutes, setLockoutMinutes] = useState<number | null>(null)
    const { signUp } = useAuth()
    const router = useRouter()
    const [guestUrl, setGuestUrl] = useState('https://kingflexygh.com/shop/felix-s-shop')

    useEffect(() => {
        getCachedPricing().then(data => {
            if (data?.guestStorefrontUrl) {
                setGuestUrl(data.guestStorefrontUrl)
            }
        }).catch(console.error)
    }, [])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }))
        if (fieldErrors[e.target.name]) {
            setFieldErrors(prev => {
                const { [e.target.name]: _, ...rest } = prev
                return rest
            })
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        const phoneValidation = validateGhanaianPhone(formData.phoneNumber)
        if (!phoneValidation.isValid) {
            setError(phoneValidation.error || 'Invalid phone number')
            return
        }

        if (formData.password.length < 8) {
            setError('Password must be at least 8 characters')
            return
        }

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match')
            return
        }

        setIsLoading(true)
        setFieldErrors({})

        try {
            const { error, data } = await signUp({
                email: formData.email,
                password: formData.password,
                firstName: formData.firstName,
                lastName: formData.lastName,
                phoneNumber: phoneValidation.normalizedNumber,
            })

            if (error) {
                if (error.details) {
                    const newErrors: Record<string, string> = {}
                    error.details.forEach((err: string) => {
                        const [field, ...msgParts] = err.split(': ')
                        if (field) newErrors[field] = msgParts.join(': ')
                    })
                    setFieldErrors(newErrors)
                    setError('Please fix the errors below.')
                } else if (error.message?.startsWith('TOO_MANY_ATTEMPTS:')) {
                    const minutes = parseInt(error.message.split(':')[1])
                    setLockoutMinutes(minutes)
                    setError(`Too many attempts. Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`)
                } else {
                    setLockoutMinutes(null)
                    setError(error.message)
                }
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
            <div className="relative min-h-screen w-full flex flex-col items-center justify-center px-4 py-8 sm:py-10 overflow-y-auto">
                <BackgroundBubbles scrollable />
                <FloatingWhatsApp variant="auth" />
                <Card className="w-full max-w-[380px] sm:max-w-md border-0 bg-[#E5E7EB]/70 backdrop-blur-md relative z-10 shadow-2xl rounded-2xl">
                    <CardContent className="pt-8 text-center p-6">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto mb-4">
                            <Mail className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 mb-2">Check Your Email</h2>
                        <p className="text-slate-600 text-sm mb-5">
                            We've sent a verification link to <strong className="text-slate-900">{formData.email}</strong>.
                        </p>
                        <Link href="/auth/login">
                            <Button className="w-full h-12 text-base font-bold bg-[#0056B3] hover:bg-[#004494] text-white shadow-lg rounded-xl">
                                Go to Login
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="relative min-h-screen w-full flex flex-col items-center justify-center px-4 py-8 sm:py-10 overflow-y-auto">
            <BackgroundBubbles scrollable />
            <FloatingWhatsApp variant="auth" />
            <div className="w-full max-w-[380px] sm:max-w-md relative z-10 flex flex-col items-center">
                {/* Logo - professional and visible */}
                <div className="text-center mb-5">
                    <Link href="/" className="inline-flex flex-col items-center">
                        <div className="relative w-18 h-18 sm:w-20 sm:h-20 mb-2">
                            <div className="w-full h-full rounded-2xl bg-slate-900 flex items-center justify-center shadow-xl">
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
                            Create Your Account
                        </h1>
                        <p className="text-sm text-slate-600 mt-0.5">
                            Join KING FLEXY DATA LTD
                        </p>
                    </Link>
                </div>

                <Card className="w-full border-0 bg-[#EEEEEE]/30 backdrop-blur-md shadow-2xl rounded-2xl overflow-hidden">
                    <CardContent className="p-5 sm:p-6">
                        <form onSubmit={handleSubmit} className="space-y-3.5">
                            {error && (
                                <Alert variant="destructive" className={lockoutMinutes !== null ? "bg-orange-500/10 border-orange-500/50 py-2" : "bg-red-500/10 border-red-500/50 py-2"}>
                                    <AlertDescription className={lockoutMinutes !== null ? "text-orange-600 text-sm" : "text-red-600 text-sm"}>{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="grid grid-cols-2 gap-2 sm:gap-3.5">
                                <div className="space-y-1.5">
                                    <Label htmlFor="firstName" className="text-slate-700 font-semibold text-sm">First Name</Label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <Input
                                            id="firstName"
                                            name="firstName"
                                            placeholder="First name"
                                            value={formData.firstName}
                                            onChange={handleChange}
                                            required
                                            className={`h-11 pl-11 bg-white/95 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#0056B3] focus:ring-[#0056B3]/20 rounded-xl text-base ${fieldErrors.firstName ? 'border-red-500 focus:ring-red-500' : ''}`}
                                        />
                                    </div>
                                    {fieldErrors.firstName && <p className="text-red-500 text-xs mt-1 px-1">{fieldErrors.firstName}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="lastName" className="text-slate-700 font-semibold text-sm">Last Name</Label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <Input
                                            id="lastName"
                                            name="lastName"
                                            placeholder="Last name"
                                            value={formData.lastName}
                                            onChange={handleChange}
                                            required
                                            className={`h-11 pl-11 bg-white/95 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#0056B3] focus:ring-[#0056B3]/20 rounded-xl text-base ${fieldErrors.lastName ? 'border-red-500 focus:ring-red-500' : ''}`}
                                        />
                                    </div>
                                    {fieldErrors.lastName && <p className="text-red-500 text-xs mt-1 px-1">{fieldErrors.lastName}</p>}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="email" className="text-slate-700 font-semibold text-sm">Email Address</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        placeholder="your@email.com"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                        className={`h-11 pl-11 bg-white/95 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#0056B3] focus:ring-[#0056B3]/20 rounded-xl text-base ${fieldErrors.email ? 'border-red-500 focus:ring-red-500' : ''}`}
                                    />
                                </div>
                                {fieldErrors.email && <p className="text-red-500 text-xs mt-1 px-1">{fieldErrors.email}</p>}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="phoneNumber" className="text-slate-700 font-semibold text-sm">Mobile Number</Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <Input
                                        id="phoneNumber"
                                        name="phoneNumber"
                                        type="tel"
                                        placeholder="024*********"
                                        value={formData.phoneNumber}
                                        onChange={handleChange}
                                        required
                                        className={`h-11 pl-11 bg-white/95 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#0056B3] focus:ring-[#0056B3]/20 rounded-xl text-base ${fieldErrors.phoneNumber ? 'border-red-500 focus:ring-red-500' : ''}`}
                                    />
                                </div>
                                {fieldErrors.phoneNumber && <p className="text-red-500 text-xs mt-1 px-1">{fieldErrors.phoneNumber}</p>}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="password" className="text-slate-700 font-semibold text-sm">Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <Input
                                        id="password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Create a strong password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                        className={`h-11 pl-11 pr-11 bg-white/95 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#0056B3] focus:ring-[#0056B3]/20 rounded-xl text-base ${fieldErrors.password ? 'border-red-500 focus:ring-red-500' : ''}`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                                {fieldErrors.password && <p className="text-red-500 text-xs mt-1 px-1">{fieldErrors.password}</p>}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="confirmPassword" className="text-slate-700 font-semibold text-sm">Confirm Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <Input
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Confirm your password"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        required
                                        className="h-11 pl-11 pr-11 bg-white/95 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#0056B3] focus:ring-[#0056B3]/20 rounded-xl text-base"
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
                                disabled={isLoading || lockoutMinutes !== null}
                                className="w-full sm:w-auto sm:min-w-[200px] sm:mx-auto h-12 text-base font-bold bg-sky-500 hover:bg-sky-600 text-white shadow-lg rounded-xl mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {lockoutMinutes !== null ? (
                                    `Locked — try again in ${lockoutMinutes}m`
                                ) : isLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <UserPlus className="w-5 h-5 mr-2" />
                                        Create Account
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
                                Just want to buy data quickly?
                            </p>
                            <Button
                                asChild
                                variant="outline"
                                className="w-full sm:w-auto sm:min-w-[200px] sm:mx-auto h-12 text-base font-bold text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 shadow-sm rounded-xl flex items-center justify-center gap-2"
                            >
                                <a href={guestUrl}>
                                    <Store className="w-5 h-5" />
                                    Buy as Guest (No Account)
                                    <ExternalLink className="w-4 h-4 ml-1 opacity-70" />
                                </a>
                            </Button>
                        </div>

                        <div className="text-center space-y-3 mt-4">
                            <p className="text-slate-600 text-sm">
                                Already have an account?
                            </p>
                            <Button
                                asChild
                                variant="default"
                                className="w-full sm:w-auto sm:min-w-[200px] sm:mx-auto h-12 text-base font-bold bg-sky-500 hover:bg-sky-600 text-white shadow-lg rounded-xl flex items-center justify-center"
                            >
                                <Link href="/auth/login">
                                    Sign In
                                </Link>
                            </Button>
                        </div>

                        <div className="mt-4 border-t border-slate-300/50 pt-4">
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
                            By signing up, you agree to our <Link href="/terms" className="font-semibold text-slate-700">Terms</Link> and <Link href="/privacy" className="font-semibold text-slate-700">Privacy Policy</Link>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
