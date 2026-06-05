-- ============================================================
-- ARHMS DATA LTD — Explicit API Grants Migration (Safe Version)
-- Prepared for: Supabase Data API defaults change (May 30 / Oct 30 2026)
--
-- This script dynamically grants permissions ONLY on tables that
-- actually exist in the live database. It will never fail due to
-- a missing table.
-- Run this once in the Supabase SQL Editor.
-- ============================================================

DO $$
DECLARE
    tbl TEXT;
    -- Tables that should also be readable by anonymous (public-facing)
    anon_readable TEXT[] := ARRAY[
        'users',
        'data_packages',
        'shop_profiles',
        'shop_global_settings',
        'shop_pricing',
        'shop_announcements',
        'shop_rc_pricing',
        'results_checker_types',
        'system_announcements'
    ];
BEGIN
    -- Loop through every table in the public schema that actually exists
    FOR tbl IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
    LOOP
        -- Grant full CRUD to authenticated users (RLS controls row-level access)
        EXECUTE format(
            'GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated',
            tbl
        );

        -- Grant all privileges to service_role (server-side bypass)
        EXECUTE format(
            'GRANT ALL ON public.%I TO service_role',
            tbl
        );

        -- Grant SELECT to anon only for public-facing tables
        IF tbl = ANY(anon_readable) THEN
            EXECUTE format(
                'GRANT SELECT ON public.%I TO anon',
                tbl
            );
        END IF;

        RAISE NOTICE 'Granted permissions on: %', tbl;
    END LOOP;

    -- Grant sequence usage (for auto-increment IDs)
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
    GRANT ALL           ON ALL SEQUENCES IN SCHEMA public TO service_role;

    RAISE NOTICE '✅ All grants applied successfully. Project is future-proofed for Supabase API changes.';
END
$$;

-- ============================================================
-- IMPORTANT: For any NEW table you create after May 30, 2026,
-- always add these lines right after CREATE TABLE:
--
--   GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table_name> TO authenticated;
--   GRANT SELECT ON public.<table_name> TO anon;  -- only if public-facing
--   GRANT ALL ON public.<table_name> TO service_role;
-- ============================================================
