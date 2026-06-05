import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MOOLRE_API_KEY = process.env.MOOLRE_API_KEY;
const MOOLRE_TRANSFER_API_USER = process.env.MOOLRE_TRANSFER_API_USER;
const MOOLRE_TRANSFER_API_KEY = process.env.MOOLRE_TRANSFER_API_KEY;
const phone = '0551617309';

async function test1() {
    console.log('Testing with Bearer token...');
    const res = await fetch('https://api.moolre.com/open/sms/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MOOLRE_API_KEY}`
        },
        body: JSON.stringify({
            recipient: phone,
            message: 'Test message',
            sender_id: 'ARHMS'
        })
    });
    console.log('Bearer status:', res.status, await res.text());
}

async function test2() {
    console.log('Testing with X-API headers (using Transfer keys)...');
    const res = await fetch('https://api.moolre.com/open/sms/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-USER': MOOLRE_TRANSFER_API_USER || '',
            'X-API-KEY': MOOLRE_TRANSFER_API_KEY || ''
        },
        body: JSON.stringify({
            recipient: phone,
            message: 'Test message',
            sender_id: 'ARHMS'
        })
    });
    console.log('X-API status:', res.status, await res.text());
}

async function run() {
    await test1();
    await test2();
}

run();
