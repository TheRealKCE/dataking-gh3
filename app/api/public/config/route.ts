import { NextResponse } from 'next/server'
import { getCachedPublicConfig } from '@/lib/public-config'
import { PUBLIC_CONFIG_REVALIDATE_SECONDS } from '@/lib/cache-tags'

export async function GET() {
    try {
        const config = await getCachedPublicConfig()

        return NextResponse.json(config, {
            headers: {
                'Cache-Control': `public, s-maxage=${PUBLIC_CONFIG_REVALIDATE_SECONDS}, stale-while-revalidate=3600`,
            },
        })

    } catch (error: any) {
        console.error('Error in public config API:', error)
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
