const fs = require('fs')
const path = require('path')

const envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
const url = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim()
const key = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim()

async function run() {
    // We'll use the Supabase REST API to check what columns exist first
    const checkRes = await fetch(`${url}/rest/v1/results_checker_types?limit=0`, {
        headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json', Prefer: 'return=minimal' }
    })
    console.log('Table check status:', checkRes.status)

    // Use the management API to run the migration
    // Extract project ref from URL
    const projectRef = url.replace('https://', '').replace('.supabase.co', '')
    console.log('Project ref:', projectRef)

    const sql = `
ALTER TABLE results_checker_types
  ADD COLUMN IF NOT EXISTS bulk_quantity_threshold integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bulk_customer_price numeric(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bulk_agent_price numeric(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bulk_dealer_price numeric(10,2) DEFAULT NULL;
`
    console.log('SQL to run:\n', sql)
    console.log('\nPlease run this SQL in your Supabase Dashboard > SQL Editor.')
    console.log('URL: https://app.supabase.com/project/' + projectRef + '/sql/new')
}

run().catch(console.error)
