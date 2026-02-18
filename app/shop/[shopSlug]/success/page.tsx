import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { createServerClient } from '@/lib/supabase'
import { CheckCircle2, ShoppingCart, ArrowLeft } from 'lucide-react'

interface Props {
    params: Promise<{ shopSlug: string }>
    searchParams: Promise<{ ref?: string }>
}

export const revalidate = 0 // Always fresh for success page

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { shopSlug } = await params
    return { title: `Order Confirmed — ${shopSlug}` }
}

export default async function ShopSuccessPage({ params, searchParams }: Props) {
    const { shopSlug } = await params
    const { ref } = await searchParams

    const supabase = createServerClient()

    // Fetch shop branding
    const { data: shop } = await (supabase
        .from('shop_profiles')
        .select('shop_name, logo_url, brand_color, whatsapp_number')
        .eq('shop_slug', shopSlug)
        .single() as any)

    // Fetch order details
    let order: any = null
    if (ref) {
        const { data } = await (supabase
            .from('shop_orders')
            .select('guest_phone, network, package_size, selling_price, status')
            .eq('paystack_reference', ref)
            .single() as any)
        order = data
    }

    const brandColor = shop?.brand_color || '#059669'

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
            {/* Header */}
            <div className="py-6 px-4" style={{ backgroundColor: brandColor }}>
                <div className="max-w-md mx-auto flex items-center gap-3">
                    {shop?.logo_url && (
                        <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-white/20">
                            <Image src={shop.logo_url} alt={shop.shop_name || ''} fill className="object-contain" />
                        </div>
                    )}
                    <h1 className="text-white font-bold">{shop?.shop_name || shopSlug}</h1>
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center px-4 py-12">
                <div className="max-w-md w-full text-center space-y-6">
                    {/* Success icon */}
                    <div className="flex justify-center">
                        <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg" style={{ backgroundColor: brandColor }}>
                            <CheckCircle2 className="w-10 h-10 text-white" />
                        </div>
                    </div>

                    <div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white">Payment Successful!</h2>
                        <p className="text-muted-foreground mt-2 text-sm">
                            Your data bundle is being processed and will be delivered shortly.
                        </p>
                    </div>

                    {/* Order summary */}
                    {order && (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 text-left space-y-3">
                            <h3 className="font-bold text-sm text-gray-900 dark:text-white">Order Summary</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Package</span>
                                    <span className="font-semibold">{order.network} {order.package_size}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Recipient</span>
                                    <span className="font-mono font-semibold">{order.guest_phone}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Amount Paid</span>
                                    <span className="font-bold" style={{ color: brandColor }}>
                                        GHS {parseFloat(order.selling_price).toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Status</span>
                                    <span className="text-blue-600 font-semibold capitalize">{order.status}</span>
                                </div>
                                {ref && (
                                    <div className="flex justify-between pt-2 border-t">
                                        <span className="text-muted-foreground text-xs">Reference</span>
                                        <span className="font-mono text-xs text-gray-500">{ref}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                        Data bundles are usually delivered within a few minutes. If you experience any issues, contact the shop owner.
                    </p>

                    {/* Actions */}
                    <div className="flex flex-col gap-3">
                        <Link
                            href={`/shop/${shopSlug}`}
                            className="flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold transition-all hover:opacity-90"
                            style={{ backgroundColor: brandColor }}
                        >
                            <ShoppingCart className="w-4 h-4" />
                            Buy More Data
                        </Link>

                        {shop?.whatsapp_number && (
                            <a
                                href={`https://wa.me/${shop.whatsapp_number}?text=Hi! I just bought data from your shop. Reference: ${ref || ''}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#25D366] text-white font-bold transition-all hover:opacity-90"
                            >
                                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.88 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                                Contact Shop on WhatsApp
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
