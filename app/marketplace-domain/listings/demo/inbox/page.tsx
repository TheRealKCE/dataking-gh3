import type { Metadata } from 'next'
import { SellerCallBackInbox } from '@/components/marketplace/listing-detail/contact'

export const metadata: Metadata = {
    title: 'Call Back Requests | Arhms Marketplace',
}

// Seller-side inbox demo. Shares the same in-memory mock store as the listing
// page, so a call-back you submit as a buyer at /marketplace-domain/listings/demo
// shows up here on reload. Wire GET /call-back-requests?sellerId= for real data.
export default function SellerCallBackInboxDemoPage() {
    return (
        <div className="min-h-screen bg-[#F5F7FA]">
            <div className="mx-auto max-w-2xl px-3 py-6 sm:px-4">
                <h1 className="mb-4 text-lg font-bold text-gray-900">Seller Dashboard</h1>
                <SellerCallBackInbox sellerId="sel_kwasi_ben" />
            </div>
        </div>
    )
}
