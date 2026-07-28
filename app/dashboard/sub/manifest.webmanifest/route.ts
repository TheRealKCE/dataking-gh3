import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import { resolveBrandContext } from '@/lib/brand-context'

/**
 * Installable PWA manifest for the sub-agent portal.
 *
 * Same-origin manifest fetches carry the session cookie, so we can resolve the
 * signed-in sub's brand (their Lead's shop) and hand back a shop-branded,
 * de-branded app scoped to /dashboard/sub. Falls back to a neutral portal
 * manifest when there's no session (e.g. a cold prefetch).
 */

const isValidHex = (c: string) => /^#([A-Fa-f0-9]{3}){1,4}$/.test(c)

function build(name: string, themeColor: string, logoUrl: string | null) {
  const icon =
    logoUrl && logoUrl.startsWith('http') ? logoUrl : '/icon-192x192.png'
  const shortName = name.length > 12 ? name.slice(0, 12).trim() + '…' : name
  return {
    name,
    short_name: shortName,
    description: `${name} — sub-agent portal`,
    start_url: '/dashboard/sub',
    scope: '/dashboard/sub',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: themeColor,
    background_color: themeColor,
    icons: [
      { src: icon, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: icon, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: icon, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    ],
  }
}

export async function GET() {
  const NEUTRAL = build('Sub-Agent Portal', '#1a6c78', null)
  try {
    const auth = await createRouteHandlerClient()
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json(NEUTRAL, { headers: { 'Content-Type': 'application/manifest+json' } })

    const db = createServerClient()
    const brand = await resolveBrandContext(user.id, db)
    const name = brand.shopName || brand.appName || 'Sub-Agent Portal'
    const theme = isValidHex(brand.brandColor || '') ? brand.brandColor : '#1a6c78'
    const manifest = build(name, theme, brand.logo)

    return NextResponse.json(manifest, {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch {
    return NextResponse.json(NEUTRAL, { headers: { 'Content-Type': 'application/manifest+json' } })
  }
}
