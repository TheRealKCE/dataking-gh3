/**
 * Test script for mNotify SMS Service
 * 
 * Run with: npx tsx scripts/test-sms.ts
 */

import { sendSMS } from '../lib/sms-service'

async function testSMS() {
    console.log('='.repeat(60))
    console.log('Starting mNotify SMS Test')
    console.log('='.repeat(60))
    console.log('')

    // Test with a sample phone number
    const testPhone = '0501234567' // Replace with a real test number
    const testMessage = 'Hello from ARHMS Data! This is a test message from your SMS service.'

    console.log('Test Configuration:')
    console.log('- Phone:', testPhone)
    console.log('- Message:', testMessage)
    console.log('')
    console.log('Sending SMS...')
    console.log('-'.repeat(60))

    const result = await sendSMS({
        recipient: testPhone,
        message: testMessage
    })

    console.log('-'.repeat(60))
    console.log('')
    console.log('📊 TEST RESULT:')
    console.log('- Success:', result.success)
    if (result.success) {
        console.log('- Message ID:', result.messageId)
        console.log('✅ SMS sent successfully!')
    } else {
        console.log('- Error:', result.error)
        console.log('❌ SMS failed to send')
    }
    console.log('')
    console.log('='.repeat(60))

    // Provide debugging tips if failed
    if (!result.success) {
        console.log('')
        console.log('🔍 DEBUGGING TIPS:')
        console.log('1. Check that MOOLRE_API_KEY is set in .env.local')
        console.log('2. Verify your Moolre account has SMS credits')
        console.log('3. Confirm that your sender ID is approved in Moolre')
        console.log('4. Check the detailed error logs above for API responses')
        console.log('5. Log into https://app.moolre.com to check your account status')
        console.log('')
    }
}

// Run the test
testSMS().catch(error => {
    console.error('Test script error:', error)
    process.exit(1)
})
