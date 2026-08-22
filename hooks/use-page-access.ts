import { useEffect, useState } from 'react'

export interface PageAccessSettings {
    dashboard: boolean
    dataPackages: boolean
    orders: boolean
    wallet: boolean
    complaints: boolean
    notifications: boolean
    profile: boolean
    shop: boolean
    storefront: boolean
    airtime: boolean
    utilities: boolean
    /**
     * USSD master switch, not a page-access toggle — it rides here because this
     * hook is the single settings fetch every nav already makes.
     */
    ussd: boolean
}

const PAGE_ROUTE_MAP: Record<string, keyof PageAccessSettings> = {
    '/dashboard': 'dashboard',
    '/dashboard/data-packages': 'dataPackages',
    '/dashboard/my-orders': 'orders',
    '/dashboard/wallet': 'wallet',
    '/dashboard/complaints': 'complaints',
    '/dashboard/notifications': 'notifications',
    '/dashboard/profile': 'profile',
    '/dashboard/shop': 'shop',
    '/dashboard/shop/ussd': 'ussd',
    '/dashboard/sub/ussd': 'ussd',
    '/dashboard/airtime': 'airtime',
    '/dashboard/utilities': 'utilities',
}

export function usePageAccess() {
    const [pageAccess, setPageAccess] = useState<PageAccessSettings>({
        dashboard: true,
        dataPackages: true,
        orders: true,
        wallet: true,
        complaints: true,
        notifications: true,
        profile: true,
        shop: true,
        storefront: true,
        airtime: true,
        utilities: true,
        // The only flag that starts closed: the others default open so a slow
        // fetch does not blank the nav, but a USSD link shown for a second and
        // then withdrawn is worse than one that never appears.
        ussd: false,
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchPageAccess()
    }, [])

    const fetchPageAccess = async () => {
        try {
            const response = await fetch('/api/settings/page-access', { cache: 'no-store' })
            if (!response.ok) throw new Error('Failed to fetch settings')
            const settingsMap = await response.json()

            setPageAccess({
                dashboard: settingsMap.page_access_dashboard !== 'false',
                dataPackages: settingsMap.page_access_data_packages !== 'false',
                orders: settingsMap.page_access_orders !== 'false',
                wallet: settingsMap.page_access_wallet !== 'false',
                complaints: settingsMap.page_access_complaints !== 'false',
                notifications: settingsMap.page_access_notifications !== 'false',
                profile: settingsMap.page_access_profile !== 'false',
                shop: settingsMap.page_access_shop !== 'false',
                storefront: settingsMap.page_access_storefront !== 'false',
                airtime: settingsMap.page_access_airtime !== 'false',
                utilities: settingsMap.page_access_utilities !== 'false',
                ussd: settingsMap.ussd_enabled === 'true',
            })
        } catch (error) {
            console.error('Error fetching page access settings:', error)
            // On error, keep the defaults above: every page accessible, USSD off.
        } finally {
            setLoading(false)
        }
    }

    const isPageAccessible = (route: string): boolean => {
        // Exact matches first: /dashboard/shop/ussd has its own switch, and the
        // shop prefix below would otherwise swallow it.
        const exact = PAGE_ROUTE_MAP[route]
        if (exact) return pageAccess[exact]

        // Then prefixes, so /dashboard/shop/pricing follows the shop toggle.
        if (route.startsWith('/dashboard/shop')) {
            return pageAccess.shop
        }

        return true
    }

    return { pageAccess, isPageAccessible, loading }
}
