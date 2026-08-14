-- ============================================================
-- Referral bonuses: any user gets a code, and earns on every data purchase
-- made by someone who signed up through it — forever.
--
-- WHY A TRIGGER ON public.orders, NOT A TS HELPER
--   Data orders reach 'completed' from ~8 places (cron/auto-complete, three
--   supplier sync crons, three admin fulfillment syncs, and the admin bulk
--   PATCH which completes many orders in ONE .update().in(...)). There is no
--   single finalizer the way airtime has lib/airtime-order-completion.ts, so a
--   TS helper would have to be remembered at 8 call sites and at every future
--   one. That is exactly how credit_lead_margin() (supabase/sub_agents_rpcs.sql)
--   ended up defined-but-never-called. trg_log_main_profit
--   (20260318_profit_dashboard_schema.sql:117) has fired on this exact
--   transition, on this exact table, reading this exact margin, since March.
--   We clone it.
--
-- WHY completion-time and not payment-time
--   The bonus is permanent, spendable, cash-equivalent. Orders fail routinely
--   (cron/auto-refulfill reverts to 'pending'; admin/orders/refund flips to
--   'failed'). Paying first and clawing back later is the wrong default.
--
-- ---------------------------------------------------------------------------
-- THE PRICING, AND WHY THE CAP IS LOAD-BEARING  (read before touching it)
--
--   bonus = LEAST( percent_of_sale% of orders.price,          -- advertised 5%
--                  margin_share%   of platform margin,        -- default 50%
--                  margin - min_platform_keep )               -- backstop
--
--   The advertised rate is a % OF THE SALE, which is easy to explain but is
--   denominated in a number with no relationship to what the platform earns.
--   Data margins here run ~15% of the sale price, so:
--
--     GHS 10  paid /  8.50 cost / 1.50 margin -> 5% = 0.50   fine (33% of margin)
--     GHS 100 paid / 97.00 cost / 3.00 margin -> 5% = 5.00   EXCEEDS THE MARGIN
--
--   So the margin cap is NOT a safety net here — it is part of the pricing and
--   engages routinely, on any order whose margin is under 2x the bonus. It is
--   what preserves the invariant that makes this programme safe:
--
--     every bonus is at most HALF of a margin the platform actually earned.
--
--   That invariant is also the whole anti-abuse story. A wash trader (same human,
--   second SIM, referring themselves) can only ever convert part of their own
--   markup into wallet credit while the platform keeps the rest — the platform is
--   strictly net-positive on every bonus it pays. UNCAPPED, that is false and the
--   programme is farmable at the platform's expense. Therefore:
--
--     NEVER set referral_max_margin_share_percent to 100.
--
--   Consequence accepted up front: the advertised 5% is not always what is paid.
--   The UI says "up to 5%", and uncapped_bonus is stored on every row so admin
--   can measure how often the cap engages. If it engages on most orders, the
--   honest fix is to LOWER the advertised rate, not to widen the cap.
--
-- IDEMPOTENCY
--   referral_bonuses.order_id is UNIQUE. The ledger insert claims the credit;
--   the balance moves only if the insert won — the doctrine from
--   20260812_sub_ussd_and_profit_split.sql. Keyed on the ORDER, never on the
--   amount: amount-keyed idempotency was documented bug (1) in that file, where
--   two equal legs made one payee silently never paid.
--
-- shop_order_id IS NULL
--   On a storefront order, lib/shop-order-processor.ts writes orders.price = what
--   the GUEST paid and cost_price_at_time = what the OWNER paid the platform, so
--   both of our inputs mean something else there and the margin is the SHOP's,
--   already paid out by credit_shop_order_profits(). Paying from it would
--   double-spend the shop owner's money. Same filter, same reason, as
--   trg_log_main_profit.
-- ============================================================


-- ============================================================
-- 1. Referral code on users
--    A column, not a table: unlike shop_invites (max_uses / used_count /
--    expires_at / revoked_at, many per shop) a referral code has no lifecycle.
--    One per user, forever. Resolved server-side only, so users needs no new
--    RLS policy — an improvement on the permissive public SELECT shop_invites
--    required for its anonymous /join page.
-- ============================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- Partial unique: NULL is tolerated pre-backfill and for any row that escapes
-- the trigger, but two users can never share a live code.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code
  ON public.users (referral_code) WHERE referral_code IS NOT NULL;


-- Human-readable codes: these get read aloud and typed on a phone, so the
-- alphabet excludes 0 O 1 I L S 5. nanoid is NOT a direct dependency of this
-- project (app/api/shop/invites/route.ts imports it transitively), so minting
-- in SQL also sidesteps that fragility.
CREATE OR REPLACE FUNCTION public.mint_referral_code(p_seed TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_alpha   TEXT := 'ABCDEFGHJKMNPQRTUVWXYZ2346789';   -- 29 chars, no 0 O 1 I L S 5
  v_prefix  TEXT;
  v_code    TEXT;
  i         INT;
  v_attempt INT := 0;
  v_len     INT := 4;
BEGIN
  v_prefix := upper(substring(regexp_replace(COALESCE(p_seed, ''), '[^A-Za-z]', '', 'g') FROM 1 FOR 6));
  IF length(v_prefix) < 3 THEN
    v_prefix := 'ARHMS';
  END IF;

  LOOP
    v_attempt := v_attempt + 1;

    v_code := v_prefix;
    FOR i IN 1..v_len LOOP
      v_code := v_code || substr(v_alpha, floor(random() * length(v_alpha))::int + 1, 1);
    END LOOP;

    -- idx_users_referral_code is the only authority on uniqueness.
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.users WHERE referral_code = v_code);

    -- Widen the tail rather than spin forever on a saturated prefix.
    IF v_attempt % 5 = 0 THEN
      v_len := v_len + 1;
    END IF;

    IF v_attempt > 25 THEN
      v_code := v_prefix || upper(substring(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 10));
      EXIT;
    END IF;
  END LOOP;

  RETURN v_code;
END;
$$;


-- BEFORE INSERT on public.users — deliberately NOT on auth.users. This single
-- trigger covers all three row-creation paths without editing any of them:
--   * handle_new_user()                          (supabase/triggers.sql)
--   * its competing older twin                   (20260531_add_phone_verified_google_auth.sql)
--   * the direct insert in app/auth/callback/route.ts
-- Two versions of handle_new_user() exist and nobody knows which is live, so
-- editing one risks a silent no-op.
CREATE OR REPLACE FUNCTION public.assign_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    BEGIN
      NEW.referral_code := public.mint_referral_code(
        COALESCE(NULLIF(NEW.first_name, ''), split_part(COALESCE(NEW.email, ''), '@', 1))
      );
    EXCEPTION WHEN OTHERS THEN
      -- A referral code is never worth failing a signup over. The backfill
      -- below sweeps up anything that lands here.
      RAISE WARNING '[assign_referral_code] %', SQLERRM;
      NEW.referral_code := NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_referral_code ON public.users;
CREATE TRIGGER trg_assign_referral_code
  BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_referral_code();


