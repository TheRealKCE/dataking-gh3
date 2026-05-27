/* eslint-disable */
import fs from 'fs'
import path from 'path'
import dns from 'dns'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

// 1. Load env variables manually from .env.local
const envPath = path.resolve(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const env = {}
envContent.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const index = trimmed.indexOf('=')
    if (index === -1) return
    const key = trimmed.substring(0, index).trim()
    const value = trimmed.substring(index + 1).trim()
    env[key] = value.replace(/^['"]|['"]$/g, '') // strip quotes
})

console.log('--- ARHMS Web Push Diagnostic Tool ---')
console.log('Environment loaded from .env.local:')
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY: ${env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? 'Present (length: ' + env.NEXT_PUBLIC_VAPID_PUBLIC_KEY.length + ')' : 'MISSING'}`)
console.log(`VAPID_PRIVATE_KEY: ${env.VAPID_PRIVATE_KEY ? 'Present (length: ' + env.VAPID_PRIVATE_KEY.length + ')' : 'MISSING'}`)
console.log(`VAPID_SUBJECT: ${env.VAPID_SUBJECT || 'MISSING'}`)
console.log(`SUPABASE_URL: ${env.NEXT_PUBLIC_SUPABASE_URL || 'MISSING'}`)
console.log(`SUPABASE_SERVICE_ROLE_KEY: ${env.SUPABASE_SERVICE_ROLE_KEY ? 'Present' : 'MISSING'}`)
console.log('')

// 2. Validate VAPID key pair
try {
    console.log('1. Validating VAPID keys...')
    if (!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
        throw new Error('VAPID env variables are incomplete.')
    }
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY)
    console.log('   [SUCCESS] VAPID configuration is valid and accepted by web-push.')
} catch (error) {
    console.error('   [ERROR] VAPID Validation Failed:', error.message)
}

// 3. Connect to Supabase & check tables
async function checkSupabase() {
    console.log('\n2. Connecting to Supabase...')
    if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        console.log('   [SKIP] Supabase env variables missing.')
        return
    }

    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

    try {
        console.log('   Checking "push_subscriptions" table...')
        const { data: subs, count, error: subError } = await supabase
            .from('push_subscriptions')
            .select('*', { count: 'exact' })

        if (subError) {
            console.error('   [ERROR] Could not query "push_subscriptions" table:', subError.message)
            if (subError.code === '42P01') {
                console.log('   [SUGGESTION] The table "push_subscriptions" does not exist. You must run the SQL in supabase/push_subscriptions.sql.')
            }
        } else {
            console.log(`   [SUCCESS] "push_subscriptions" table exists! Found ${count} registered subscription(s).`)
            if (subs && subs.length > 0) {
                console.log('   Registered subscriptions details:')
                subs.forEach((sub, i) => {
                    console.log(`     Subscription #${i + 1}:`)
                    console.log(`       ID: ${sub.id}`)
                    console.log(`       User ID: ${sub.user_id}`)
                    console.log(`       Endpoint domain: ${new URL(sub.endpoint).hostname}`)
                    console.log(`       Auth length: ${sub.auth?.length}`)
                    console.log(`       P256dh length: ${sub.p256dh?.length}`)
                })
            } else {
                console.log('   [INFO] No users have subscribed to web push notifications yet.')
            }
        }

        console.log('   Checking "notifications" table...')
        const { count: notifCount, error: notifError } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })

        if (notifError) {
            console.error('   [ERROR] Could not query "notifications" table:', notifError.message)
        } else {
            console.log(`   [SUCCESS] "notifications" table exists! Total notifications logged: ${notifCount}`)
        }
    } catch (err) {
        console.error('   [ERROR] Unexpected error connecting to Supabase:', err.message)
    }
}

// 4. Verify Service Worker and builds
function checkServiceWorker() {
    console.log('\n3. Verifying Service Worker files...')
    const workerSourcePath = path.resolve(process.cwd(), 'worker', 'index.js')
    const publicPath = path.resolve(process.cwd(), 'public')

    if (fs.existsSync(workerSourcePath)) {
        console.log('   [SUCCESS] Service Worker source file exists at worker/index.js')
        const content = fs.readFileSync(workerSourcePath, 'utf8')
        if (content.includes("self.addEventListener('push'") && content.includes("self.addEventListener('notificationclick'")) {
            console.log('   [SUCCESS] worker/index.js contains both "push" and "notificationclick" event listeners.')
        } else {
            console.warn('   [WARNING] worker/index.js might be missing standard service worker listeners.')
        }
    } else {
        console.error('   [ERROR] Service Worker source file is missing at worker/index.js!')
    }

    if (fs.existsSync(publicPath)) {
        const files = fs.readdirSync(publicPath)
        const swFiles = files.filter(f => f.startsWith('worker-') && f.endsWith('.js'))
        const sweFiles = files.filter(f => f.startsWith('swe-worker-') && f.endsWith('.js'))
        const manifest = files.includes('manifest.json')

        console.log(`   [INFO] Files in public/ directory:`)
        console.log(`     Compiled worker files: ${swFiles.join(', ') || 'None found (need build)'}`)
        console.log(`     Compiled SWE worker files: ${sweFiles.join(', ') || 'None found (need build)'}`)
        console.log(`     Web Manifest (manifest.json) exists: ${manifest ? 'YES' : 'NO'}`)

        if (swFiles.length === 0) {
            console.log('   [NOTE] If no compiled worker files exist, they will be generated automatically when running "npm run build".')
        }
    } else {
        console.error('   [ERROR] public/ directory is missing!')
    }
}

async function run() {
    await checkSupabase()
    checkServiceWorker()
    console.log('\n---------------------------------------')
    console.log('Diagnostics Completed.')
}

run()
