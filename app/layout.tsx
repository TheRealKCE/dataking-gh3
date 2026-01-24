import type { Metadata, Viewport } from 'next'

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    themeColor: '#0f172a',
}
import { Fira_Sans } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/providers/theme-provider'
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
                <ThemeProvider
                    attribute="class"
                    defaultTheme="light"
                    enableSystem
                    disableTransitionOnChange
                >
                    <AuthProvider>
                        {children}
                        <Toaster position="top-right" richColors />
                    </AuthProvider>
                </ThemeProvider>
            </body>
        </html>
    )
}
