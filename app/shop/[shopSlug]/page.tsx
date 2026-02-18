import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase'
import ShopStorefront from './ShopStorefront'

interface Props {
    params: Promise<{ shopSlug: string }>
}

// ISR: revalidate every 10 minutes
export const revalidate = 600

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { shopSlug } = await params
    const supabase = createServerClient()

    const { data: shop } = await (supabase
        .from('shop_profiles')
        .select('shop_name, description, logo_url')
        .eq('shop_slug', shopSlug)
        .eq('approval_status', 'approved')
        .eq('is_active', true)
        .single() as any)

    if (!shop) {
        return { title: 'Shop Not Found' }
    }

    return {
        title: shop.shop_name,
        description: shop.description || `Buy affordable data bundles from ${shop.shop_name}`,
        openGraph: {
            title: shop.shop_name,
            description: shop.description || `Buy affordable data bundles from ${shop.shop_name}`,
            images: shop.logo_url ? [{ url: shop.logo_url }] : [],
        },
    }
}

export default async function ShopPage({ params }: Props) {
    const { shopSlug } = await params
    const supabase = createServerClient()

    // Fetch shop (must be approved and active)
    const { data: shop } = await (supabase
        .from('shop_profiles')
        .select('id, shop_name, shop_slug, description, owner_phone, owner_email, whatsapp_number, logo_url, brand_color, brand_accent, approval_status, is_active')
        .eq('shop_slug', shopSlug)
        .single() as any)

    if (!shop || shop.approval_status !== 'approved' || !shop.is_active) {
        notFound()
    }

    // Fetch packages with shop pricing
    const { data: pricingRows } = await (supabase
        .from('shop_pricing')
        .select('package_id, selling_price, data_packages(id, network, size, is_available)')
        .eq('shop_id', shop.id) as any)

    const packages = (pricingRows || [])
        .filter((row: any) => row.data_packages?.is_available)
        .map((row: any) => ({
            id: row.data_packages.id,
            network: row.data_packages.network,
            size: row.data_packages.size,
            selling_price: parseFloat(row.selling_price),
        }))
        .sort((a: any, b: any) => a.network.localeCompare(b.network) || a.selling_price - b.selling_price)

    return <ShopStorefront shop={shop} packages={packages} />
}
