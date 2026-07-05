import { createRouteHandlerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { SellerOnboardingSheet } from '@/components/marketplace/seller-onboarding-sheet'
import { GetVerifiedDialog } from '@/components/marketplace/get-verified-dialog'

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
    title: 'Profile Settings | Arhms Marketplace',
    description: 'Manage your marketplace profile',
}

export default async function SettingsPage() {
    const supabase = await createRouteHandlerClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login?redirect=/marketplace-domain/settings')
    }

    const sellerProfile = await getSellerProfile(user.id)

    return (
        <div className="min-h-screen bg-background">
            <div className="container py-8 max-w-2xl">
                <h1 className="text-3xl font-bold mb-2">Profile Settings</h1>
                <p className="text-muted-foreground mb-8">
                    Manage your seller profile
                </p>

                {sellerProfile ? (
                    <Card className="p-6 space-y-4">
                        <div>
                            <label className="text-sm font-medium">Display Name</label>
                            <p className="text-lg mt-1">{sellerProfile.display_name || 'Not set'}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Region</label>
                            <p className="text-lg mt-1">{sellerProfile.region || 'Not set'}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium">City</label>
                            <p className="text-lg mt-1">{sellerProfile.city || 'Not set'}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium">WhatsApp Number</label>
                            <p className="text-lg mt-1">{sellerProfile.whatsapp_number || 'Not set'}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Verification Tier</label>
                            <p className="text-lg mt-1 capitalize">{sellerProfile.verification_tier || 'unverified'}</p>
                            {(!sellerProfile.verification_tier || sellerProfile.verification_tier === 'none') && (
                                <div className="mt-3">
                                    <GetVerifiedDialog
                                        sellerName={sellerProfile.display_name}
                                        sellerEmail={user.email}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="pt-4">
                            <SellerOnboardingSheet userId={user.id} isUpdate />
                        </div>
                    </Card>
                ) : (
                    <Card className="p-8 text-center">
                        <p className="text-muted-foreground mb-4">
                            You haven't set up your seller profile yet
                        </p>
                        <SellerOnboardingSheet userId={user.id} />
                    </Card>
                )}
            </div>
        </div>
    )
}
