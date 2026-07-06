-- Guard Trigger on marketplace_listings
-- Prevents sellers from modifying moderation_status directly (only draft ↔ pending allowed)

BEGIN;

DROP FUNCTION IF EXISTS prevent_self_promotion() CASCADE;

CREATE FUNCTION prevent_self_promotion()
RETURNS TRIGGER AS $$
DECLARE
    user_id UUID;
    is_admin BOOLEAN;
BEGIN
    -- Get current user ID from session
    user_id := auth.uid();

    -- Check if user is admin
    SELECT EXISTS(
        SELECT 1 FROM users
        WHERE id = user_id AND role IN ('admin', 'sub-admin')
    ) INTO is_admin;

    -- Only proceed if user is NOT admin (admins can do anything)
    IF NOT is_admin THEN
        -- Block if trying to change moderation_status (only draft ↔ pending allowed)
        IF OLD.moderation_status IS DISTINCT FROM NEW.moderation_status THEN
            -- Only allow draft → pending and pending → draft
            IF NOT (
                (OLD.moderation_status = 'draft' AND NEW.moderation_status = 'pending') OR
                (OLD.moderation_status = 'pending' AND NEW.moderation_status = 'draft')
            ) THEN
                RAISE EXCEPTION 'Sellers can only move listings between draft and pending';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to classified_listings table
DROP TRIGGER IF EXISTS prevent_self_promotion_trigger ON public.classified_listings;

CREATE TRIGGER prevent_self_promotion_trigger
    BEFORE UPDATE ON public.classified_listings
    FOR EACH ROW
    EXECUTE FUNCTION prevent_self_promotion();

COMMIT;
