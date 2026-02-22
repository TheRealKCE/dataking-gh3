import { Metadata } from 'next'
import { Suspense } from 'react'
import ShopStatusTracker from './ShopStatusTracker'
import { Loader2 } from 'lucide-react'

export const metadata: Metadata = {
    title: 'Track Order Status',
    description: 'Check the status of your data bundle order.',
}

function StatusLoading() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-sm text-muted-foreground animate-pulse font-medium">Loading tracker...</p>
        </div>
    )
}

export default function ShopStatusPage() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12">
            <Suspense fallback={<StatusLoading />}>
                <ShopStatusTracker />
            </Suspense>
        </div>
    )
}
