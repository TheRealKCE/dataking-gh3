-- Admin Custom User Lists
-- Creates two tables: the list definition and the list members

CREATE TABLE IF NOT EXISTS admin_custom_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_custom_list_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES admin_custom_lists(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(list_id, user_id)  -- prevent duplicate members
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_aclu_list_id ON admin_custom_list_users(list_id);
CREATE INDEX IF NOT EXISTS idx_aclu_user_id ON admin_custom_list_users(user_id);

-- Row Level Security
ALTER TABLE admin_custom_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_custom_list_users ENABLE ROW LEVEL SECURITY;

-- Only admins can manage lists
CREATE POLICY "admin_custom_lists_admin_only" ON admin_custom_lists
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "admin_custom_list_users_admin_only" ON admin_custom_list_users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );
