import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
    const { data, error } = await supabase.from('system_announcements').select('*');
    console.log('System Announcements Data:', data);
    console.log('System Announcements Error:', error);

    const { data: settings, error: settingsError } = await supabase.from('public_admin_settings').select('*').in('key', ['announcement_enabled']);
    console.log('Settings Data:', settings);
    console.log('Settings Error:', settingsError);
}

run();
