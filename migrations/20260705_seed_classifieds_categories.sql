-- Insert main categories for classifieds marketplace
INSERT INTO public.classified_categories (name, slug, description, icon_emoji, display_order) VALUES
('Electronics', 'electronics', 'Electronics and gadgets', '📱', 1),
('Home, Furniture & Appliances', 'home-furniture-appliances', 'Household items and furniture', '🏠', 2),
('Fashion', 'fashion', 'Clothing and fashion items', '👗', 3),
('Beauty & Personal Care', 'beauty-personal-care', 'Beauty and wellness products', '💄', 4),
('Services', 'services', 'Professional services', '🔧', 5),
('Repair & Construction', 'repair-construction', 'Repair and construction services', '🛠️', 6),
('Commercial Equipment & Tools', 'commercial-equipment-tools', 'Business and commercial items', '⚙️', 7),
('Leisure & Activities', 'leisure-activities', 'Sports and leisure items', '⚽', 8),
('Babies & Kids', 'babies-kids', 'Items for children', '👶', 9)
ON CONFLICT (slug) DO NOTHING;

-- Insert subcategories for Electronics
INSERT INTO public.classified_categories (name, slug, description, icon_emoji, parent_id, display_order) VALUES
('Laptops & Computers', 'laptops-computers', 'Desktop and laptop computers', '💻', (SELECT id FROM public.classified_categories WHERE slug = 'electronics' AND parent_id IS NULL LIMIT 1), 1),
('TV & Video Equipment', 'tv-video-equipment', 'Television and video gear', '📺', (SELECT id FROM public.classified_categories WHERE slug = 'electronics' AND parent_id IS NULL LIMIT 1), 2),
('Video Game Consoles', 'video-game-consoles', 'Gaming consoles and equipment', '🎮', (SELECT id FROM public.classified_categories WHERE slug = 'electronics' AND parent_id IS NULL LIMIT 1), 3),
('Audio & Music Equipment', 'audio-music-equipment', 'Audio devices and instruments', '🎵', (SELECT id FROM public.classified_categories WHERE slug = 'electronics' AND parent_id IS NULL LIMIT 1), 4),
('Headphones', 'headphones', 'Headphones and earbuds', '🎧', (SELECT id FROM public.classified_categories WHERE slug = 'electronics' AND parent_id IS NULL LIMIT 1), 5),
('Photo & Video Cameras', 'photo-video-cameras', 'Cameras and photography gear', '📷', (SELECT id FROM public.classified_categories WHERE slug = 'electronics' AND parent_id IS NULL LIMIT 1), 6),
('Security & Surveillance', 'security-surveillance', 'Security cameras and systems', '📹', (SELECT id FROM public.classified_categories WHERE slug = 'electronics' AND parent_id IS NULL LIMIT 1), 7),
('Networking Products', 'networking-products', 'Routers and network equipment', '🌐', (SELECT id FROM public.classified_categories WHERE slug = 'electronics' AND parent_id IS NULL LIMIT 1), 8),
('Printers & Scanners', 'printers-scanners', 'Printers and scanning devices', '🖨️', (SELECT id FROM public.classified_categories WHERE slug = 'electronics' AND parent_id IS NULL LIMIT 1), 9),
('Computer Monitors', 'computer-monitors', 'Monitors and displays', '🖥️', (SELECT id FROM public.classified_categories WHERE slug = 'electronics' AND parent_id IS NULL LIMIT 1), 10)
ON CONFLICT (slug) DO NOTHING;

-- Insert subcategories for Home, Furniture & Appliances
INSERT INTO public.classified_categories (name, slug, description, icon_emoji, parent_id, display_order) VALUES
('Furniture', 'furniture', 'Home furniture', '🪑', (SELECT id FROM public.classified_categories WHERE slug = 'home-furniture-appliances' AND parent_id IS NULL LIMIT 1), 1),
('Lighting', 'lighting', 'Lights and lamps', '💡', (SELECT id FROM public.classified_categories WHERE slug = 'home-furniture-appliances' AND parent_id IS NULL LIMIT 1), 2),
('Storage & Organization', 'storage-organization', 'Storage solutions', '📦', (SELECT id FROM public.classified_categories WHERE slug = 'home-furniture-appliances' AND parent_id IS NULL LIMIT 1), 3),
('Home Accessories', 'home-accessories', 'Home decor and accessories', '🏡', (SELECT id FROM public.classified_categories WHERE slug = 'home-furniture-appliances' AND parent_id IS NULL LIMIT 1), 4),
('Home Appliances', 'home-appliances', 'Major and small appliances', '🍳', (SELECT id FROM public.classified_categories WHERE slug = 'home-furniture-appliances' AND parent_id IS NULL LIMIT 1), 5),
('Kitchen Appliances', 'kitchen-appliances', 'Kitchen equipment', '🍳', (SELECT id FROM public.classified_categories WHERE slug = 'home-furniture-appliances' AND parent_id IS NULL LIMIT 1), 6),
('Kitchenware & Cookware', 'kitchenware-cookware', 'Pots, pans, and utensils', '🥘', (SELECT id FROM public.classified_categories WHERE slug = 'home-furniture-appliances' AND parent_id IS NULL LIMIT 1), 7),
('Household Chemicals', 'household-chemicals', 'Cleaning and household products', '🧹', (SELECT id FROM public.classified_categories WHERE slug = 'home-furniture-appliances' AND parent_id IS NULL LIMIT 1), 8),
('Garden Supplies', 'garden-supplies', 'Garden and outdoor items', '🌿', (SELECT id FROM public.classified_categories WHERE slug = 'home-furniture-appliances' AND parent_id IS NULL LIMIT 1), 9)
ON CONFLICT (slug) DO NOTHING;

