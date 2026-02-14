
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function diagnose() {
    console.log('--- DIAGNOSING FULFILLMENT ---')

    try {
        // 1. Check admin_settings
        const { data: settings, error: sError } = await supabase
            .from('admin_settings')
            .select('*')

        if (sError) console.error('Error fetching settings:', sError)
        else console.log('Admin Settings:', JSON.stringify(settings, null, 2))

        // 2. Check recent orders
        const { data: orders, error: oError } = await supabase
            .from('orders')
            .select('id, network, size, status, created_at')
            .order('created_at', { ascending: false })
            .limit(10)

        if (oError) console.error('Error fetching orders:', oError)
        else console.log('Recent Orders:', JSON.stringify(orders, null, 2))

        // 3. Check tracking
        const { data: tracking, error: tError } = await supabase
            .from('mtn_fulfillment_tracking')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10)

        if (tError) console.error('Error fetching tracking:', tError)
        else console.log('Fulfillment Tracking:', JSON.stringify(tracking, null, 2))

        // 4. Check data_packages to see network names
        const { data: pkgs, error: pError } = await supabase
            .from('data_packages')
            .select('network, size, id')
            .limit(10)

        if (pError) console.error('Error fetching packages:', pError)
        else console.log('Data Packages Sample:', JSON.stringify(pkgs, null, 2))

    } catch (e) {
        console.error('Fatal error in diagnosis:', e)
    }
}

diagnose()
