import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface PageAccessSettings {
    dashboard: boolean
    dataPackages: boolean
    orders: boolean
    wallet: boolean
    complaints: boolean
    notifications: boolean
    profile: boolean
}

const PAGE_ROUTE_MAP: Record<string, keyof PageAccessSettings> = {
    '/dashboard': 'dashboard',
    '/dashboard/data-packages': 'dataPackages',
    '/dashboard/my-orders': 'orders',
    '/dashboard/wallet': 'wallet',
    '/dashboard/complaints': 'complaints',
    '/dashboard/notifications': 'notifications',
    '/dashboard/profile': 'profile',
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
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchPageAccess()
    }, [])

    const fetchPageAccess = async () => {
        try {
            const { data, error } = await (supabase
                .from('admin_settings') as any)
                .select('*')
                .in('key', [
                    'page_access_dashboard',
                    'page_access_data_packages',
                    'page_access_orders',
                    'page_access_wallet',
                    'page_access_complaints',
                    'page_access_notifications',
                    'page_access_profile'
                ])

            if (error) throw error

            const settingsMap = data.reduce((acc: any, curr: any) => {
                acc[curr.key] = curr.value
                return acc
            }, {})

            setPageAccess({
                dashboard: settingsMap.page_access_dashboard !== 'false',
                dataPackages: settingsMap.page_access_data_packages !== 'false',
                orders: settingsMap.page_access_orders !== 'false',
                wallet: settingsMap.page_access_wallet !== 'false',
                complaints: settingsMap.page_access_complaints !== 'false',
                notifications: settingsMap.page_access_notifications !== 'false',
                profile: settingsMap.page_access_profile !== 'false',
            })
        } catch (error) {
            console.error('Error fetching page access settings:', error)
            // On error, default to all pages accessible
        } finally {
            setLoading(false)
        }
    }

    const isPageAccessible = (route: string): boolean => {
        const pageKey = PAGE_ROUTE_MAP[route]
        return pageKey ? pageAccess[pageKey] : true
    }

    return { pageAccess, isPageAccessible, loading }
}
