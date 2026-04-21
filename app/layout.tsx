import type { Metadata, Viewport } from 'next'

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: '#0A0A0A',
    interactiveWidget: 'resizes-content',
}
import { Outfit, Inter } from 'next/font/google'
import { Suspense } from 'react'
import './globals.css'
import { AuthProvider } from '@/contexts/auth-context'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { GlobalLoader } from '@/components/ui/global-loader'

const outfit = Outfit({
    weight: ['400', '600', '700'],
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-heading',
})

const inter = Inter({
    weight: ['400', '500', '600'],
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-body',
})

export const metadata: Metadata = {
    title: 'ARHMS DATA LTD',
    description: "Ghana's trusted data bundle reselling platform. Buy and resell MTN, Telecel and AirtelTigo bundles instantly.",
    keywords: ['Ghana', 'mobile data', 'airtime', 'MTN', 'Telecel', 'AirtelTigo', 'data bundles', 'reseller'],
    authors: [{ name: 'ARHMS DATA LTD' }],
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
                    defaultTheme="dark"
                    enableSystem
                    disableTransitionOnChange
                >
                    <AuthProvider>
                        <UIProvider>
                            <Suspense fallback={null}>
                                <GlobalLoader />
                            </Suspense>
                            {children}
                            <Toaster position="top-right" richColors />
                        </UIProvider>
                    </AuthProvider>
                </ThemeProvider>
            </body>
        </html>
    )
}
