// @ts-nocheck
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MOOLRE_API_KEY = process.env.MOOLRE_API_KEY;
const phone = '0551617309';

async function test1() {
    console.log('Testing with official Moolre SMS format...');
    const res = await fetch('https://api.moolre.com/open/sms/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-VASKEY': MOOLRE_API_KEY || ''
        },
        body: JSON.stringify({
            type: 1,
            senderid: 'ARHMS',
            messages: [
                {
                    recipient: phone,
                    message: 'Test message from ARHMS',
                    ref: `sms-${Date.now()}`
                }
            ]
        })
    });
    console.log('Official format status:', res.status, await res.text());
}

async function run() {
    await test1();
}

run();
