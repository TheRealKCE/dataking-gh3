import { createServerClient } from '@/lib/supabase'

// --- In-Memory Rate Limit Tracking ---
interface TimestampRecord {
    single: number[]
    bulk: number[]
}

const rateLimitMap = new Map<string, TimestampRecord>()
const flaggedPhones = new Set<string>()

const FRAUD_FAST_ORDER_COUNT = 5
const FRAUD_FAST_ORDER_WINDOW_MS = 60_000 // 1 minute

// --- 1. Rate Limiting ---
/**
 * @deprecated DO NOT USE in serverless (Vercel) environments.
 * State is per-process and not shared across lambda instances.
 * Use Upstash Ratelimit directly in the route handler instead.
 */
export function isRateLimited(userId: string, type: 'single' | 'bulk'): boolean {
    const now = Date.now()
    let record = rateLimitMap.get(userId)

    if (!record) {
        record = { single: [], bulk: [] }
    }

    if (type === 'single') {
        const windowMs = 10_000 // 10 seconds
        const maxRequests = 3
        record.single = record.single.filter(t => now - t < windowMs)

        if (record.single.length >= maxRequests) {
            rateLimitMap.set(userId, record)
            return true
        }
        record.single.push(now)
    } else if (type === 'bulk') {
        const windowMs = 5_000 // 5 seconds
        const maxRequests = 1
        record.bulk = record.bulk.filter(t => now - t < windowMs)

        if (record.bulk.length >= maxRequests) {
            rateLimitMap.set(userId, record)
            return true
        }
        record.bulk.push(now)
    }

    rateLimitMap.set(userId, record)

    // Memory cleanup: remove stale entries every 1000 users
    if (rateLimitMap.size > 1000) {
        for (const [key, val] of rateLimitMap) {
            if (val.single.length === 0 && val.bulk.length === 0) {
                rateLimitMap.delete(key)
            }
        }
    }

    return false
}

// --- 2. Fraud Detection ---
export async function checkFraudSignals(userId: string, phone: string, db: any): Promise<boolean> {
    try {
        const now = Date.now()

        // Signal 1: Fast Repeated Orders (In-Memory Check)
        // Check if this specific user has made 5+ attempts in the last 1 minute
        const record = rateLimitMap.get(userId)
        if (record) {
            const recentAttempts = record.single.filter(t => now - t < FRAUD_FAST_ORDER_WINDOW_MS).length
            if (recentAttempts >= FRAUD_FAST_ORDER_COUNT) {
                flaggedPhones.add(phone)
                await logSuspiciousActivity(userId, 'CREATE_ORDER', 'Too many attempts in 1 minute (Fast repeated orders)', db)
                return true
            }
        }

        // Signal 2: Repeated Failed Transactions (DB Check)
        // Check orders table for 5+ failed transactions in the last 10 minutes
        const tenMinutesAgo = new Date(now - 10 * 60 * 1000).toISOString()

        const { count, error } = await db
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'failed')
            .gte('created_at', tenMinutesAgo)

        if (error) {
            console.error('[Security] Failed to check fraud signals:', error)
            // Default to false on DB error so we don't accidentally block legitimate users during outages
            return false
        }

        if (count && count >= 5) {
            flaggedPhones.add(phone)
            await logSuspiciousActivity(userId, 'CREATE_ORDER', `Detected ${count} failed transactions within 10 minutes`, db)
            return true
        }

        return false
    } catch (error) {
        console.error('[Security] Exception strictly in checkFraudSignals:', error)
        return false
    }
}

// --- 3. Suspicious Activity Logging ---
export async function logSuspiciousActivity(userId: string, action: string, reason: string, db: any): Promise<void> {
    try {
        // Fire-and-forget insert
        await db.from('fraud_logs').insert({
            user_id: userId,
            action: action,
            reason: reason,
            timestamp: new Date().toISOString()
        })
        console.warn(`[Security] Logged suspicious activity for user ${userId}: ${reason}`)
    } catch (error) {
        console.error('[Security] Failed to log suspicious activity:', error)
    }
}
// --- 4. Lightweight Pre-Fulfillment Check ---
export function isPhoneFlagged(phone: string): boolean {
    return flaggedPhones.has(phone)
}
