import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

let signupRateLimit: Ratelimit | null = null
try {
  signupRateLimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(3, '1 h'),
    prefix: 'rl:sub-signup',
  })
} catch (e) {
  console.error('[SubAgentSignup] Redis init failed:', e)
}

/** A Postgres/GoTrue error caused by the users.phone_number unique index. */
function isDuplicatePhoneError(message?: string | null): boolean {
  if (!message) return false
  const m = message.toLowerCase()
  return m.includes('users_phone_number_unique') || m.includes('duplicate key')
}

/** A GoTrue error raised when the email is already registered. */
function isEmailExistsError(message?: string | null): boolean {
  if (!message) return false
  const m = message.toLowerCase()
  return (
    m.includes('already been registered') ||
    m.includes('already registered') ||
    m.includes('email_exists') ||
    m.includes('user already exists')
  )
}

/**
 * POST /api/shop/sub-agents/signup
 *
 * Sub-agent signup:
 *   1. Validate invite code
 *   2. Create the Supabase Auth user via the admin API (email auto-confirmed).
 *      The `on_auth_user_created` trigger creates the public.users row from the
 *      metadata we pass (including phone_number), so we do NOT insert users here.
 *   3. Create the sub_agents row (status='pending', awaiting Lead approval).
 *      Idempotent: a returning user who already has a row gets their real status
 *      back instead of a hard error.
 *   4. Increment invite usage
 *
 * We use `auth.admin.createUser` (not `auth.signUp`): signUp on a service-role
 * client silently returns an existing/obfuscated user for a returning email —
 * no error — so the flow used to march on and die at the sub_agents insert.
 *
 * Rate-limited to 3 signups per hour per IP (prevent abuse)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = String(body.email || '').trim().toLowerCase()
    const { password, phone, inviteId, shopId } = body

    // Validation
    if (!email || !password || !phone || !inviteId || !shopId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    const cleanPhone = String(phone).replace(/\D/g, '')
    if (!/^0\d{9}$/.test(cleanPhone)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      )
    }

    // Rate limit by IP
    try {
      if (signupRateLimit) {
        const ip = request.headers.get('x-forwarded-for') || 'unknown'
        const { success } = await signupRateLimit.limit(`signup:${ip}`)
        if (!success) {
          return NextResponse.json(
            { error: 'Too many signup attempts. Try again later.' },
            { status: 429 }
          )
        }
      }
    } catch (rlErr) {
      console.warn('[SubAgentSignup] Rate limit check failed:', rlErr)
    }

    const supabase: any = createServerClient()

    // 1. Validate invite code
    const { data: invite, error: inviteError } = await supabase
      .from('shop_invites')
      .select('id, shop_id, max_uses, used_count, expires_at, revoked_at')
      .eq('id', inviteId)
      .single()

    if (inviteError || !invite) {
      return NextResponse.json(
        { error: 'Invalid invite code' },
        { status: 400 }
      )
    }

    const now = new Date()
    if (invite.revoked_at) {
      return NextResponse.json(
        { error: 'This invite has been revoked' },
        { status: 400 }
      )
    }

    if (invite.expires_at && new Date(invite.expires_at) < now) {
      return NextResponse.json(
        { error: 'This invite has expired' },
        { status: 400 }
      )
    }

    if (invite.max_uses && invite.used_count >= invite.max_uses) {
      return NextResponse.json(
        { error: 'This invite has reached its usage limit' },
        { status: 400 }
      )
    }

    // 2. Create (or resolve) the auth user. The `on_auth_user_created` trigger
    //    (supabase/triggers.sql -> handle_new_user) reads `phone_number` from the
    //    metadata below and inserts the public.users row for us — so there is no
    //    separate users insert here. email_confirm skips the confirmation email
    //    (approval is gated by the Lead, not email verification).
    let userId: string | null = null
    let createdNewAuthUser = false

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: '', last_name: '', phone_number: cleanPhone },
    })

    if (createErr || !created?.user) {
      const message = createErr?.message || ''

      // The phone belongs to a DIFFERENT account (trigger's NOT NULL UNIQUE fired).
      if (isDuplicatePhoneError(message)) {
        const { data: phoneOwner } = await supabase
          .from('users')
          .select('email')
          .eq('phone_number', cleanPhone)
          .maybeSingle()
        if (phoneOwner && phoneOwner.email !== email) {
          return NextResponse.json(
            { error: 'This phone number is already registered. Please log in instead.' },
            { status: 409 }
          )
        }
      }

      // Email already registered → resolve the existing account and continue
      // enrolling it as a sub-agent (idempotent retry of a half-finished signup).
      // They re-submitted the form with a password, so re-affirm it.
      if (isEmailExistsError(message)) {
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .maybeSingle()
        if (existing?.id) {
          userId = existing.id
          await supabase.auth.admin.updateUserById(userId, {
            password,
            email_confirm: true,
          })
        }
      }

      if (!userId) {
        console.error('[SubAgentSignup] createUser error:', message)
        return NextResponse.json(
          { error: 'Failed to create account' },
          { status: 500 }
        )
      }
    } else {
      userId = created.user.id
      createdNewAuthUser = true
    }

    // 3. Create the sub_agents row (status='pending', awaiting Lead approval).
    //    Idempotent: if one already exists (a prior attempt got this far), surface
    //    the real status instead of the confusing "Failed to create" error.
    const { data: existingSub } = await supabase
      .from('sub_agents')
      .select('id, status')
      .eq('user_id', userId)
      .maybeSingle()

    if (existingSub) {
      return NextResponse.json({
        success: true,
        alreadyRegistered: true,
        message:
          existingSub.status === 'active'
            ? 'Your account is already active. Please log in.'
            : 'You have already signed up. Your account is pending approval from your Lead.',
        userId,
        phone: cleanPhone,
      })
    }

    const { error: subCreateError } = await supabase
      .from('sub_agents')
      .insert({
        user_id: userId,
        upline_shop_id: shopId,
        status: 'pending',
        joined_via_invite: inviteId,
      })

    if (subCreateError) {
      console.error('[SubAgentSignup] Sub create error:', subCreateError)
      // Only roll back the account if THIS request created it — never delete a
      // pre-existing user. Deleting the auth user cascades to public.users.
      if (createdNewAuthUser) {
        await supabase.auth.admin.deleteUser(userId)
      }
      return NextResponse.json(
        { error: 'Failed to create sub-agent record' },
        { status: 500 }
      )
    }

    // 4. Increment invite usage
    await supabase
      .from('shop_invites')
      .update({ used_count: (invite.used_count || 0) + 1 })
      .eq('id', inviteId)

    return NextResponse.json({
      success: true,
      message: 'Account created. Pending approval from your Lead.',
      userId,
      phone: cleanPhone,
    })
  } catch (err: any) {
    console.error('[SubAgentSignup] Critical error:', err)
    return NextResponse.json(
      { error: 'Signup failed. Please try again.' },
      { status: 500 }
    )
  }
}
