export interface PublicConfigData {
    guestStorefrontUrl: string
    whatsappGroupLink: string
    whatsappChannelLink: string
    whatsappAdminNumber: string
    whatsappCommunityLink: string
    supportEmail: string
    footerCopyrightText: string
    footerBrandingText: string
}

export async function getPublicConfig(): Promise<PublicConfigData> {
    try {
        const baseUrl = typeof window === 'undefined' ? (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') : ''
        const response = await fetch(`${baseUrl}/api/public/config`, {
            cache: 'no-store'
        })

        if (!response.ok) {
            throw new Error('Failed to fetch public config')
        }

        return await response.json()
    } catch (error) {
        console.error('Error fetching public config:', error)
        // Return fallback data
        return {
            guestStorefrontUrl: 'https://arhmsgh.com/shop/demo',
            whatsappGroupLink: '',
            whatsappChannelLink: '',
            whatsappAdminNumber: '',
            whatsappCommunityLink: '',
            supportEmail: '',
            footerCopyrightText: '2025 ARHMS DATA LIMITED',
            footerBrandingText: 'ARHMS'
        }
    }
}
