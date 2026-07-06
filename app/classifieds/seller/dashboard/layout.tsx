import { ClassifiedsSellerMobileNav } from '@/components/classifieds/seller-mobile-nav'

// Scopes the mobile bottom tab bar to the seller dashboard pages only
// (My Listings, Post New, Get Verified) — the sidebar-less /seller/login page
// lives outside this segment and is unaffected.
export default function SellerDashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <>
            {children}
            <ClassifiedsSellerMobileNav />
        </>
    )
}
