const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kqnzmymnjdwfroiixkcy.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxbnpteW1uamR3ZnJvaWl4a2N5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTI1MDcxMCwiZXhwIjoyMDg2ODI2NzEwfQ.RtSvOj7a6l9lK3DqwI3HElVPy54FCfZaypyHwcyfpsA');

async function test() {
  console.log('Testing RPC assign_results_checker_vouchers...');
  const { data, error } = await supabase.rpc('assign_results_checker_vouchers', {
    p_type_id: '00000000-0000-0000-0000-000000000000',
    p_quantity: 1,
    p_order_id: '00000000-0000-0000-0000-000000000000'
  });
  if (error && error.message.includes('Could not find the function')) {
      console.log('RPC DOES NOT EXIST!');
  } else {
      console.log('RPC Exists! Error was:', error);
  }
  
  console.log('\nChecking inventory count...');
  const { data: inv, error: invErr } = await supabase.from('results_checker_inventory').select('*').limit(5);
  console.log('Inventory count:', inv ? inv.length : 0, invErr ? invErr : '');
}
test();
