import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { AuthProvider } from '@/contexts/auth-context'
import { Toaster } from '@/components/ui/sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'GHData - Mobile Data & Airtime Platform',
    description: 'Purchase data packages for MTN, Telecel, and AirtelTigo networks in Ghana. Fast, reliable, and affordable.',
    keywords: ['Ghana', 'mobile data', 'airtime', 'MTN', 'Telecel', 'AirtelTigo', 'data bundles'],
    authors: [{ name: 'GHData' }],
    openGraph: {
        title: 'GHData - Mobile Data & Airtime Platform',
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
            <body className={inter.className}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
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
