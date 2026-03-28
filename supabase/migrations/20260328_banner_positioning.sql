-- Add positioning columns for shop banners
ALTER TABLE shop_profiles 
ADD COLUMN IF NOT EXISTS banner_pos_x INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS banner_pos_y INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS banner_zoom NUMERIC DEFAULT 1;

-- Update existing rows to have default values if null (though IF NOT EXISTS handles it for new columns)
UPDATE shop_profiles SET 
banner_pos_x = 50,
banner_pos_y = 50,
banner_zoom = 1
WHERE banner_pos_x IS NULL;
