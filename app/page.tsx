import { getPublicConfig } from '@/lib/public-config'
import { LandingClientShell } from '@/components/landing/LandingClientShell'

export default async function HomePage() {
    // Fetch public config server-side — serializable data only passed to client
    const config = await getPublicConfig()
    const guestUrl = config.guestStorefrontUrl
    const adminPhone = config.whatsappAdminNumber

    return <LandingClientShell initialGuestUrl={guestUrl} initialAdminPhone={adminPhone} />
}
