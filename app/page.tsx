import { getPublicConfig } from '@/lib/public-config'
import dynamic from 'next/dynamic'

// Fix 4: Lazy-load the 44KB LandingClientShell so it's split into a separate
// JS chunk — prevents tab crashes on low-end phones with 512MB RAM
const LandingClientShell = dynamic(
    () => import('@/components/landing/LandingClientShell').then(m => ({ default: m.LandingClientShell })),
    { loading: () => null }
)

export default async function HomePage() {
    // Fetch public config server-side — serializable data only passed to client
    const config = await getPublicConfig()
    const guestUrl = config.guestStorefrontUrl
    const adminPhone = config.whatsappAdminNumber

    return (
        <LandingClientShell
            initialGuestUrl={guestUrl}
            initialAdminPhone={adminPhone}
            initialPlanPrices={config.upgradePrices}
            initialWhatsappGroupLink={config.whatsappGroupLink}
            initialWhatsappChannelLink={config.whatsappChannelLink}
        />
    )
}
