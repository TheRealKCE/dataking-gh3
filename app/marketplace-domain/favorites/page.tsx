import { createRouteHandlerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export const metadata = {
    title: 'Favorites | Arhms Marketplace',
    description: 'Your favorite marketplace listings',
}

export default async function FavoritesPage() {
    const supabase = await createRouteHandlerClient()

    // Get current user
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login?redirect=/marketplace-domain/favorites')
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="container py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Favorites</h1>
                    <p className="text-muted-foreground">
                        Your saved listings
                    </p>
                </div>

                {/* Placeholder - Favorites feature in future milestone */}
                <Card className="p-8 text-center">
                    <p className="text-muted-foreground mb-4">
                        Favorites feature coming soon
                    </p>
                    <Button asChild>
                        <Link href="/marketplace-domain/browse">
                            Browse Listings
                        </Link>
                    </Button>
                </Card>
            </div>
        </div>
    )
}
