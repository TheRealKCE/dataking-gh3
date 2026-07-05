-- Marketplace Orders
-- Tracks purchases: direct (cash/off-platform), split (Paystack subaccount), escrow (platform holds)
-- Status machine: created → paid_escrowed → shipped → delivered_confirmed → released → settled

BEGIN;

CREATE TABLE IF NOT EXISTS public.marketplace_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES public.classified_listings(id) ON DELETE RESTRICT,
    variant_id UUID REFERENCES public.marketplace_listing_variants(id) ON DELETE RESTRICT,
    buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
    price_pesewas INTEGER NOT NULL CHECK (price_pesewas > 0),
    commission_rate_percent NUMERIC(5,2) DEFAULT 0,
    commission_pesewas INTEGER DEFAULT 0,
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('direct', 'split', 'escrow')),
    status TEXT DEFAULT 'created' CHECK (status IN (
        'created', 'paid_escrowed', 'shipped', 'delivered_confirmed',
        'released', 'settled', 'refunded', 'disputed', 'cancelled'
    )),
    variant_snapshot JSONB,
    reference_code TEXT UNIQUE,
    buyer_notes TEXT,
    seller_notes TEXT,
    shipped_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE marketplace_orders ENABLE ROW LEVEL SECURITY;

-- Buyer read own orders
CREATE POLICY "Buyer read own orders" ON marketplace_orders
    FOR SELECT USING (auth.uid() = buyer_id);

-- Seller read own orders
CREATE POLICY "Seller read own orders" ON marketplace_orders
    FOR SELECT USING (auth.uid() = seller_id);

-- Buyer create order
CREATE POLICY "Buyer create order" ON marketplace_orders
    FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- Buyer update own order (notes only)
CREATE POLICY "Buyer update order notes" ON marketplace_orders
    FOR UPDATE USING (auth.uid() = buyer_id)
    WITH CHECK (auth.uid() = buyer_id);

-- Seller update order (ship, notes)
CREATE POLICY "Seller update order" ON marketplace_orders
    FOR UPDATE USING (auth.uid() = seller_id)
    WITH CHECK (auth.uid() = seller_id);

-- Admin read all
CREATE POLICY "Admin read all orders" ON marketplace_orders
    FOR SELECT USING (
        EXISTS(SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'sub-admin'))
    );

-- Indexes
CREATE INDEX idx_marketplace_orders_buyer ON marketplace_orders(buyer_id);
CREATE INDEX idx_marketplace_orders_seller ON marketplace_orders(seller_id);
CREATE INDEX idx_marketplace_orders_listing ON marketplace_orders(listing_id);
CREATE INDEX idx_marketplace_orders_status ON marketplace_orders(status);
CREATE INDEX idx_marketplace_orders_reference ON marketplace_orders(reference_code);
CREATE INDEX idx_marketplace_orders_created_at ON marketplace_orders(created_at DESC);
CREATE INDEX idx_marketplace_orders_payment_mode ON marketplace_orders(payment_mode);

COMMIT;
