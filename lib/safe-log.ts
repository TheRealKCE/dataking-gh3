type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

const SENSITIVE_KEYS = [
    'phone',
    'phone_number',
    'beneficiary_phone',
    'recipient',
    'recipient_number',
    'wallet_balance',
    'balance',
    'api_key',
    'apikey',
    'token',
    'authorization',
    'secret',
    'password',
    'email',
    'user_id',
    'userid',
]

export function redactIdentifier(value: string | null | undefined) {
    if (!value) return value
    if (value.length <= 6) return '[redacted]'
    return `${value.slice(0, 3)}...${value.slice(-3)}`
}

export function sanitizeForLog<T>(value: T): JsonValue {
    if (value === null || value === undefined) return null
    if (typeof value === 'string') return value.length > 120 ? `${value.slice(0, 120)}...` : value
    if (typeof value === 'number' || typeof value === 'boolean') return value
    if (Array.isArray(value)) return value.map(item => sanitizeForLog(item))

    if (typeof value === 'object') {
        return Object.entries(value as Record<string, unknown>).reduce<Record<string, JsonValue>>((acc, [key, item]) => {
            const normalizedKey = key.toLowerCase()
            if (SENSITIVE_KEYS.some(sensitiveKey => normalizedKey.includes(sensitiveKey))) {
                acc[key] = '[redacted]'
                return acc
            }
            acc[key] = sanitizeForLog(item)
            return acc
        }, {})
    }

    return '[unserializable]'
}

