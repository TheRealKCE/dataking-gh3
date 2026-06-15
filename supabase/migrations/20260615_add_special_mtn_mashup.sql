-- Migration to add 'Special MTN Mashup' to the network ENUM or CHECK constraints

DO $$ 
DECLARE 
    enum_name text;
    r record;
BEGIN
    -- 1. Check if 'network' column uses an ENUM type
    SELECT t.typname INTO enum_name
    FROM pg_attribute a
    JOIN pg_type t ON a.atttypid = t.oid
    WHERE a.attrelid = 'public.data_packages'::regclass AND a.attname = 'network' AND t.typtype = 'e';

    IF enum_name IS NOT NULL THEN
        -- It's an ENUM! Let's add the new value
        EXECUTE 'ALTER TYPE "' || enum_name || '" ADD VALUE IF NOT EXISTS ''Special MTN Mashup''';
    ELSE
        -- 2. If not an ENUM, check if there's a CHECK constraint restricting the 'network' column
        FOR r IN (
            SELECT tc.constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
            WHERE tc.table_name = 'data_packages' 
              AND ccu.column_name = 'network' 
              AND tc.constraint_type = 'CHECK'
        ) LOOP
            -- Drop the old constraint
            EXECUTE 'ALTER TABLE public.data_packages DROP CONSTRAINT ' || r.constraint_name;
        END LOOP;
        
        -- Add a new updated CHECK constraint (optional, but good for data integrity)
        ALTER TABLE public.data_packages 
        ADD CONSTRAINT data_packages_network_check 
        CHECK (network IN ('MTN', 'Telecel', 'AT-iShare', 'AT-BigTime', 'Special MTN Mashup'));
    END IF;
END $$;
