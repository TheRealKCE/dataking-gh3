import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
    Smartphone,
    Zap,
    Shield,
    Clock,
    ArrowRight,
    Wifi,
    CreditCard,
    CheckCircle2
} from 'lucide-react'

export default function HomePage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            {/* Navigation */}
            <nav className="fixed top-0 w-full z-50 bg-black/20 backdrop-blur-xl border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center space-x-2">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                <Wifi className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-xl font-bold text-white">GHData</span>
                        </div>
                        <div className="flex items-center space-x-4">
                            <Link href="/auth/login">
                                <Button variant="ghost" className="text-white hover:bg-white/10">
                                    Login
                                </Button>
                            </Link>
                            <Link href="/auth/signup">
                                <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                                    Get Started
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center">
                        <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-8">
                            <Zap className="w-4 h-4 text-yellow-400 mr-2" />
                            <span className="text-sm text-white/90">Instant Data Delivery</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
                            Buy Data & Airtime
                            <br />
                            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                                Instantly
                            </span>
                        </h1>
                        <p className="text-xl text-white/70 max-w-2xl mx-auto mb-10">
                            Purchase data packages for MTN, Telecel, AT-iShare, and AT-BigTime networks.
                            Fast, reliable, and affordable with automatic delivery.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link href="/auth/signup">
                                <Button size="xl" className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-lg px-8">
                                    Start Buying Now
                                    <ArrowRight className="ml-2 w-5 h-5" />
                                </Button>
                            </Link>
                            <Link href="/auth/login">
                                <Button size="xl" variant="outline" className="border-white/30 text-white hover:bg-white/10 text-lg px-8">
                                    Login to Dashboard
                                </Button>
                            </Link>
                        </div>
                    </div>

                    {/* Network Logos */}
                    <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
                        {[
                            { name: 'MTN', color: 'from-yellow-400 to-yellow-600', icon: '📱' },
                            { name: 'Telecel', color: 'from-red-500 to-red-700', icon: '📶' },
                            { name: 'AT-iShare', color: 'from-orange-400 to-red-500', icon: '💫' },
                            { name: 'AT-BigTime', color: 'from-orange-500 to-red-600', icon: '⚡' },
                        ].map((network) => (
                            <div
                                key={network.name}
                                className="group relative p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300 hover:scale-105"
                            >
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${network.color} flex items-center justify-center mb-4 text-2xl`}>
                                    {network.icon}
                                </div>
                                <h3 className="text-lg font-semibold text-white">{network.name}</h3>
                                <p className="text-sm text-white/60">Data & Airtime</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-20 px-4 sm:px-6 lg:px-8 bg-black/20">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            Why Choose GHData?
                        </h2>
                        <p className="text-white/60 max-w-xl mx-auto">
                            Experience the fastest and most reliable way to purchase mobile data in Ghana
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: Zap,
                                title: 'Instant Delivery',
                                description: 'Your data is delivered within seconds after purchase. No waiting, no delays.',
                                gradient: 'from-yellow-500 to-orange-500',
                            },
                            {
                                icon: Shield,
                                title: 'Secure Payments',
                                description: 'Pay securely with mobile money, bank cards, or wallet balance. Your money is safe.',
                                gradient: 'from-green-500 to-emerald-500',
                            },
                            {
                                icon: Clock,
                                title: '24/7 Available',
                                description: 'Buy data anytime, anywhere. Our platform is always available for you.',
                                gradient: 'from-blue-500 to-purple-500',
                            },
                        ].map((feature, index) => (
                            <div
                                key={index}
                                className="group p-8 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300"
                            >
                                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                                    <feature.icon className="w-7 h-7 text-white" />
                                </div>
                                <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
                                <p className="text-white/60">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="py-20 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            How It Works
                        </h2>
                        <p className="text-white/60 max-w-xl mx-auto">
                            Get started in three simple steps
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                step: '01',
                                title: 'Create Account',
                                description: 'Sign up with your email and phone number. Verification is quick and easy.',
                                icon: Smartphone,
                            },
                            {
                                step: '02',
                                title: 'Fund Your Wallet',
                                description: 'Add money to your wallet using mobile money, bank cards, or bank transfer.',
                                icon: CreditCard,
                            },
                            {
                                step: '03',
                                title: 'Buy Data',
                                description: 'Select a package, enter the phone number, and receive data instantly.',
                                icon: CheckCircle2,
                            },
                        ].map((item, index) => (
                            <div key={index} className="relative">
                                <div className="text-6xl font-bold text-white/5 absolute -top-4 left-0">
                                    {item.step}
                                </div>
                                <div className="relative z-10 pt-8">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4">
                                        <item.icon className="w-6 h-6 text-white" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-white mb-3">{item.title}</h3>
                                    <p className="text-white/60">{item.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 to-purple-600 p-12 text-center">
                        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.5))]" />
                        <div className="relative z-10">
                            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                                Ready to Get Started?
                            </h2>
                            <p className="text-white/80 max-w-xl mx-auto mb-8">
                                Join thousands of Ghanaians who trust GHData for their mobile data needs.
                            </p>
                            <Link href="/auth/signup">
                                <Button size="xl" className="bg-white text-purple-600 hover:bg-white/90 text-lg px-8">
                                    Create Free Account
                                    <ArrowRight className="ml-2 w-5 h-5" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-white/10">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row items-center justify-between">
                        <div className="flex items-center space-x-2 mb-4 md:mb-0">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                <Wifi className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-lg font-semibold text-white">GHData</span>
                        </div>
                        <p className="text-white/40 text-sm">
                            © 2026 GHData. All rights reserved.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    )
}
