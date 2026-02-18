import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkRPC() {
    // 1. Get a user with transactions
    const { data: users, error: userError } = await supabase
        .from('wallet_transactions')
        .select('user_id')
        .limit(1)

    if (userError || !users || users.length === 0) {
        console.error('Could not find a user with transactions', userError)
        return
    }

    const userId = users[0].user_id
    console.log('Testing with User ID:', userId)

    // 2. Get current wallet balance
    const { data: wallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .single()

    console.log('Current Wallet Balance:', wallet?.balance)

    // 3. Call the RPC
    const { data, error } = await supabase.rpc('get_user_transactions_with_balance', {
        p_user_id: userId,
        p_limit: 5,
        p_offset: 0,
        p_source_filter: 'all',
        p_type_filter: 'all',
        p_start_date: null,
        p_end_date: null
    })

    if (error) {
        console.error('RPC Error:', error)
    } else {
        console.log('RPC Data (first 2 rows):', data?.slice(0, 2))
    }
}

checkRPC()
