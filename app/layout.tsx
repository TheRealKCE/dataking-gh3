import type { Metadata, Viewport } from 'next'

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: '#0f172a',
    interactiveWidget: 'resizes-content', // Helps with virtual keyboard handling
}
import { Fira_Sans } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/auth-context'
import { Toaster } from '@/components/ui/sonner'

const firaSans = Fira_Sans({
    weight: ['300', '400', '500', '600', '700'],
    subsets: ['latin'],
    display: 'swap'
})

export const metadata: Metadata = {
    title: 'KING FLEXY DATA LTD - Mobile Data & Airtime Platform',
    description: 'Purchase data packages for MTN, Telecel, and AirtelTigo networks in Ghana. Fast, reliable, and affordable.',
    keywords: ['Ghana', 'mobile data', 'airtime', 'MTN', 'Telecel', 'AirtelTigo', 'data bundles'],
    authors: [{ name: 'KING FLEXY DATA LTD' }],
    openGraph: {
        title: 'KING FLEXY DATA LTD - Mobile Data & Airtime Platform',
        description: 'Purchase data packages for all Ghanaian networks',
        type: 'website',
    },
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={firaSans.className}>
                <AuthProvider>
                    {children}
                    <Toaster position="top-right" richColors />
                </AuthProvider>
            </body>
        </html>
    )
}
