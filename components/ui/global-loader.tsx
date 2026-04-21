"use client"

import { useEffect, useState, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"

export function GlobalLoader() {
    const pathname = usePathname()
    const searchParams = useSearchParams()

    // Default to true for initial hard load
    const [loading, setLoading] = useState(true)

    // Ref to track if component has mounted (to avoid clashing logic)
    const isMounted = useRef(false)

    // 1. HARD REFRESH LOGIC (Window Load)
    useEffect(() => {
        const hideLoader = () => {
            // Small buffer ensures smooth transition after load fires
            setTimeout(() => setLoading(false), 500)
        }

        if (document.readyState === "complete") {
            hideLoader()
        } else {
            window.addEventListener("load", hideLoader)
            const safetyTimer = setTimeout(hideLoader, 5000) // 5s fallback

            return () => {
                window.removeEventListener("load", hideLoader)
                clearTimeout(safetyTimer)
            }
        }
    }, [])

    // 2. NAVIGATION LOGIC (Path Changes)
    useEffect(() => {
        // Skip the first run because the "Hard Refresh Logic" handles it
        // This prevents this effect from turning off the loader prematurely
        if (!isMounted.current) {
            isMounted.current = true
            return
        }

        // For subsequent navigations, show loader
        setLoading(true)

        // Hide after delay (Simulating "Page Load" feel for soft navigation)
        const timer = setTimeout(() => setLoading(false), 1000)

        return () => clearTimeout(timer)
    }, [pathname, searchParams])

    if (!loading) return null

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/60 backdrop-blur-md transition-opacity duration-500 animate-in fade-in">
            <div className="flex flex-col items-center space-y-8">
                {/* Multi-Color Circular Spinner (Yellow, Red, Blue, White) */}
                <div className="relative h-24 w-24">
                    <div className="absolute inset-0 rounded-full border-[6px] border-transparent border-t-yellow-400 border-r-red-600 border-b-blue-600 border-l-white animate-spin"></div>

                    {/* Inner Branding Dot */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-4 w-4 rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)] animate-pulse"></div>
                    </div>
                </div>

                <div className="text-center space-y-3">
                    <h3 className="text-lg font-medium text-white/90 tracking-[0.2em] uppercase animate-pulse">
                        ARHMS
                    </h3>
                    <p className="text-xs text-white/50 font-light">
                        Loading Experience...
                    </p>
                </div>
            </div>
        </div>
    )
}
