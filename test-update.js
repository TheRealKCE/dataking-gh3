const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
    const [key, val] = line.split('=')
    if (key && val) acc[key] = val.trim().replace(/^"|"$/g, '')
    return acc
}, {})
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

async function test() {
    const { data, error } = await supabase.from('orders').select('*').limit(1)
    if (error) return console.error(error)
    console.log('orders columns:', Object.keys(data[0] || {}))
}
test()
