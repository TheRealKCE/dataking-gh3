import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
)

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('admin_settings')
            .select('*')
            .in('key', [
                'page_access_dashboard',
                'page_access_data_packages',
                'page_access_orders',
                'page_access_wallet',
                'page_access_complaints',
                'page_access_notifications',
                'page_access_profile',
                'page_access_shop',
                'page_access_storefront',
                'page_access_airtime'
            ])

        if (error) {
            console.error('Error fetching page access settings:', error)
            return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
        }

        const settingsMap = data.reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value
            return acc
        }, {})

        return NextResponse.json(settingsMap)
    } catch (error) {
        console.error('Error in page-access API:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
