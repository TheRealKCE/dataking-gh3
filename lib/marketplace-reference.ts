/**
 * Client-safe marketplace reference data (Ghana regions + cities).
 *
 * These helpers are imported by CLIENT components. They must NOT touch the
 * service-role Supabase client (that lives in lib/marketplace-queries.ts and
 * would crash in the browser). Instead they fetch the public
 * /api/marketplace/regions route, which runs the query server-side.
 *
 * Signatures match the old lib/marketplace-queries exports so client callers
 * only need to change their import path.
 */

import type { GhanaRegion, GhanaCity } from '@/lib/marketplace-types'

export async function getGhanaRegions(): Promise<GhanaRegion[]> {
    try {
        const res = await fetch('/api/marketplace/regions')
        if (!res.ok) return []
        return (await res.json()) as GhanaRegion[]
    } catch (err) {
        console.error('[marketplace-reference] getGhanaRegions error:', err)
        return []
    }
}

export async function getGhanaCities(regionId: string): Promise<GhanaCity[]> {
    if (!regionId) return []
    try {
        const res = await fetch(`/api/marketplace/regions?regionId=${encodeURIComponent(regionId)}`)
        if (!res.ok) return []
        return (await res.json()) as GhanaCity[]
    } catch (err) {
        console.error('[marketplace-reference] getGhanaCities error:', err)
        return []
    }
}
