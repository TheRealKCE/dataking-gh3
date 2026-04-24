import { getCachedPricing } from '@/lib/pricing-cache'
import { LandingClientShell } from '@/components/landing/LandingClientShell'

export default async function HomePage() {
    // Fetch pricing server-side — serializable data only passed to client
    const pricing = await getCachedPricing().catch(() => null)
    const guestUrl = pricing?.guestStorefrontUrl ?? 'https://arhmsgh.com/shop/demo'
    const adminPhone = pricing?.whatsappAdminNumber ?? ''

    return <LandingClientShell initialGuestUrl={guestUrl} initialAdminPhone={adminPhone} />
}