-- ============================================================
-- 2. Attribution — a join table, not users.referred_by
--    Attribution carries six abuse-forensics columns, and public.users is the
--    hottest table in the app (read on every middleware role check and every
--    resolveDataPrice call). It must NOT reuse sub_agents: that table's
--    user_id UNIQUE + shop-as-parent + 2-level-only design is a different graph.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.referrals (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- UNIQUE is the attribution guarantee: a user is referred exactly once, ever.
  referred_user_id  UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  code_used         TEXT NOT NULL,
  -- 'active' earns. 'flagged' is attributed but earns nothing pending review.
  -- 'blocked' is a hard refusal, kept for forensics.
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'flagged', 'blocked')),
  flag_reason       TEXT,
  source            TEXT NOT NULL DEFAULT 'link'
                    CHECK (source IN ('link', 'manual', 'oauth')),
  claim_ip_hash     TEXT,          -- sha256(ip || salt); never the raw IP
  claimed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  CONSTRAINT referrals_no_self CHECK (referrer_id <> referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer
  ON public.referrals (referrer_id, claimed_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_ip_hash
  ON public.referrals (claim_ip_hash, claimed_at DESC) WHERE claim_ip_hash IS NOT NULL;


-- ============================================================
-- 3. Bonus ledger
-- ============================================================

CREATE TABLE IF NOT EXISTS public.referral_bonuses (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referral_id       UUID NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  referrer_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_user_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- ONE bonus per order, forever. THIS CONSTRAINT IS THE IDEMPOTENCY CLAIM.
  order_id          UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  order_reference   TEXT NOT NULL,
  order_amount      DECIMAL(12,2) NOT NULL,   -- the bonus BASE (orders.price)
  platform_margin   DECIMAL(12,2) NOT NULL,   -- the CAP basis
  rate_percent      DECIMAL(6,2)  NOT NULL,   -- snapshot; the admin rate can change
  margin_share_pct  DECIMAL(6,2)  NOT NULL,   -- snapshot of the cap setting
  -- What the advertised rate alone would have paid, before capping. Stored so
  -- admin can measure how often the cap engages:
  --   clamped = bonus_amount < uncapped_bonus
  -- If that is most orders, the advertised rate is wrong and should come down.
  uncapped_bonus    DECIMAL(12,2) NOT NULL,
  bonus_amount      DECIMAL(12,2) NOT NULL CHECK (bonus_amount > 0),
  reference         TEXT NOT NULL UNIQUE,     -- 'REFBONUS-<order_id>'
  reversed_at       TIMESTAMPTZ,
  reversed_amount   DECIMAL(12,2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_bonuses_referrer
  ON public.referral_bonuses (referrer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_bonuses_referral
  ON public.referral_bonuses (referral_id, created_at DESC);


-- ============================================================
-- 4. wallet_transactions — allow a 'referral' source, and a SCOPED unique index
--
--    The index is deliberately NOT a bare UNIQUE (reference). That column is
--    nullable, has no unique index today, and is written fire-and-forget from
--    many routes (app/api/orders/purchase/route.ts swallows the error). A bare
--    unique index would likely FAIL TO BUILD against existing duplicate/NULL
--    data, and if it did build it would start silently dropping legitimate audit
--    rows wherever two legs share a reference (a 'purchase' debit and a 'refund'
--    credit on the same reference_code). Scoping it to source='referral' means it
--    only ever sees rows this feature writes: it cannot fail to build and cannot
--    change the behaviour of a single existing write path.
-- ============================================================

-- Discover the CHECK by name rather than assuming it, per 20260412_moolre_withdrawals.sql.
DO $$
DECLARE v_c TEXT;
BEGIN
  SELECT conname INTO v_c
    FROM pg_constraint
   WHERE conrelid = 'public.wallet_transactions'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%source%';
  IF v_c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.wallet_transactions DROP CONSTRAINT %I', v_c);
  END IF;
END $$;

ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_source_check
  CHECK (source IN ('payment', 'refund', 'admin', 'purchase', 'referral'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_tx_referral_reference
  ON public.wallet_transactions (reference) WHERE source = 'referral';


-- ============================================================
-- 5. RLS — both new tables hold money, so service-role only, per
--    20260801_trusted_payment_numbers.sql. /dashboard/refer reads through an
--    authenticated route handler on the service-role client, so no client
--    SELECT policy is needed and nobody can enumerate who referred whom.
-- ============================================================

ALTER TABLE public.referrals         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_bonuses  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referrals_no_client_access" ON public.referrals;
CREATE POLICY "referrals_no_client_access"
  ON public.referrals FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "referral_bonuses_no_client_access" ON public.referral_bonuses;
CREATE POLICY "referral_bonuses_no_client_access"
  ON public.referral_bonuses FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "referrals_admin_select" ON public.referrals;
CREATE POLICY "referrals_admin_select"
  ON public.referrals FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "referral_bonuses_admin_select" ON public.referral_bonuses;
CREATE POLICY "referral_bonuses_admin_select"
  ON public.referral_bonuses FOR SELECT TO authenticated USING (public.is_admin());


-- ============================================================
-- 6. Settings. admin_settings.value is JSONB but every consumer compares it as a
--    string (`s.cron_auto_complete_enabled !== 'true'`), so these are
--    double-quoted JSON strings and SQL must read them as `value #>> '{}'`,
--    never `value::text` (which keeps the quotes).
--
--    Seeded DISABLED. The kill switch is what makes the rollout safe: deploy,
--    let attribution accumulate with no money moving, then turn it on.
-- ============================================================

INSERT INTO public.admin_settings (key, value) VALUES
  ('referral_bonus_enabled',            '"false"'),
  -- Named "_of_sale" deliberately: a bare "rate_percent" is ambiguous about its
  -- base, and 5%-of-sale vs 5%-of-margin differ ~6x in payout. Do not rename.
  ('referral_bonus_percent_of_sale',    '"5"'),
  ('referral_max_margin_share_percent', '"50"'),   -- the primary cap. NEVER 100.
  ('referral_min_platform_keep',        '"0.01"'), -- final backstop
  ('referral_max_claims_per_day',       '"25"'),
  ('referral_clawback_on_refund',       '"true"')
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- 7. The payout.
--
--    Split into pay_referral_bonus(order_id) + a thin trigger, NOT one function.
--    A reconciler cannot re-fire an AFTER UPDATE trigger with a no-op UPDATE:
--    that sets OLD.status = NEW.status = 'completed', so the transition test
--    fails and nothing happens. Both callers therefore share this body — the
--    trigger passes the transition test, the reconciler calls it directly.
--
--    It re-reads and re-validates the order, so it is correct standalone.
-- ============================================================

CREATE OR REPLACE FUNCTION public.pay_referral_bonus(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- ALIAS FOR positional args: avoids parameter resolution issues under
  -- SECURITY DEFINER + empty search_path (same pattern as the other money RPCs).
  _order_id  ALIAS FOR $1;
  o          RECORD;
  v_ref      RECORD;
  v_enabled  TEXT;
  v_rate     NUMERIC;
  v_share    NUMERIC;
  v_keep     NUMERIC;
  v_margin   NUMERIC;
  v_uncapped NUMERIC;
  v_cap      NUMERIC;
  v_bonus    NUMERIC;
  v_wallet_id UUID;
  v_rows     INT;
BEGIN
  SELECT value #>> '{}' INTO v_enabled
    FROM public.admin_settings WHERE key = 'referral_bonus_enabled';
  IF COALESCE(v_enabled, 'false') <> 'true' THEN
    RETURN jsonb_build_object('success', false, 'message', 'disabled');
  END IF;

  SELECT id, user_id, price, cost_price_at_time, reference_code,
         status, payment_status, shop_order_id
    INTO o
    FROM public.orders WHERE id = _order_id;

  IF NOT FOUND
     OR o.status <> 'completed'
     OR o.payment_status <> 'paid'
     OR o.shop_order_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'not eligible');
  END IF;

  -- referred_user_id is UNIQUE, so this is a point lookup, not a graph walk.
  SELECT r.id, r.referrer_id INTO v_ref
    FROM public.referrals r
   WHERE r.referred_user_id = o.user_id
     AND r.status = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'no active referral');
  END IF;

  v_margin := COALESCE(o.price, 0) - COALESCE(o.cost_price_at_time, 0);
  IF v_margin <= 0 THEN
    -- Loss-leader or unpriced package: pay nothing. This is the case that makes
    -- a naive % of sale dangerous.
    RETURN jsonb_build_object('success', false, 'message', 'no margin');
  END IF;

  -- Rate is % OF THE SALE. Clamped to [0,20]: above the ~15% typical gross
  -- margin the cap governs anyway, so this only catches typos like '500'.
  SELECT LEAST(GREATEST(COALESCE((value #>> '{}')::numeric, 0), 0), 20) INTO v_rate
    FROM public.admin_settings WHERE key = 'referral_bonus_percent_of_sale';
  SELECT LEAST(GREATEST(COALESCE((value #>> '{}')::numeric, 50), 0), 100) INTO v_share
    FROM public.admin_settings WHERE key = 'referral_max_margin_share_percent';
  SELECT GREATEST(COALESCE((value #>> '{}')::numeric, 0.01), 0) INTO v_keep
    FROM public.admin_settings WHERE key = 'referral_min_platform_keep';

  v_rate  := COALESCE(v_rate, 0);
  v_share := COALESCE(v_share, 50);
  v_keep  := COALESCE(v_keep, 0.01);
  IF v_rate <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'rate 0');
  END IF;

  -- What the advertised rate alone would pay, on the SALE amount. round() is
  -- correct here: this is a payout figure, and the cap below bounds it anyway.
  v_uncapped := round(o.price * v_rate / 100.0, 2);

  -- THE CAP. Not a safety net on this rate structure — it engages routinely,
  -- whenever the order's margin is under 2x the bonus. It guarantees the
  -- platform keeps at least (100 - v_share)% of the margin on every
  -- bonus-paying order. See the header: never set v_share to 100.
  --
  -- trunc(), NOT round(): a cap must round DOWN. round() to the nearest pesewa
  -- rounds a cap UP on tiny margins, which breaks the invariant it exists to
  -- enforce — with share=50 and a margin of 0.03, round(0.015,2) = 0.02, paying
  -- out 67% of the margin instead of 50%. Only ever half a pesewa of money, but
  -- the guarantee is either true or it is not.
  v_cap   := LEAST(trunc(v_margin * v_share / 100.0, 2), v_margin - v_keep);
  v_bonus := LEAST(v_uncapped, v_cap);
  IF v_bonus <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'capped to zero');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('refbonus:' || _order_id::text));

  INSERT INTO public.wallets (user_id, balance, total_credited, total_spent)
  VALUES (v_ref.referrer_id, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = v_ref.referrer_id;
  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'no wallet');
  END IF;

  -- THE CLAIM. The ledger insert claims the credit; the balance moves only if
  -- it won, so two concurrent settlements cannot both add.
  INSERT INTO public.referral_bonuses (
    referral_id, referrer_id, referred_user_id, order_id, order_reference,
    order_amount, platform_margin, rate_percent, margin_share_pct,
    uncapped_bonus, bonus_amount, reference
  ) VALUES (
    v_ref.id, v_ref.referrer_id, o.user_id, o.id, o.reference_code,
    o.price, v_margin, v_rate, v_share,
    v_uncapped, v_bonus, 'REFBONUS-' || o.id::text
  )
  ON CONFLICT (order_id) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'already credited');
  END IF;

  -- total_credited (not total_spent): this is EARNED INCOME, not a refund —
  -- which is exactly why credit_wallet_balance() is the wrong RPC here, since it
  -- DECREMENTS total_spent (20260422_security_hardening_p0.sql). And we UPDATE
  -- directly rather than call topup_wallet_balance(), because that RPC hard-requires
  -- a service_role JWT while this runs under whoever completed the order — often
  -- an admin's authenticated session.
  UPDATE public.wallets
     SET balance        = balance + v_bonus,
         total_credited = COALESCE(total_credited, 0) + v_bonus,
         updated_at     = NOW()
   WHERE id = v_wallet_id;

  -- The arbiter index is partial, so the predicate is restated for Postgres to
  -- infer it.
  INSERT INTO public.wallet_transactions
    (wallet_id, user_id, type, amount, description, reference, source, status)
  VALUES
    (v_wallet_id, v_ref.referrer_id, 'credit', v_bonus,
     'Referral bonus - order ' || o.reference_code,
     'REFBONUS-' || o.id::text, 'referral', 'completed')
  ON CONFLICT (reference) WHERE source = 'referral' DO NOTHING;

  -- NESTED exception block: a notifications failure must NOT roll back the
  -- credit above. plpgsql rolls back to the start of the enclosing block, so
  -- without this nesting a bad notification would silently undo the payout while
  -- still reporting success.
  BEGIN
    INSERT INTO public.notifications (user_id, title, message, type, action_url)
    VALUES (
      v_ref.referrer_id,
      'Referral Bonus Earned',
      'You earned GHS ' || to_char(v_bonus, 'FM999999990.00')
        || ' from a referral purchase. It is in your wallet now.',
      'balance_updated',
      '/dashboard/refer'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[pay_referral_bonus] notify failed order=% %', _order_id, SQLERRM;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'credited', v_bonus,
    'uncapped', v_uncapped,
    'capped', (v_bonus < v_uncapped)
  );
END;
$$;


-- The trigger is a thin transition guard that swallows everything: a referral
-- bug must never be able to abort an order completion.
CREATE OR REPLACE FUNCTION public.credit_referral_bonus_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND (OLD.status IS NULL OR OLD.status <> 'completed')
     AND NEW.payment_status = 'paid'
     AND NEW.shop_order_id IS NULL THEN
    BEGIN
      PERFORM public.pay_referral_bonus(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[credit_referral_bonus_on_order] order=% %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_referral_bonus ON public.orders;
CREATE TRIGGER trg_credit_referral_bonus
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.credit_referral_bonus_on_order();


-- ============================================================
-- 8. Refund clawback. app/api/admin/orders/refund/route.ts flips
--    payment_status 'paid' -> 'refunded'. Without this, a completed-then-refunded
--    order leaves the referrer permanently holding a bonus on money that came back.
-- ============================================================

CREATE OR REPLACE FUNCTION public.reverse_referral_bonus_on_refund()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_b    RECORD;
  v_bal  NUMERIC;
  v_take NUMERIC;
  v_on   TEXT;
BEGIN
  IF NOT (NEW.payment_status = 'refunded'
          AND (OLD.payment_status IS NULL OR OLD.payment_status <> 'refunded')) THEN
    RETURN NEW;
  END IF;

  SELECT value #>> '{}' INTO v_on
    FROM public.admin_settings WHERE key = 'referral_clawback_on_refund';
  IF COALESCE(v_on, 'true') <> 'true' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_b
    FROM public.referral_bonuses
   WHERE order_id = NEW.id AND reversed_at IS NULL
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT balance INTO v_bal FROM public.wallets WHERE user_id = v_b.referrer_id;

  -- Recover what we can. A referrer who already SPENT the bonus is not pushed
  -- negative; the shortfall stays visible as reversed_amount < bonus_amount.
  v_take := LEAST(COALESCE(v_bal, 0), v_b.bonus_amount);

  UPDATE public.referral_bonuses
     SET reversed_at = NOW(), reversed_amount = v_take
   WHERE id = v_b.id;

  IF v_take > 0 THEN
    UPDATE public.wallets
       SET balance = balance - v_take, updated_at = NOW()
     WHERE user_id = v_b.referrer_id;

    INSERT INTO public.wallet_transactions
      (wallet_id, user_id, type, amount, description, reference, source, status)
    SELECT w.id, v_b.referrer_id, 'debit', v_take,
           'Referral bonus reversed - order ' || NEW.reference_code || ' refunded',
           'REFREV-' || NEW.id::text, 'referral', 'completed'
      FROM public.wallets w
     WHERE w.user_id = v_b.referrer_id
    ON CONFLICT (reference) WHERE source = 'referral' DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[reverse_referral_bonus_on_refund] order=% %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reverse_referral_bonus ON public.orders;
CREATE TRIGGER trg_reverse_referral_bonus
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.reverse_referral_bonus_on_refund();


-- ============================================================
-- 9. Reconciler — safety net for anything the trigger's EXCEPTION swallowed.
--    Calls pay_referral_bonus() directly (a no-op UPDATE would not re-fire the
--    trigger). Bounded by o.created_at >= rf.claimed_at so it can NEVER pay for
--    orders placed before the referral existed: nobody was promised a
--    retroactive bonus and paying one is real unbudgeted cash outflow.
-- ============================================================

CREATE OR REPLACE FUNCTION public.reconcile_referral_bonuses(p_limit INT DEFAULT 500)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _limit  ALIAS FOR $1;
  v_jwt   TEXT;
  r       RECORD;
  v_res   JSONB;
  v_paid  INT := 0;
  v_seen  INT := 0;
BEGIN
  v_jwt := COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '');
  IF v_jwt <> 'service_role' THEN
    RAISE EXCEPTION 'UNAUTHORIZED: reconcile_referral_bonuses requires service_role';
  END IF;

  FOR r IN
    SELECT o.id
      FROM public.orders o
      JOIN public.referrals rf
        ON rf.referred_user_id = o.user_id AND rf.status = 'active'
     WHERE o.status = 'completed'
       AND o.payment_status = 'paid'
       AND o.shop_order_id IS NULL
       AND o.created_at >= rf.claimed_at
       AND NOT EXISTS (
             SELECT 1 FROM public.referral_bonuses b WHERE b.order_id = o.id
           )
     ORDER BY o.created_at DESC
     LIMIT COALESCE(_limit, 500)
  LOOP
    v_seen := v_seen + 1;
    v_res  := public.pay_referral_bonus(r.id);
    IF COALESCE(v_res->>'success', 'false') = 'true'
       AND (v_res ? 'credited') THEN
      v_paid := v_paid + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'examined', v_seen, 'credited', v_paid);
END;
$$;


-- ============================================================
-- 10. Grants. pay_referral_bonus moves money and is deliberately NOT granted to
--     authenticated: the trigger reaches it as SECURITY DEFINER (effective user
--     is the owner), so the trigger path works without that grant, and there is
--     no reason to let a logged-in client invoke a payout directly.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.pay_referral_bonus(UUID)            FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.pay_referral_bonus(UUID)            TO service_role;

REVOKE EXECUTE ON FUNCTION public.reconcile_referral_bonuses(INT)     FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reconcile_referral_bonuses(INT)     TO service_role;

REVOKE EXECUTE ON FUNCTION public.mint_referral_code(TEXT)            FROM anon;
GRANT  EXECUTE ON FUNCTION public.mint_referral_code(TEXT)            TO service_role;


-- ============================================================
-- 11. Backfill referral codes for existing users. Idempotent, re-runnable, so
--     users.referral_code becomes a total function.
-- ============================================================

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id, first_name, email FROM public.users WHERE referral_code IS NULL LOOP
    UPDATE public.users
       SET referral_code = public.mint_referral_code(
             COALESCE(NULLIF(r.first_name, ''), split_part(COALESCE(r.email, ''), '@', 1))
           )
     WHERE id = r.id;
  END LOOP;
END $$;
