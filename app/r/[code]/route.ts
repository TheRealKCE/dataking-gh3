import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /r/<code> — the shareable referral link.
 *
 * Deliberately sets NO cookie. It rewrites the pretty link into the `?ref=` form
 * and lets middleware.ts do the cookie work, so cookie-writing has exactly ONE
 * owner in the codebase.
 *
 * That matters here specifically: Vercel's edge can strip Set-Cookie from a
 * redirect response (see the meta-refresh workaround in app/auth/callback/route.ts),
 * and middleware redirects are the one place this app already relies on cookies
 * surviving. Keeping this handler cookie-free means there is no second thing to
 * get wrong.
 *
 * `/r/*` matches no guard block in middleware.ts, so it is publicly reachable
 * while anonymous — the same free pass /join/[code] has.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const clean = String(code || '').trim().toUpperCase()

  const target = new URL('/auth/signup', request.nextUrl.origin)
  if (/^[A-Z0-9]{5,24}$/.test(clean)) {
    target.searchParams.set('ref', clean)
  }

  return NextResponse.redirect(target, 307)
}
