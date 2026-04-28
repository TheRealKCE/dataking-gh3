import { NextResponse } from 'next/server'
import { getCachedPublicConfig } from '@/lib/public-config'
import { PUBLIC_CONFIG_REVALIDATE_SECONDS } from '@/lib/cache-tags'

export async function GET() {
    try {
        const config = await getCachedPublicConfig()

        return NextResponse.json(config.pageAccess, {
            headers: {
                'Cache-Control': `public, s-maxage=${PUBLIC_CONFIG_REVALIDATE_SECONDS}, stale-while-revalidate=3600`,
            },
        })
    } catch (error) {
        console.error('Error in page-access API:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
