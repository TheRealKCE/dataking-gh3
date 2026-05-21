const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('', '');

async function test() {
  console.log('Testing RPC...');
  const { data, error } = await supabase.rpc('assign_results_checker_vouchers', {
    p_type_id: '00000000-0000-0000-0000-000000000000',
    p_quantity: 1,
    p_order_id: '00000000-0000-0000-0000-000000000000'
  });
  console.log('Error:', error);
  
  console.log('Checking inventory...');
  const { data: inv, error: invErr } = await supabase.from('results_checker_inventory').select('*').limit(5);
  console.log('Inventory count:', inv ? inv.length : 0, invErr);
}
test();
