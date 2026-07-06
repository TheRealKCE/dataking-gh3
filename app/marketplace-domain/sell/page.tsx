import { createRouteHandlerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { SellerOnboardingSheet } from '@/components/marketplace/seller-onboarding-sheet'
import { ListingWizard } from '@/components/marketplace/listing-wizard'
import { Card } from '@/components/ui/card'

async function getSellerProfile(userId: string) {
    try {
        const supabase = await createRouteHandlerClient()
        const { data, error } = await supabase
            .from('marketplace_seller_profiles')
            .select('*')
            .eq('user_id', userId)
            .single()

        if (error) return null
        return data
    } catch (error) {
        console.error('[Seller Profile] Error:', error)
        return null
    }
}

export const metadata = {
    title: 'Sell on Arhms Marketplace',
    description: 'Create a listing on Arhms Marketplace',
}

export default async function SellPage() {
    const supabase = await createRouteHandlerClient()

    // Get current user
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login?redirect=/marketplace-domain/sell')
    }

    // Check if seller profile exists
    const sellerProfile = await getSellerProfile(user.id)

    return (
        <div className="min-h-screen bg-background">
            <div className="container py-8">
                <div className="max-w-2xl">
                    <h1 className="text-3xl font-bold mb-2">Create a Listing</h1>
                    <p className="text-muted-foreground mb-8">
                        Fill in the details below to create your listing
                    </p>

                    {!sellerProfile ? (
                        <Card className="p-8">
                            <div className="text-center space-y-4">
                                <h2 className="text-xl font-semibold">
                                    Complete Your Seller Profile
                                </h2>
                                <p className="text-muted-foreground">
                                    We need some information to get you started as a seller
                                </p>
                                <SellerOnboardingSheet userId={user.id} />
                            </div>
                        </Card>
                    ) : (
                        <ListingWizard userId={user.id} />
                    )}
                </div>
            </div>
        </div>
    )
}
