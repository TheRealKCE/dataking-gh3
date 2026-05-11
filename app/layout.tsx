import type { Metadata, Viewport } from 'next'

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    themeColor: '#0A0A0A',
    // interactiveWidget removed: only supported in Chrome 108+, causes viewport
    // layout issues on older Android WebView (common on low-end phones in Ghana)
}
import { Outfit, Inter } from 'next/font/google'
import { Suspense } from 'react'
import './globals.css'
import { AuthProvider } from '@/contexts/auth-context'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { GlobalLoader } from '@/components/ui/global-loader'
import PwaInstallPrompt from '@/components/pwa-install-prompt'

const outfit = Outfit({
    weight: ['400', '600', '700'],
    subsets: ['latin'],
    display: 'optional', // 'optional' prevents FOFT double-render on slow CPUs
    variable: '--font-heading',
})

const inter = Inter({
    weight: ['400', '500', '600'],
    subsets: ['latin'],
    display: 'optional', // 'optional' prevents FOFT double-render on slow CPUs
    variable: '--font-body',
})

export const metadata: Metadata = {
    title: 'ARHMS DATA LTD',
    description: "Ghana's trusted data bundle reselling platform. Buy and resell MTN, Telecel and AirtelTigo bundles instantly.",
    keywords: ['Ghana', 'mobile data', 'airtime', 'MTN', 'Telecel', 'AirtelTigo', 'data bundles', 'reseller'],
    authors: [{ name: 'ARHMS DATA LTD' }],
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'ARHMS',
    },
    icons: {
        apple: '/apple-touch-icon.png',
        icon: [
            { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
            { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
    },
    openGraph: {
        title: 'ARHMS DATA LTD',
        description: "Ghana's trusted data bundle reselling platform",
        type: 'website',
        images: ['/opengraph-image.png'],
    },
}

import { UIProvider } from '@/contexts/ui-context'

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" suppressHydrationWarning className={`${outfit.variable} ${inter.variable}`}>
            <body className={inter.className}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <AuthProvider>
                        <UIProvider>
                            <Suspense fallback={null}>
                                <GlobalLoader />
                            </Suspense>
                            {children}
                            <PwaInstallPrompt />
                            <Toaster position="top-right" richColors />
                        </UIProvider>
                    </AuthProvider>
                </ThemeProvider>
            </body>
        </html>
    )
}
