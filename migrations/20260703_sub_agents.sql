-- Migration: Sub-Agents (Storefront Network) Schema
-- Date: 2026-07-03
-- Description: Implement the sub-agents (affiliate/reseller network) system
--   - Sub-Agents: users who register under a Lead, buy data at wholesale sub_price
--   - Two modes: wallet mode (personal purchases) + storefront mode (customer-facing retail)
--   - Withdrawal chain: sub → Lead approval → admin payout, with 48h escalation
--   - De-branded portal for subs

-- ============================================================
-- 1. Invite Codes Table (must be created first for FK dependencies)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shop_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES public.shop_profiles(id) ON DELETE CASCADE,
  code        TEXT NOT NULL UNIQUE,
  max_uses    INT,  -- NULL = unlimited
  used_count  INT NOT NULL DEFAULT 0,
  expires_at  TIMESTAMP WITH TIME ZONE,
  revoked_at  TIMESTAMP WITH TIME ZONE,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for invite lookups
CREATE INDEX IF NOT EXISTS idx_shop_invites_shop ON public.shop_invites(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_invites_code ON public.shop_invites(code);

-- ============================================================
-- 2. Sub-Agents Membership Table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sub_agents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  upline_shop_id    UUID NOT NULL REFERENCES public.shop_profiles(id) ON DELETE RESTRICT,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'active', 'suspended')),
  markup_ceiling    NUMERIC(12, 2),  -- NULL = use platform default ceiling
  approved_by       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at       TIMESTAMP WITH TIME ZONE,
  joined_via_invite UUID REFERENCES public.shop_invites(id) ON DELETE SET NULL,
  created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for parent lookups (Lead sees all their subs)
CREATE INDEX IF NOT EXISTS idx_sub_agents_upline ON public.sub_agents(upline_shop_id);

-- ============================================================
-- 3. Alter shop_pricing: Add wholesale sub_price
-- ============================================================
ALTER TABLE public.shop_pricing
ADD COLUMN IF NOT EXISTS sub_price NUMERIC(12, 2);
-- Invariant: sub_price >= owner_cost + min_sub_margin (enforced at write time)

-- ============================================================
-- 4. Alter shop_orders: Add sub attribution
-- ============================================================
ALTER TABLE public.shop_orders
ADD COLUMN IF NOT EXISTS owner_role_at_time TEXT,
ADD COLUMN IF NOT EXISTS admin_cost_at_time NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS parent_shop_id UUID REFERENCES public.shop_profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS parent_profit NUMERIC(12, 2);

-- Index for parent shop order lookup (Lead sees all sub orders)
CREATE INDEX IF NOT EXISTS idx_shop_orders_parent_shop ON public.shop_orders(parent_shop_id);

-- ============================================================
-- 5. Alter shop_wallet_transactions: Add withdrawal approval chain
-- ============================================================
-- Extend the status CHECK to include 'shop_owner_pending' (pre-state for sub withdrawals)
ALTER TABLE public.shop_wallet_transactions
DROP CONSTRAINT IF EXISTS shop_wallet_transactions_status_check;

ALTER TABLE public.shop_wallet_transactions
ADD CONSTRAINT shop_wallet_transactions_status_check
  CHECK (status IN ('completed', 'pending', 'rejected', 'shop_owner_pending')),
