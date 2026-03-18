-- 1. Structural Locks on shop_pricing
ALTER TABLE public.shop_pricing 
ADD COLUMN IF NOT EXISTS profit_margin DECIMAL(12,2) NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS last_auto_updated_at TIMESTAMPTZ;

-- Add Constraints idempotently
ALTER TABLE public.shop_pricing DROP CONSTRAINT IF EXISTS check_profit_margin_range;
ALTER TABLE public.shop_pricing ADD CONSTRAINT check_profit_margin_range CHECK (profit_margin > 0 AND profit_margin <= 10);

ALTER TABLE public.shop_pricing DROP CONSTRAINT IF EXISTS unique_shop_package;
ALTER TABLE public.shop_pricing ADD CONSTRAINT unique_shop_package UNIQUE (shop_id, package_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_shop_pricing_package ON public.shop_pricing(package_id);
CREATE INDEX IF NOT EXISTS idx_shop_pricing_shop ON public.shop_pricing(shop_id);

-- 2. Audit Table
CREATE TABLE IF NOT EXISTS public.shop_pricing_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES public.shop_profiles(id) ON DELETE CASCADE,
    package_id UUID NOT NULL REFERENCES public.data_packages(id) ON DELETE CASCADE,
    old_cost_price DECIMAL(12,2),
    new_cost_price DECIMAL(12,2),
    old_selling_price DECIMAL(12,2),
    new_selling_price DECIMAL(12,2),
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Trigger 1: Protect selling_price, cost_price & profit_margin
CREATE OR REPLACE FUNCTION protect_shop_pricing_updates()
RETURNS TRIGGER AS $$
BEGIN
    -- Lock profit_margin from ever being changed after creation
    IF NEW.profit_margin != OLD.profit_margin THEN
        RAISE EXCEPTION 'profit_margin cannot be changed after creation';
    END IF;

    -- Protect cost_price from manual overrides (unless system trigger flag is set)
    -- E.g., check current_setting('app.system_pricing_update', true)
    IF current_setting('app.system_pricing_update', true) IS NULL OR current_setting('app.system_pricing_update', true) != 'true' THEN
        IF NEW.cost_price != OLD.cost_price THEN
            NEW.cost_price := OLD.cost_price;
        END IF;
    END IF;

    -- Protect selling_price (force formula strictly)
    IF NEW.selling_price != OLD.selling_price THEN
        NEW.selling_price := NEW.cost_price + NEW.profit_margin;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_shop_pricing ON public.shop_pricing;
CREATE TRIGGER trg_protect_shop_pricing
BEFORE UPDATE ON public.shop_pricing
FOR EACH ROW
EXECUTE FUNCTION protect_shop_pricing_updates();


-- 4. Trigger 2: Auto Update on Platform Price Change (CTE + Audit log + Rollback flag guard)
CREATE OR REPLACE FUNCTION auto_update_shop_pricing_on_platform_cost()
RETURNS TRIGGER AS $$
BEGIN
    -- Zero Price Guard
    IF NEW.price <= 0 OR (NEW.agent_price IS NOT NULL AND NEW.agent_price <= 0) THEN
        RAISE EXCEPTION 'Invalid platform price detected';
    END IF;

    -- Trigger Guard (Loops, No Operation)
    IF NEW.price IS NOT DISTINCT FROM OLD.price AND NEW.agent_price IS NOT DISTINCT FROM OLD.agent_price THEN
        RETURN NEW;
    END IF;

    -- Safe execution block guaranteeing flag reset
    BEGIN
        -- System Isolation bypass flag
        PERFORM set_config('app.system_pricing_update', 'true', true);

        WITH updated_pricing AS (
            SELECT 
                sp.id,
                sp.shop_id,
                sp.package_id,
                sp.cost_price AS old_cost,
                sp.selling_price AS old_selling,
                CASE 
                    WHEN spf.owner_role = 'agent' AND NEW.agent_price IS NOT NULL THEN NEW.agent_price 
                    ELSE NEW.price 
                END AS new_cost,
                (
                    CASE 
                        WHEN spf.owner_role = 'agent' AND NEW.agent_price IS NOT NULL THEN NEW.agent_price 
                        ELSE NEW.price 
                    END
                ) + (
                    CASE 
                        WHEN sp.profit_margin <= 0 THEN 1
                        WHEN sp.profit_margin > 10 THEN 10
                        ELSE sp.profit_margin
                    END
                ) AS new_selling
            FROM public.shop_pricing sp
            JOIN public.shop_profiles spf ON sp.shop_id = spf.id
            WHERE sp.package_id = NEW.id
        ),
        applied_update AS (
            UPDATE public.shop_pricing sp
            SET 
                cost_price = up.new_cost,
                selling_price = up.new_selling,
                last_auto_updated_at = NOW()
            FROM updated_pricing up
            WHERE sp.id = up.id
            RETURNING up.*
        )
        INSERT INTO public.shop_pricing_logs (
            shop_id, package_id, old_cost_price, new_cost_price, 
            old_selling_price, new_selling_price, changed_at
        )
        SELECT 
            shop_id, package_id, old_cost, new_cost, 
            old_selling, new_selling, NOW()
        FROM applied_update;

        PERFORM set_config('app.system_pricing_update', 'false', true);
        RETURN NEW;
    EXCEPTION
        WHEN OTHERS THEN
            PERFORM set_config('app.system_pricing_update', 'false', true);
            RAISE;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_update_shop_pricing ON public.data_packages;
CREATE TRIGGER trg_auto_update_shop_pricing
AFTER UPDATE OF price, agent_price ON public.data_packages
FOR EACH ROW
EXECUTE FUNCTION auto_update_shop_pricing_on_platform_cost();