-- Insert subcategories for Fashion
INSERT INTO public.classified_categories (name, slug, description, icon_emoji, parent_id, display_order) VALUES
('Womens Fashion', 'womens-fashion', 'Women clothing and accessories', '👗', (SELECT id FROM public.classified_categories WHERE slug = 'fashion' AND parent_id IS NULL LIMIT 1), 1),
('Mens Fashion', 'mens-fashion', 'Men clothing and accessories', '👔', (SELECT id FROM public.classified_categories WHERE slug = 'fashion' AND parent_id IS NULL LIMIT 1), 2),
('Baby & Kids Fashion', 'baby-kids-fashion', 'Children clothing', '👕', (SELECT id FROM public.classified_categories WHERE slug = 'fashion' AND parent_id IS NULL LIMIT 1), 3)
ON CONFLICT (slug) DO NOTHING;

-- Insert subcategories for Beauty & Personal Care
INSERT INTO public.classified_categories (name, slug, description, icon_emoji, parent_id, display_order) VALUES
('Hair Beauty', 'hair-beauty', 'Hair care products', '💇', (SELECT id FROM public.classified_categories WHERE slug = 'beauty-personal-care' AND parent_id IS NULL LIMIT 1), 1),
('Face Care', 'face-care', 'Face care and skincare', '🧴', (SELECT id FROM public.classified_categories WHERE slug = 'beauty-personal-care' AND parent_id IS NULL LIMIT 1), 2),
('Oral Care', 'oral-care', 'Dental care products', '🦷', (SELECT id FROM public.classified_categories WHERE slug = 'beauty-personal-care' AND parent_id IS NULL LIMIT 1), 3),
('Body Care', 'body-care', 'Body care products', '🧼', (SELECT id FROM public.classified_categories WHERE slug = 'beauty-personal-care' AND parent_id IS NULL LIMIT 1), 4),
('Fragrance', 'fragrance', 'Perfumes and colognes', '💐', (SELECT id FROM public.classified_categories WHERE slug = 'beauty-personal-care' AND parent_id IS NULL LIMIT 1), 5),
('Makeup', 'makeup', 'Makeup products', '💄', (SELECT id FROM public.classified_categories WHERE slug = 'beauty-personal-care' AND parent_id IS NULL LIMIT 1), 6),
('Vitamins & Supplements', 'vitamins-supplements', 'Health supplements', '💊', (SELECT id FROM public.classified_categories WHERE slug = 'beauty-personal-care' AND parent_id IS NULL LIMIT 1), 7)
ON CONFLICT (slug) DO NOTHING;

-- Insert subcategories for Repair & Construction
INSERT INTO public.classified_categories (name, slug, description, icon_emoji, parent_id, display_order) VALUES
('Electrical Equipment', 'electrical-equipment', 'Electrical tools and supplies', '⚡', (SELECT id FROM public.classified_categories WHERE slug = 'repair-construction' AND parent_id IS NULL LIMIT 1), 1),
('Building Materials & Supplies', 'building-materials-supplies', 'Construction materials', '🧱', (SELECT id FROM public.classified_categories WHERE slug = 'repair-construction' AND parent_id IS NULL LIMIT 1), 2),
('Plumbing & Water Systems', 'plumbing-water-systems', 'Plumbing supplies', '🚰', (SELECT id FROM public.classified_categories WHERE slug = 'repair-construction' AND parent_id IS NULL LIMIT 1), 3),
('Hand Tools', 'hand-tools', 'Hand tools and equipment', '🔨', (SELECT id FROM public.classified_categories WHERE slug = 'repair-construction' AND parent_id IS NULL LIMIT 1), 4),
('Hardware & Fasteners', 'hardware-fasteners', 'Hardware items', '🔩', (SELECT id FROM public.classified_categories WHERE slug = 'repair-construction' AND parent_id IS NULL LIMIT 1), 5),
('Doors & Security', 'doors-security', 'Doors and security systems', '🚪', (SELECT id FROM public.classified_categories WHERE slug = 'repair-construction' AND parent_id IS NULL LIMIT 1), 6)
ON CONFLICT (slug) DO NOTHING;
