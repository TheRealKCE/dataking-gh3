'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Eye, EyeOff, Loader2, Phone, Lock, Store, AlertCircle, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { validateGhanaianPhone } from '@/lib/phone-validation'

export default function SellerLoginPage() {
    const [phone, setPhone] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const router = useRouter()

    // Normalize phone to international format for Supabase
    const normalizePhone = (raw: string): string => {
        const digits = raw.replace(/\D/g, '')
        if (digits.startsWith('0') && digits.length === 10) {
            return '+233' + digits.slice(1)
        }
        if (digits.startsWith('233')) {
            return '+' + digits
        }
        return raw
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        const trimmed = phone.trim()
        const validation = validateGhanaianPhone(trimmed)
        if (!validation.isValid) {
            setError(validation.error || 'Enter a valid Ghanaian phone number')
            return
        }

        if (!password) {
            setError('Password is required')
            return
        }

        setIsLoading(true)
        try {
            const internationalPhone = normalizePhone(trimmed)

            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                phone: internationalPhone,
                password,
            })

            if (signInError) {
                if (signInError.message.includes('rate limit') || signInError.message.includes('Too many')) {
                    setError('Too many attempts. Please try again later.')
                } else if (signInError.message.includes('Invalid login')) {
                    setError('Incorrect phone number or password.')
                } else {
                    setError(signInError.message)
                }
                return
            }

            if (!data.session) {
                setError('Login failed. Please try again.')
                return
            }

            // Fetch user's seller status
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('is_seller, role')
                .eq('id', data.session.user.id)
                .single()

            if (userError || !userData) {
                setError('Could not verify account. Please try again.')
                return
            }

            if (userData.is_seller) {
                toast.success('Welcome back! Redirecting to your dashboard...')
                router.push('/classifieds/seller/dashboard')
            } else {
                toast.info('You are not a seller yet. Let\'s set you up!')
                router.push('/classifieds/become-seller')
            }
        } catch (err) {
            setError('An unexpected error occurred. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center px-4 py-12">
            {/* Background decorative blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl" />
            </div>

            <div className="w-full max-w-[420px] relative z-10 flex flex-col items-center">
                {/* Branding */}
                <div className="text-center mb-10">
                    <Link href="/classifieds" className="inline-flex flex-col items-center group">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/50 transition-shadow">
                            <ShoppingBag className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-3xl font-black text-white tracking-tight">
                            ARHMS <span className="text-blue-400">MARKETPLACE</span>
                        </h1>
                        <p className="text-sm font-semibold text-slate-400 tracking-widest uppercase mt-2">
                            Seller Portal
                        </p>
                    </Link>
                </div>

                <Card className="w-full bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/40 rounded-3xl overflow-hidden">
                    <CardContent className="p-8">
                        <div className="mb-8">
                            <h2 className="text-xl font-black text-white">Sign in to your store</h2>
                            <p className="text-sm text-slate-400 mt-1">Use your phone number and password</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <Alert className="bg-red-500/10 border-red-500/20 text-red-400 rounded-xl">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription className="text-xs font-bold uppercase tracking-tight">
                                        {error}
                                    </AlertDescription>
                                </Alert>
                            )}

                            {/* Phone Number */}
                            <div className="space-y-2">
                                <Label
                                    htmlFor="seller-phone"
                                    className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1"
                                >
                                    Phone Number
                                </Label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <Input
                                        id="seller-phone"
                                        type="tel"
                                        placeholder="0241234567"
                                        value={phone}
                                        onChange={(e) => {
                                            setPhone(e.target.value)
                                            setError('')
                                        }}
                                        required
                                        className="h-14 pl-12 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-blue-500/50 focus:ring-blue-500/20 rounded-2xl text-base font-medium"
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between ml-1">
                                    <Label
                                        htmlFor="seller-password"
                                        className="text-xs font-black uppercase tracking-widest text-slate-400"
                                    >
                                        Password
                                    </Label>
                                    <Link
                                        href="/auth/reset-password"
                                        className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors"
                                    >
                                        Forgot?
                                    </Link>
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <Input
                                        id="seller-password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => {
                                            setPassword(e.target.value)
                                            setError('')
                                        }}
                                        required
                                        className="h-14 pl-12 pr-12 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-blue-500/50 focus:ring-blue-500/20 rounded-2xl text-base font-medium tracking-widest"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            {/* Submit */}
                            <button
                                id="seller-login-submit"
                                type="submit"
                                disabled={isLoading}
                                className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black uppercase tracking-[0.2em] rounded-2xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-blue-500/20 mt-2"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <Store className="w-5 h-5" />
                                        Sign In
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-8 pt-6 border-t border-white/10 space-y-3">
                            <Link
                                href="/classifieds/become-seller"
                                className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-sm font-bold transition-all"
                            >
                                Not a seller yet? Become one →
                            </Link>

                            <Link
                                href="/classifieds"
                                className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl text-slate-500 hover:text-slate-300 text-sm font-semibold transition-colors"
                            >
                                ← Browse Marketplace
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                <p className="text-[10px] text-center text-slate-600 font-bold tracking-widest uppercase mt-8">
                    ARHMS MARKETPLACE · Sellers Portal
                </p>
            </div>
        </div>
    )
}
