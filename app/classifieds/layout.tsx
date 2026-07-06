import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Classifieds - Buy & Sell Locally',
    description: 'Browse and post classifieds listings in your area',
}

export default function ClassifiedsLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1c]">
            {children}
        </div>
    )
}
