-- Marketplace Orders & Payments
-- Order management, escrow, and payment tracking

BEGIN;

-- Escrow account for holding buyer funds
CREATE TABLE IF NOT EXISTS public.marketplace_escrow (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_id uuid NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
    amount_pesewas integer NOT NULL,
    status text NOT NULL DEFAULT 'held', -- held, released, refunded, disputed
    held_at timestamp with time zone DEFAULT now(),
    released_at timestamp with time zone,
    reason_if_released text,
    created_at timestamp with time zone DEFAULT now(),

    CONSTRAINT valid_status CHECK (status IN ('held', 'released', 'refunded', 'disputed')),
    CONSTRAINT positive_amount CHECK (amount_pesewas > 0),
    UNIQUE(order_id)
);

-- Payment transactions log
CREATE TABLE IF NOT EXISTS public.marketplace_payment_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
    payer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    payee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount_pesewas integer NOT NULL,
    payment_method text NOT NULL, -- wallet, card, bank_transfer, escrow
    status text NOT NULL DEFAULT 'pending', -- pending, completed, failed, refunded
    gateway_reference text,
    metadata jsonb,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),

    CONSTRAINT valid_status CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    CONSTRAINT positive_amount CHECK (amount_pesewas > 0)
);

-- Order status history for audit trail
CREATE TABLE IF NOT EXISTS public.marketplace_order_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
    event_type text NOT NULL, -- created, paid, shipped, delivery_confirmed, released, cancelled
    previous_status text,
    new_status text NOT NULL,
    actor_id uuid REFERENCES auth.users(id),
    notes text,
    created_at timestamp with time zone DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_escrow_buyer_id
    ON public.marketplace_escrow(buyer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_escrow_order_id
    ON public.marketplace_escrow(order_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_escrow_status
    ON public.marketplace_escrow(status);

CREATE INDEX IF NOT EXISTS idx_marketplace_payment_transactions_order_id
    ON public.marketplace_payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_payment_transactions_payer_id
    ON public.marketplace_payment_transactions(payer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_payment_transactions_payee_id
    ON public.marketplace_payment_transactions(payee_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_payment_transactions_status
    ON public.marketplace_payment_transactions(status);

CREATE INDEX IF NOT EXISTS idx_marketplace_order_events_order_id
    ON public.marketplace_order_events(order_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_order_events_actor_id
    ON public.marketplace_order_events(actor_id);

-- RLS Policies
ALTER TABLE public.marketplace_escrow ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_order_events ENABLE ROW LEVEL SECURITY;

-- Buyer can see their own escrow accounts
CREATE POLICY "marketplace_escrow_buyer_read"
    ON public.marketplace_escrow
    FOR SELECT
    USING (buyer_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin');

-- Only admins can write escrow
CREATE POLICY "marketplace_escrow_admin_write"
    ON public.marketplace_escrow
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'is_admin' = 'true');

-- Users can see transactions involving them
CREATE POLICY "marketplace_payment_transactions_read"
    ON public.marketplace_payment_transactions
    FOR SELECT
    USING (
        payer_id = auth.uid() OR
        payee_id = auth.uid() OR
        auth.jwt() ->> 'role' = 'admin'
    );

-- Users can see order events for their orders
CREATE POLICY "marketplace_order_events_read"
    ON public.marketplace_order_events
    FOR SELECT
    USING (
        order_id IN (
            SELECT id FROM public.marketplace_orders
            WHERE buyer_id = auth.uid() OR seller_id = auth.uid()
        ) OR
        auth.jwt() ->> 'role' = 'admin'
    );

COMMIT;