ADD COLUMN IF NOT EXISTS sub_approval_status TEXT NOT NULL DEFAULT 'not_required'
  CHECK (sub_approval_status IN ('not_required', 'pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS sub_approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS sub_approval_note TEXT,
ADD COLUMN IF NOT EXISTS escalate_after TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_escalated BOOLEAN NOT NULL DEFAULT FALSE;

-- Indexes for escalation cron and Lead approvals
CREATE INDEX IF NOT EXISTS idx_shop_wallet_transactions_escalate
  ON public.shop_wallet_transactions(status, escalate_after)
  WHERE status = 'shop_owner_pending' AND escalate_after IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shop_wallet_transactions_sub_approval
  ON public.shop_wallet_transactions(shop_wallet_id, sub_approval_status);

-- ============================================================
-- 6. Add global admin_settings for sub-agent configuration
-- ============================================================
INSERT INTO public.shop_global_settings (key, value)
VALUES
  ('sub_min_margin', '0.50'),
  ('sub_markup_ceiling_default', '5.00')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 7. Row Level Security (RLS)
-- ============================================================
ALTER TABLE public.sub_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_invites ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7a. sub_agents RLS Policies
-- ============================================================
-- A Lead (upline shop owner) can read all their sub_agents
CREATE POLICY "sub_agents_lead_read"
ON public.sub_agents
FOR SELECT
USING (
  upline_shop_id IN (
    SELECT id FROM public.shop_profiles WHERE owner_id = auth.uid()
  )
);

-- A Sub can read their own sub_agents row
CREATE POLICY "sub_agents_sub_read_own"
ON public.sub_agents
FOR SELECT
USING (user_id = auth.uid());

-- A Lead can update (approve/suspend) their subs
CREATE POLICY "sub_agents_lead_update"
ON public.sub_agents
FOR UPDATE
USING (
  upline_shop_id IN (
    SELECT id FROM public.shop_profiles WHERE owner_id = auth.uid()
  )
);

-- Admins can read/update all subs
CREATE POLICY "sub_agents_admin_all"
ON public.sub_agents
FOR ALL
USING (public.is_admin());

-- ============================================================
-- 7b. shop_invites RLS Policies
-- ============================================================
-- A Lead can manage invites for their shop
CREATE POLICY "shop_invites_lead_all"
ON public.shop_invites
FOR ALL
USING (
  shop_id IN (
    SELECT id FROM public.shop_profiles WHERE owner_id = auth.uid()
  )
);

-- Public read for valid invite codes (for signup portal)
-- Note: intentionally permissive; rate-limiting and max_uses enforced in application logic
CREATE POLICY "shop_invites_public_read_valid"
ON public.shop_invites
FOR SELECT
USING (
  revoked_at IS NULL
  AND (expires_at IS NULL OR expires_at > NOW())
  AND (max_uses IS NULL OR used_count < max_uses)
);

-- Admins can read all invites
CREATE POLICY "shop_invites_admin_all"
ON public.shop_invites
FOR ALL
USING (public.is_admin());

-- ============================================================
-- 7c. Updated shop_pricing RLS (add sub visibility)
-- ============================================================
-- A Sub can read the sub_price they buy at from their upline
-- (This extends the existing owner + public policies)
DROP POLICY IF EXISTS "shop_pricing_sub_read" ON public.shop_pricing;

CREATE POLICY "shop_pricing_sub_read"
ON public.shop_pricing
FOR SELECT
USING (
  -- Sub can read pricing from their upline shop
  shop_id IN (
    SELECT upline_shop_id FROM public.sub_agents WHERE user_id = auth.uid()
  )
);

-- ============================================================
-- 7d. Updated shop_orders RLS (add parent shop visibility)
-- ============================================================
-- A Lead can read orders from all their sub-agents
-- (This extends the existing owner policy)
DROP POLICY IF EXISTS "shop_orders_lead_sub_read" ON public.shop_orders;

CREATE POLICY "shop_orders_lead_sub_read"
ON public.shop_orders
FOR SELECT
USING (
  -- Lead can read orders from their subs
  parent_shop_id IN (
    SELECT id FROM public.shop_profiles WHERE owner_id = auth.uid()
  )
);

-- ============================================================
-- 7e. Updated shop_wallet_transactions RLS (add sub/Lead withdrawal visibility)
-- ============================================================
-- A Sub can read their own withdrawal transactions (not their Lead's)
-- Already covered by existing owner_read policy (reads wallet_id ownership)

-- A Lead can read withdrawal transactions from their subs
DROP POLICY IF EXISTS "shop_wallet_transactions_lead_sub_read" ON public.shop_wallet_transactions;

CREATE POLICY "shop_wallet_transactions_lead_sub_read"
ON public.shop_wallet_transactions
FOR SELECT
USING (
  -- Lead can read sub withdrawals (via shop_wallets → sub_agents lookup)
  shop_wallet_id IN (
    SELECT w.id FROM public.shop_wallets w
    JOIN public.sub_agents s ON w.owner_id = s.user_id
    WHERE s.upline_shop_id IN (
      SELECT id FROM public.shop_profiles WHERE owner_id = auth.uid()
    )
  )
);

-- A Lead can approve/reject (UPDATE) sub withdrawals
DROP POLICY IF EXISTS "shop_wallet_transactions_lead_sub_approve" ON public.shop_wallet_transactions;

CREATE POLICY "shop_wallet_transactions_lead_sub_approve"
ON public.shop_wallet_transactions
FOR UPDATE
USING (
  -- Lead can approve sub withdrawals
  shop_wallet_id IN (
    SELECT w.id FROM public.shop_wallets w
    JOIN public.sub_agents s ON w.owner_id = s.user_id
    WHERE s.upline_shop_id IN (
      SELECT id FROM public.shop_profiles WHERE owner_id = auth.uid()
    )
  )
);

-- ============================================================
-- End Migration
-- ============================================================
