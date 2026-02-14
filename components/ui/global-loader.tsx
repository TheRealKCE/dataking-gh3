"use client"

import { useEffect, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"

export function GlobalLoader() {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        // Trigger loading on route change
        const handleStart = () => setLoading(true)
        const handleComplete = () => setTimeout(() => setLoading(false), 800) // Minimum display time

        // Simple heuristic: set loading to true when path changes, then false after a delay
        // Since Next.js 13+ app directory changes are instant, we often simulate this for UX
        // or rely on Suspense. However, for a global "processing" feel requested:

        handleStart()
        handleComplete()

        return () => {
            setLoading(false)
        }
    }, [pathname, searchParams])

    if (!loading) return null

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity duration-300">
            <div className="flex flex-col items-center space-y-6">
                {/* Custom 4-Color Animation */}
                <div className="relative h-16 w-16 animate-spin">
                    <div className="absolute top-0 left-0 h-8 w-8 rounded-full bg-red-500 blur-sm opacity-75"></div>
                    <div className="absolute top-0 right-0 h-8 w-8 rounded-full bg-yellow-400 blur-sm opacity-75"></div>
                    <div className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-green-500 blur-sm opacity-75"></div>
                    <div className="absolute bottom-0 left-0 h-8 w-8 rounded-full bg-white blur-sm opacity-75"></div>
                </div>

                <div className="text-center space-y-2">
                    <h3 className="text-xl font-bold text-white tracking-wider animate-pulse">
                        Processing KingFlexyGh...
                    </h3>
                </div>
            </div>
        </div>
    )
}
