'use client'

import { useEffect } from 'react'
import { RefreshCw } from 'lucide-react'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('[AppError]', error)
    }, [error])

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-6 text-center">
            <div className="space-y-6 max-w-md">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                    <RefreshCw className="w-8 h-8 text-destructive" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-2xl font-black tracking-tight">Something went wrong</h1>
                    <p className="text-muted-foreground text-sm font-medium">
                        A part of the page failed to load. This is usually caused by a slow connection.
                        Please tap the button below to try again.
                    </p>
                </div>
                <button
                    onClick={reset}
                    className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-black uppercase tracking-widest text-xs h-12 px-8 rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all"
                >
                    <RefreshCw className="w-4 h-4" />
                    Try Again
                </button>
            </div>
        </div>
    )
}
