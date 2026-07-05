import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

/**
 * Escalation Cron: Sweep sub withdrawals stuck in shop_owner_pending
 *
 * Triggers every hour (configure on cronjob.org).
 * Moves withdrawals to admin payout queue if:
 *   1. escalate_after < now() (48h window passed), OR
 *   2. The Lead is ineligible (role not agent/dealer, or expired)
 *
 * Transition:
 *   status: 'shop_owner_pending' → 'pending' (enters admin queue)
 *   auto_escalated: true (flags for admin extra verification)
 *
 * Security: Uses service_role client (bypasses RLS), validates time conditions.
 */

export async function GET(request: NextRequest) {
  // === Auth: Require valid cron secret ===
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET || process.env.UPSTASH_CRON_SECRET || ''

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[Escalate Cron] Unauthorized cron call')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase: any = createServerClient()
  const now = new Date()

  try {
    console.log(`[Escalate Cron] Starting escalation sweep at ${now.toISOString()}`)

    // 1. Find all shop_owner_pending withdrawals eligible for escalation
    const { data: pendingWithdrawals, error: fetchError } = await supabase
      .from('shop_wallet_transactions')
      .select(
        `
        id,
        shop_wallet_id,
        amount,
        status,
        escalate_after,
        shop_wallets(
          owner_id
        ),
        sub_agents:shop_wallets(
          sub_agents(
            upline_shop_id,
            sub_agents_upline:upline_shop_id(
              owner_id
            )
          )
        )
        `
      )
      .eq('status', 'shop_owner_pending')

    if (fetchError) {
      console.error('[Escalate Cron] Fetch error:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch withdrawals', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!pendingWithdrawals || pendingWithdrawals.length === 0) {
      console.log('[Escalate Cron] No pending withdrawals found')
      return NextResponse.json({
        success: true,
        escalatedCount: 0,
        message: 'No withdrawals to escalate',
      })
    }

    // 2. Process each withdrawal
    let escalatedCount = 0
    let errors: Array<{ withdrawalId: string; error: string }> = []

    for (const withdrawal of pendingWithdrawals) {
      try {
        // Determine if this withdrawal should escalate
        let shouldEscalate = false
        let reason = ''

        // Reason 1: 48h window passed
        if (withdrawal.escalate_after) {
          const escalateTime = new Date(withdrawal.escalate_after)
          if (escalateTime < now) {
            shouldEscalate = true
            reason = '48h window passed'
          }
        }

        // Reason 2: Lead is ineligible (only check if not already escalated due to time)
        if (!shouldEscalate) {
          // Get the sub's upline Lead
          const { data: subAgent } = await supabase
            .from('sub_agents')
            .select(`
              upline_shop_id,
              shop_profiles!upline_shop_id(
                owner_id,
                users!owner_id(
                  role,
                  agent_expires_at,
                  dealer_expires_at
                )
              )
            `)
            .eq('user_id', (withdrawal.shop_wallets as any)?.owner_id)
            .single()

          if (subAgent?.shop_profiles) {
            const leadUser = (subAgent.shop_profiles as any)?.users
            if (leadUser) {
              const leadRole = leadUser.role
              const agentExpiresAt = leadUser.agent_expires_at
              const dealerExpiresAt = leadUser.dealer_expires_at

              // Check eligibility: (role='agent' AND agent_expires_at IS NULL) OR (role='dealer' AND dealer_expires_at > now())
              const isEligible =
                (leadRole === 'agent' && !agentExpiresAt) ||
                (leadRole === 'dealer' && dealerExpiresAt && new Date(dealerExpiresAt) > now)

              if (!isEligible) {
                shouldEscalate = true
                reason = `Lead ineligible (role=${leadRole})`
              }
            }
          }
        }

        // 3. Escalate if conditions met
        if (shouldEscalate) {
          const { error: updateError } = await supabase
            .from('shop_wallet_transactions')
            .update({
              status: 'pending',
              auto_escalated: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', withdrawal.id)

          if (updateError) {
            console.error(
              `[Escalate Cron] Failed to escalate withdrawal ${withdrawal.id}:`,
              updateError
            )
            errors.push({
              withdrawalId: withdrawal.id,
              error: updateError.message,
            })
          } else {
            escalatedCount++
            console.log(
              `[Escalate Cron] Escalated withdrawal ${withdrawal.id} (reason: ${reason})`
            )
          }
        }
      } catch (err: any) {
        console.error(`[Escalate Cron] Unexpected error for withdrawal:`, err)
        errors.push({
          withdrawalId: withdrawal.id,
          error: err?.message || 'Unknown error',
        })
      }
    }

    console.log(
      `[Escalate Cron] Completed: escalated ${escalatedCount}/${pendingWithdrawals.length}, errors: ${errors.length}`
    )

    return NextResponse.json({
      success: true,
      escalatedCount,
      totalProcessed: pendingWithdrawals.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Escalated ${escalatedCount} withdrawals`,
    })
  } catch (err: any) {
    console.error('[Escalate Cron] Critical error:', err)
    return NextResponse.json(
      { error: 'Cron execution failed', details: err?.message },
      { status: 500 }
    )
  }
}
