
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function diagnose() {
    console.log('--- DIAGNOSING FULFILLMENT ---')

    // 1. Check admin_settings
    const { data: settings } = await supabase
        .from('admin_settings')
        .select('*')

    console.log('Admin Settings:', JSON.stringify(settings, null, 2))

    // 2. Check recent orders
    const { data: orders } = await supabase
        .from('orders')
        .select('id, network, size, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5)

    console.log('Recent Orders:', JSON.stringify(orders, null, 2))

    // 3. Check tracking
    const { data: tracking } = await supabase
        .from('mtn_fulfillment_tracking')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)

    console.log('Fulfillment Tracking:', JSON.stringify(tracking, null, 2))
}

diagnose()
