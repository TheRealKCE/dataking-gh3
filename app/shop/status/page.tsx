import { Metadata } from 'next'
import ShopStatusTracker from './ShopStatusTracker'

export const metadata: Metadata = {
    title: 'Track Order Status',
    description: 'Check the status of your data bundle order.',
}

export default function ShopStatusPage() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12">
            <ShopStatusTracker />
        </div>
    )
}
