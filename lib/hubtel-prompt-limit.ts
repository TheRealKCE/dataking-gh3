/**
 * Per-number cap on Hubtel payment prompts.
 *
 * Trust attaches to the number alone, so once a number is verified ANYONE who types
 * it reaches the Hubtel prompt without a code. This limiter is the only thing left
 * standing between a trusted number and a stream of unsolicited prompts — it must
 * be applied on the trusted path too, not just the first-time one.
 *
 * Unlike the OTP limiters (which log and continue on Redis trouble), this one fails
 * CLOSED. An open failure here means firing live payment prompts at someone's phone
 * with no ceiling, which is precisely what Hubtel's safeguard rules exist to prevent.
 */
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { normalizeMsisdn } from '@/lib/payment-otp'

const hubtelPromptLimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, '1 h'),
    prefix: 'rl:hubtel-prompt',
})

export interface PromptLimitResult {
    allowed: boolean
    error?: string
}

/**
 * Call immediately before every hubtelInitiatePayment. Returns allowed:false when
 * the number has already been prompted 5 times in the last hour, or when the limiter
 * itself cannot be reached.
 */
export async function checkHubtelPromptLimit(phone: string): Promise<PromptLimitResult> {
    const msisdn = normalizeMsisdn(phone)
    if (!msisdn) return { allowed: false, error: 'Invalid phone number.' }

    try {
        const { success } = await hubtelPromptLimit.limit(msisdn)
        if (!success) {
            return {
                allowed: false,
                error: 'Too many payment prompts have been sent to this number recently. Please wait a while and try again.',
            }
        }
        return { allowed: true }
    } catch (e) {
        console.error('[HubtelPromptLimit] limiter unreachable (denying):', e)
        return {
            allowed: false,
            error: 'Payments are temporarily unavailable. Please try again shortly.',
        }
    }
}
