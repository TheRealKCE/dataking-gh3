export const VALID_API_ROLES = ['agent', 'customer', 'sub-admin', 'admin'] as const
export type ApiRole = typeof VALID_API_ROLES[number]

const VALID_SET: Set<string> = new Set(VALID_API_ROLES)

function normaliseLegacyRole(role: string): string {
    if (role === 'user') return 'customer'
    return role
}

export function parseAllowedRoles(raw: unknown, fallback: string[] = ['agent']): string[] {
    if (raw === null || raw === undefined || raw === '') return fallback

    let parsed: unknown = raw
    if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed) } catch { return fallback }
    }
    if (!Array.isArray(parsed)) return fallback

    const result: string[] = []
    for (const item of parsed) {
        if (typeof item !== 'string') continue
        if (item.startsWith('[') && item.endsWith(']')) {
            try {
                const inner = JSON.parse(item)
                if (Array.isArray(inner)) {
                    for (const sub of inner) {
                        if (typeof sub !== 'string') continue
                        const n = normaliseLegacyRole(sub)
                        if (VALID_SET.has(n)) result.push(n)
                    }
                    continue
                }
            } catch { /* fall through */ }
        }
        const n = normaliseLegacyRole(item)
        if (VALID_SET.has(n)) result.push(n)
    }

    if (result.length === 0) return fallback
    return Array.from(new Set(result))
}
