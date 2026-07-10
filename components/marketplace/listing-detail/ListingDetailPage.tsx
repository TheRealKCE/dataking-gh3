'use client'

import { Phone, Loader2 } from 'lucide-react'
import { ImageGallery } from './ImageGallery'
import { ListingInfo } from './ListingInfo'
import { SpecsTable } from './SpecsTable'
import { PriceCard } from './PriceCard'
import { SellerCard } from './SellerCard'
import { SafetyTipsCard } from './SafetyTipsCard'
import { dummyListing, type Listing } from './types'
import {
    ListingContactProvider,
    ListingContactModals,
    ShowContactButton,
    RequestCallBackButton,
    ListingStatusActions,
    ListingUnavailableBanner,
    ChatButton,
    useListingContact,
    type ListingRef,
    type SellerContact,
} from './contact'
import { SavedItemsProvider, SaveButton, SaveLoginGateModal } from '../saved-items'

interface ListingDetailPageProps {
    /** Wire a real backend fetch here later; falls back to dummy data. */
    listing?: Listing
    /** Pre-authenticated buyer, if any (null = logged out → login gate). */
    initialUser?: Parameters<typeof ListingContactProvider>[0]['initialUser']
}

export function ListingDetailPage({ listing = dummyListing, initialUser }: ListingDetailPageProps) {
    const listingRef: ListingRef = {
        id: listing.id,
        title: listing.title,
        thumbnail: listing.images[0],
        price: listing.price,
    }
    const seller: SellerContact = {
        id: listing.seller.id,
        name: listing.seller.name,
        phone: listing.seller.phone,
        whatsappNumber: listing.seller.phone,
        allowCallBacks: true, // seller setting → toggle in seller settings
    }

    // In production SavedItemsProvider lives at the marketplace layout so the
    // feed, search and Saved screen share one saved set. Scoped here for the demo.
    return (
        <SavedItemsProvider initialUser={initialUser ? { id: initialUser.id, name: initialUser.name } : null}>
            <ListingContactProvider
                listing={listingRef}
                seller={seller}
                initialStatus={listing.status}
                initialUser={initialUser}
            >
                <ListingDetailBody listing={listing} />
                <ListingContactModals />
                <SaveLoginGateModal />
            </ListingContactProvider>
        </SavedItemsProvider>
    )
}

function ListingDetailBody({ listing }: { listing: Listing }) {
    return (
        <div className="min-h-screen bg-[#F5F7FA]">
            <div className="mx-auto max-w-6xl px-3 pb-28 pt-4 sm:px-4 lg:pb-8">
                {/* Inactive banner (unavailable / sold / under review) */}
                <div className="mb-4 empty:hidden">
                    <ListingUnavailableBanner />
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {/* Main column (gallery + details) */}
                    <div className="space-y-4 lg:col-span-2">
                        <ImageGallery
                            images={listing.images}
                            title={listing.title}
                            featured={listing.featured}
                            watermark="arhmsgh.com"
                            saveSlot={
                                <SaveButton
                                    listingId={listing.id}
                                    ownerId={listing.seller.id}
                                    placement="overlay"
                                    size="md"
                                />
                            }
                        />
                        <ListingInfo
                            listing={listing}
                            saveSlot={
                                <SaveButton
                                    listingId={listing.id}
                                    ownerId={listing.seller.id}
                                    placement="inline"
                                    size="md"
                                />
                            }
                        />
                        <SpecsTable specs={listing.specs} />
                    </div>

                    {/* Sidebar (stacks below on mobile) */}
                    <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
                        <PriceCard
                            price={listing.price}
                            currency={listing.currency}
                            negotiable={listing.negotiable}
                            action={<RequestCallBackButton />}
                        />
                        <SellerCard
                            seller={listing.seller}
                            contactButton={
                                <div className="flex items-start gap-2">
                                    <div className="flex-1">
                                        <ShowContactButton />
                                    </div>
                                    <ChatButton variant="icon" />
                                </div>
                            }
                            statusActions={<ListingStatusActions />}
                        />
                        <SafetyTipsCard />
                    </aside>
                </div>
            </div>

            {/* Sticky "Show Contact" bar — mobile only (sidebar covers desktop) */}
            <StickyContactBar />
        </div>
    )
}

function StickyContactBar() {
    const { revealed, revealing, revealContact, seller } = useListingContact()
    return (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white p-3 shadow-[0_-2px_10px_rgba(0,0,0,0.06)] lg:hidden">
            <button
                type="button"
                onClick={revealContact}
                disabled={revealing}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00A652] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#008f47] disabled:opacity-70"
            >
                {revealing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Phone className="h-4 w-4" />
                )}
                {revealed ? seller.phone : 'Show Contact'}
            </button>
        </div>
    )
}

export default ListingDetailPage
