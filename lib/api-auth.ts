import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createHash } from 'crypto'
import { LRUCache } from 'lru-cache'
import { createServerClient } from '@/lib/supabase'
import { parseAllowedRoles } from '@/lib/role-parser'

export interface ApiAuthResult {
    userId: string
    apiKeyId: string
    userRole: string
    keyPrefix: string
    supabase: ReturnType<typeof createServerClient>
}

interface CachedAuth {
    apiKeyId: string
    userId: string
    userRole: string
    keyPrefix: string
}

// Skip bcrypt (~100ms) for the same key within 60 seconds
const validatedKeyCache = new LRUCache<string, CachedAuth>({
    max: 5_000,
    ttl: 60_000,
})

// Timing-safe dummy hash to prevent prefix enumeration
const DUMMY_HASH = bcrypt.hashSync('___not_a_real_api_key___', 10)

function fingerprintKey(fullKey: string): string {
    return createHash('sha256').update(fullKey).digest('hex')
}

/**
 * Validates the API key from the Authorization header.
 * Returns ApiAuthResult on success, NextResponse (error) on failure.
 *
 * Steps: extract key → cache hit → prefix lookup → status check →
 *        bcrypt verify → feature flag → role check → populate cache
 */
export async function validateApiKey(request: NextRequest): Promise<ApiAuthResult | NextResponse> {
    const supabase = createServerClient()

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.trim()) {
        return apiError(401, 'Missing Authorization header. Format: Authorization: <api_key>')
    }

    let fullKey = authHeader.trim()
    if (/^Bearer\s+/i.test(fullKey)) fullKey = fullKey.replace(/^Bearer\s+/i, '').trim()

    if (fullKey.length < 20) return apiError(401, 'Invalid API key format')

    // Cache hit — skip DB + bcrypt
    const fingerprint = fingerprintKey(fullKey)
    const cached = validatedKeyCache.get(fingerprint)
    if (cached) return { ...cached, supabase }

    const keyPrefix = fullKey.substring(0, 16)

    const { data: keyRow, error: keyError } = await (supabase
        .from('api_keys') as any)
        .select('id, user_id, key_hash, status')
        .eq('key_prefix', keyPrefix)
        .maybeSingle()

    if (keyError || !keyRow) {
        await bcrypt.compare(fullKey, DUMMY_HASH) // equalise timing
        return apiError(401, 'Invalid API key')
    }

    if (keyRow.status === 'pending') return apiError(403, 'API key pending admin approval')
    if (keyRow.status === 'revoked') return apiError(403, 'API key has been revoked')

    const isValid = await bcrypt.compare(fullKey, keyRow.key_hash)
    if (!isValid) return apiError(401, 'Invalid API key')

    // Feature toggle + role check
    const { data: settingsRows } = await (supabase
        .from('admin_settings') as any)
        .select('key, value')
        .in('key', ['api_feature_enabled', 'api_allowed_roles'])

    const settings: Record<string, any> = {}
    ;((settingsRows as any[]) || []).forEach((s: any) => { settings[s.key] = s.value })

    if (settings['api_feature_enabled'] === 'false' || settings['api_feature_enabled'] === false) {
        return apiError(503, 'Developer API is currently disabled')
    }

    const { data: userData } = await supabase
        .from('users')
        .select('role, status')
        .eq('id', keyRow.user_id)
        .single()

    if (!userData) return apiError(401, 'User account not found')

    const userRole = (userData as any).role as string
    const userStatus = (userData as any).status as string

    if (userStatus !== 'active') return apiError(403, 'Your account is suspended or inactive')

    const allowedRoles = parseAllowedRoles(settings['api_allowed_roles'])
    if (!allowedRoles.includes(userRole)) {
        return apiError(403, `API access requires agent status. Your current role: ${userRole}`)
    }

    // Cache valid auth for 60s
    validatedKeyCache.set(fingerprint, {
        apiKeyId: keyRow.id, userId: keyRow.user_id, userRole, keyPrefix,
    })

    // Fire-and-forget: update last_used_at
    ;(supabase.from('api_keys') as any)
        .update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', keyRow.id)
        .then(() => {}).catch(() => {})

    return { userId: keyRow.user_id, apiKeyId: keyRow.id, userRole, keyPrefix, supabase }
}

export function apiSuccess(data: any, meta?: Record<string, any>): NextResponse {
    return NextResponse.json({
        success: true,
        data,
        meta: { timestamp: new Date().toISOString(), version: 'v1', ...meta },
    })
}

export function apiError(code: number, message: string): NextResponse {
    return NextResponse.json(
        { success: false, error: { code, message } },
        { status: code }
    )
}

export function logApiRequest(params: {
    apiKeyId: string | null
    userId: string | null
    endpoint: string
    method: string
    statusCode: number
    responseTimeMs: number
    ip: string | null
    errorMessage?: string
}): void {
    const supabase = createServerClient()
    ;(supabase.from('api_logs') as any)
        .insert({
            api_key_id:       params.apiKeyId,
            user_id:          params.userId,
            endpoint:         params.endpoint,
            method:           params.method,
            status_code:      params.statusCode,
            response_time_ms: params.responseTimeMs,
            ip_address:       params.ip,
            error_message:    params.errorMessage || null,
        })
        .then(() => {}).catch((e: any) => console.error('[API Log]', e.message))
}

export function isApiError(result: ApiAuthResult | NextResponse): result is NextResponse {
    return result instanceof NextResponse
}

export function getClientIp(request: NextRequest): string | null {
    return (
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        request.headers.get('cf-connecting-ip') ||
        null
    )
}
