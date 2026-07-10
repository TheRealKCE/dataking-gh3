import type { Metadata } from 'next'
import Link from 'next/link'
import { ListingDetailPage, dummyListing } from '@/components/marketplace/listing-detail'

export const metadata: Metadata = {
    title: `${dummyListing.title} | Arhms Marketplace`,
    description: dummyListing.description.slice(0, 160),
}

// Jiji/OLX-style listing detail prototype using dummy data.
// ?as=owner  → view as the listing owner (Mark unavailable / relist)
// otherwise  → view as a buyer (Show Contact, Request call back, Report Abuse)
// Swap `dummyListing` for a real fetch and pass the real signed-in user later.
export default function ListingDetailDemoPage({
    searchParams,
}: {
    searchParams: { as?: string }
}) {
    const asOwner = searchParams.as === 'owner'

    const ownerUser = {
        id: dummyListing.seller.id, // same id as the listing's seller ⇒ isOwner
        name: dummyListing.seller.name,
        phone: dummyListing.seller.phone,
    }

    return (
        <>
            <div className="bg-[#F5F7FA] px-4 pt-3 text-center text-xs text-gray-500">
                Viewing as{' '}
                <span className="font-semibold text-gray-700">
                    {asOwner ? 'Seller (owner)' : 'Buyer'}
                </span>{' '}
                ·{' '}
                <Link
                    href={asOwner ? '/marketplace-domain/listings/demo' : '/marketplace-domain/listings/demo?as=owner'}
                    className="font-semibold text-[#00A652] hover:underline"
                >
                    switch to {asOwner ? 'buyer' : 'seller'} view
                </Link>
            </div>
            <ListingDetailPage initialUser={asOwner ? ownerUser : null} />
        </>
    )
}
