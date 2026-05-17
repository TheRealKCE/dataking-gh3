'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { usePwa } from '@/hooks/use-pwa'
import { toast } from 'sonner'
import {
    Download, Share2, Fingerprint, Zap, WifiOff, Bell,
    CheckCircle2, ArrowLeft
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const FEATURES = [
    {
        icon: Fingerprint,
        color: 'bg-indigo-500',
        title: '6-Digit PIN Login',
        desc: 'Skip your email and password. Tap 6 digits to unlock.',
    },
    {
        icon: Zap,
        color: 'bg-amber-500',
        title: 'Lightning Fast',
        desc: 'Loads instantly from your device. Works even on slow networks.',
    },
    {
        icon: WifiOff,
        color: 'bg-emerald-500',
        title: 'Works Offline',
        desc: 'Browse packages and your history even without internet.',
    },
    {
        icon: Bell,
        color: 'bg-rose-500',
        title: 'Instant Notifications',
        desc: 'Get notified the moment your order is fulfilled.',
    },
]

export default function InstallAppPage() {
    const router = useRouter()
    const { isInstallable, isInstalled, isIOS, installPwa } = usePwa()
    const [installed, setInstalled] = useState(false)

    useEffect(() => {
        if (isInstalled) setInstalled(true)
    }, [isInstalled])

    const handleInstall = async () => {
        if (isIOS) {
            toast('Install on iOS', {
                description: 'Tap the Share button in Safari, then select "Add to Home Screen".',
                duration: 7000,
            })
            return
        }
        if (!isInstallable) {
            toast('Already available!', {
                description: 'Open your browser menu and tap "Install App" or "Add to Home Screen".',
                duration: 7000,
            })
            return
        }
        await installPwa()
        setInstalled(true)
    }

    return (
        <div className="min-h-screen bg-[#f0f4ff] dark:bg-gray-950 flex flex-col">
            {/* Header */}
            <div className="flex items-center px-4 pt-6 pb-2">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                    aria-label="Go back"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </button>
            </div>

            {/* Hero */}
            <div className="flex flex-col items-center text-center px-6 pt-6 pb-10">
                {/* App icon */}
                <div className="w-28 h-28 rounded-[2rem] overflow-hidden bg-white shadow-2xl shadow-black/20 flex items-center justify-center mb-6 border border-black/5">
                    <Image
                        src="/icon-512x512.png"
                        alt="App Icon"
                        width={112}
                        height={112}
                        className="w-full h-full object-contain"
                        priority
                    />
                </div>

                <h1 className="text-3xl font-black text-gray-900 dark:text-white leading-tight mb-3">
                    Get the ARHMS App
                </h1>
                <p className="text-base text-gray-500 dark:text-gray-400 max-w-xs leading-relaxed">
                    Install directly to your phone or computer.
                    No app store needed. Always free, always updated.
                </p>

                {/* CTA Button */}
                <div className="mt-8 w-full max-w-xs">
                    {installed ? (
                        <div className="flex items-center justify-center gap-2 py-4 px-6 rounded-2xl bg-emerald-500 text-white font-black text-base shadow-lg shadow-emerald-500/30">
                            <CheckCircle2 className="w-5 h-5" />
                            App Installed!
                        </div>
                    ) : (
                        <Button
                            onClick={handleInstall}
                            className="w-full py-7 rounded-2xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-black text-base flex items-center justify-center gap-3 shadow-xl shadow-blue-500/30 transition-all active:scale-95"
                        >
                            {isIOS ? (
                                <Share2 className="w-5 h-5" />
                            ) : (
                                <Download className="w-5 h-5" />
                            )}
                            {isIOS ? 'Add to Home Screen' : 'Install ARHMS'}
                        </Button>
                    )}
                </div>

                {isIOS && (
                    <p className="mt-4 text-xs text-gray-400 dark:text-gray-500 text-center max-w-xs leading-relaxed">
                        Tap <Share2 className="w-3.5 h-3.5 inline mx-0.5" /> <strong>Share</strong> in Safari, then <strong>Add to Home Screen</strong>.
                    </p>
                )}
            </div>

            {/* Why Install section */}
            <div className="flex-1 bg-white dark:bg-gray-900 rounded-t-[2rem] px-5 pt-8 pb-16 shadow-inner">
                <h2 className="text-xl font-black text-gray-900 dark:text-white text-center mb-6">
                    Why Install the App?
                </h2>

                <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
                    {FEATURES.map(({ icon: Icon, color, title, desc }) => (
                        <div
                            key={title}
                            className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm"
                        >
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color} shadow-md mb-3`}>
                                <Icon className="w-5 h-5 text-white" />
                            </div>
                            <p className="text-sm font-black text-gray-900 dark:text-white mb-1">{title}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
