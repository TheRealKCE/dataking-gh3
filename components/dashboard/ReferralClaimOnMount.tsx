'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

/**
 * Backstop for referral attribution.
 *
 * Most signups claim their referral on the signup page or in the OAuth callback,
 * but two paths cannot:
 *
 *   * Email/password signup where confirmation is required — signUp() returns no
 *     session, so there is nobody to attribute until the user actually logs in.
 *   * Users who detour through /auth/phone-setup before ever reaching /dashboard.
 *
 * Mounted in the dashboard layout, this fires once per browser session if the
 * arhms_ref cookie is still present. The claim is idempotent
 * (referrals.referred_user_id is UNIQUE), so overlapping with the other paths is
 * harmless — and /api/referrals/claim clears the cookie once the outcome settles,
 * which is what stops this from running again.
 */
export function ReferralClaimOnMount() {
    const attempted = useRef(false)

    useEffect(() => {
        if (attempted.current) return

        const match = document.cookie.match(/(?:^|;\s*)arhms_ref=([^;]+)/)
        if (!match) return

        attempted.current = true

        // Survives remounts within the tab; the cookie itself handles the rest.
        const guard = 'arhms_ref_claimed'
        try {
            if (sessionStorage.getItem(guard)) return
            sessionStorage.setItem(guard, '1')
        } catch {
            // Private mode with storage disabled — the cookie clear still gates it.
        }

        fetch('/api/referrals/claim', { method: 'POST' })
            .then(r => (r.ok ? r.json() : null))
            .then(data => {
                // Only celebrate a genuinely new, clean attribution. A repeat claim
                // or a flagged one should say nothing at all.
                if (data?.success && !data.alreadyClaimed && !data.flagged && data.referrerName) {
                    toast.success(`You're connected to ${data.referrerName} — welcome!`)
                }
            })
            .catch(() => { /* silent: never interrupt the dashboard */ })
    }, [])

    return null
}
