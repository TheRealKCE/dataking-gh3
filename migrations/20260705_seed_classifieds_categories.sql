-- Insert main categories for classifieds marketplace
INSERT INTO public.classified_categories (name, slug, description, icon_emoji, display_order) VALUES
('Electronics', 'electronics', 'Electronics and gadgets', '📱', 1),
('Home, Furniture & Appliances', 'home-furniture-appliances', 'Household items and furniture', '🏠', 2),
('Fashion', 'fashion', 'Clothing and fashion items', '👗', 3),
('Beauty & Personal Care', 'beauty-personal-care', 'Beauty and wellness products', '💄', 4),
('Repair & Construction', 'repair-construction', 'Repair and construction services', '🛠️', 5),
('Commercial Equipment & Tools', 'commercial-equipment-tools', 'Business and commercial items', '⚙️', 6),
('Leisure & Activities', 'leisure-activities', 'Sports and leisure items', '⚽', 7),
('Babies & Kids', 'babies-kids', 'Items for children', '👶', 8)
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
('Computer Monitors', 'computer-monitors', 'Monitors and displays', '🖥️', (SELECT id FROM public.classified_categories WHERE slug = 'electronics' AND parent_id IS NULL LIMIT 1), 10),
('Mobile Phones & Accessories', 'mobile-phones-accessories', 'Smartphones, phones, and mobile accessories', '📱', (SELECT id FROM public.classified_categories WHERE slug = 'electronics' AND parent_id IS NULL LIMIT 1), 11)
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

-- Insert subcategories for Babies & Kids
INSERT INTO public.classified_categories (name, slug, description, icon_emoji, parent_id, display_order) VALUES
('Toys & Games', 'toys-games', 'Toys and games for children', '🎮', (SELECT id FROM public.classified_categories WHERE slug = 'babies-kids' AND parent_id IS NULL LIMIT 1), 1),
('Children''s Furniture', 'childrens-furniture', 'Furniture for children', '🛏️', (SELECT id FROM public.classified_categories WHERE slug = 'babies-kids' AND parent_id IS NULL LIMIT 1), 2),
('Children''s Clothing', 'childrens-clothing', 'Clothing for children', '👕', (SELECT id FROM public.classified_categories WHERE slug = 'babies-kids' AND parent_id IS NULL LIMIT 1), 3),
('Children''s Shoes', 'childrens-shoes', 'Shoes for children', '👟', (SELECT id FROM public.classified_categories WHERE slug = 'babies-kids' AND parent_id IS NULL LIMIT 1), 4),
('Babies & Kids Accessories', 'babies-kids-accessories', 'Accessories for babies and kids', '🎒', (SELECT id FROM public.classified_categories WHERE slug = 'babies-kids' AND parent_id IS NULL LIMIT 1), 5),
('Baby Gear & Equipment', 'baby-gear-equipment', 'Baby gear and equipment', '🚼', (SELECT id FROM public.classified_categories WHERE slug = 'babies-kids' AND parent_id IS NULL LIMIT 1), 6),
('Care & Feeding', 'care-feeding', 'Baby care and feeding supplies', '🍼', (SELECT id FROM public.classified_categories WHERE slug = 'babies-kids' AND parent_id IS NULL LIMIT 1), 7),
('Maternity & Pregnancy', 'maternity-pregnancy', 'Maternity and pregnancy products', '🤰', (SELECT id FROM public.classified_categories WHERE slug = 'babies-kids' AND parent_id IS NULL LIMIT 1), 8),
('Transport & Safety', 'transport-safety', 'Baby transport and safety gear', '🚗', (SELECT id FROM public.classified_categories WHERE slug = 'babies-kids' AND parent_id IS NULL LIMIT 1), 9),
('Playground Equipment', 'playground-equipment', 'Playground and outdoor equipment', '🎡', (SELECT id FROM public.classified_categories WHERE slug = 'babies-kids' AND parent_id IS NULL LIMIT 1), 10),
('Child Care & Education', 'child-care-education', 'Child care and educational materials', '📚', (SELECT id FROM public.classified_categories WHERE slug = 'babies-kids' AND parent_id IS NULL LIMIT 1), 11)
ON CONFLICT (slug) DO NOTHING;

-- Insert subcategories for Leisure & Activities
INSERT INTO public.classified_categories (name, slug, description, icon_emoji, parent_id, display_order) VALUES
('Personal Mobility', 'personal-mobility', 'Personal mobility devices', '🛴', (SELECT id FROM public.classified_categories WHERE slug = 'leisure-activities' AND parent_id IS NULL LIMIT 1), 1),
('Sports Equipment', 'sports-equipment', 'Sports equipment and gear', '⚽', (SELECT id FROM public.classified_categories WHERE slug = 'leisure-activities' AND parent_id IS NULL LIMIT 1), 2),
('Massagers', 'massagers', 'Massage and relaxation devices', '💆', (SELECT id FROM public.classified_categories WHERE slug = 'leisure-activities' AND parent_id IS NULL LIMIT 1), 3),
('Musical Instruments & Gear', 'musical-instruments-gear', 'Musical instruments and equipment', '🎸', (SELECT id FROM public.classified_categories WHERE slug = 'leisure-activities' AND parent_id IS NULL LIMIT 1), 4),
('Books & Table Games', 'books-table-games', 'Books and board games', '📚', (SELECT id FROM public.classified_categories WHERE slug = 'leisure-activities' AND parent_id IS NULL LIMIT 1), 5),
('Arts, Crafts & Awards', 'arts-crafts-awards', 'Art supplies and crafts', '🎨', (SELECT id FROM public.classified_categories WHERE slug = 'leisure-activities' AND parent_id IS NULL LIMIT 1), 6),
('Outdoor Gear', 'outdoor-gear', 'Outdoor and camping equipment', '⛺', (SELECT id FROM public.classified_categories WHERE slug = 'leisure-activities' AND parent_id IS NULL LIMIT 1), 7),
('Smoking Accessories', 'smoking-accessories', 'Smoking accessories', '🚬', (SELECT id FROM public.classified_categories WHERE slug = 'leisure-activities' AND parent_id IS NULL LIMIT 1), 8),
('Music & Video', 'music-video', 'Music and video equipment', '🎬', (SELECT id FROM public.classified_categories WHERE slug = 'leisure-activities' AND parent_id IS NULL LIMIT 1), 9),
('Fitness & Personal Training Services', 'fitness-personal-training', 'Fitness and training services', '💪', (SELECT id FROM public.classified_categories WHERE slug = 'leisure-activities' AND parent_id IS NULL LIMIT 1), 10)
ON CONFLICT (slug) DO NOTHING;

-- Add Vehicles as a new main category
INSERT INTO public.classified_categories (name, slug, description, icon_emoji, display_order) VALUES
('Vehicles', 'vehicles', 'Automobiles and vehicles', '🚗', 0)
ON CONFLICT (slug) DO NOTHING;

-- Insert subcategories for Vehicles
INSERT INTO public.classified_categories (name, slug, description, icon_emoji, parent_id, display_order) VALUES
('Vehicle Parts & Accessories', 'vehicle-parts-accessories', 'Car parts and accessories', '🔧', (SELECT id FROM public.classified_categories WHERE slug = 'vehicles' AND parent_id IS NULL LIMIT 1), 1),
('Cars', 'cars', 'Automobiles and sedans', '🚙', (SELECT id FROM public.classified_categories WHERE slug = 'vehicles' AND parent_id IS NULL LIMIT 1), 2),
('Motorcycles & Scooters', 'motorcycles-scooters', 'Motorcycles and scooters', '🏍️', (SELECT id FROM public.classified_categories WHERE slug = 'vehicles' AND parent_id IS NULL LIMIT 1), 3),
('Buses & Microbuses', 'buses-microbuses', 'Buses and public transport vehicles', '🚌', (SELECT id FROM public.classified_categories WHERE slug = 'vehicles' AND parent_id IS NULL LIMIT 1), 4),
('Trucks & Trailers', 'trucks-trailers', 'Trucks and heavy vehicles', '🚚', (SELECT id FROM public.classified_categories WHERE slug = 'vehicles' AND parent_id IS NULL LIMIT 1), 5),
('Construction & Heavy Machinery', 'construction-heavy-machinery', 'Construction equipment and machinery', '🏗️', (SELECT id FROM public.classified_categories WHERE slug = 'vehicles' AND parent_id IS NULL LIMIT 1), 6),
('Watercraft & Boats', 'watercraft-boats', 'Boats and marine vessels', '⛵', (SELECT id FROM public.classified_categories WHERE slug = 'vehicles' AND parent_id IS NULL LIMIT 1), 7),
('Car Services', 'car-services', 'Car repair and maintenance services', '🔧', (SELECT id FROM public.classified_categories WHERE slug = 'vehicles' AND parent_id IS NULL LIMIT 1), 8)
ON CONFLICT (slug) DO NOTHING;

-- Insert subcategories for Commercial Equipment & Tools
INSERT INTO public.classified_categories (name, slug, description, icon_emoji, parent_id, display_order) VALUES
('Heavy Machinery', 'heavy-machinery', 'Heavy industrial machinery', '🏗️', (SELECT id FROM public.classified_categories WHERE slug = 'commercial-equipment-tools' AND parent_id IS NULL LIMIT 1), 1),
('Power Tools', 'power-tools', 'Electric and power tools', '⚡', (SELECT id FROM public.classified_categories WHERE slug = 'commercial-equipment-tools' AND parent_id IS NULL LIMIT 1), 2),
('Hand Tools & Equipment', 'hand-tools-equipment', 'Hand tools and basic equipment', '🔨', (SELECT id FROM public.classified_categories WHERE slug = 'commercial-equipment-tools' AND parent_id IS NULL LIMIT 1), 3),
('Office Equipment & Furniture', 'office-equipment-furniture', 'Office equipment and desks', '🖥️', (SELECT id FROM public.classified_categories WHERE slug = 'commercial-equipment-tools' AND parent_id IS NULL LIMIT 1), 4),
('Industrial Generators', 'industrial-generators', 'Generators and power equipment', '⚙️', (SELECT id FROM public.classified_categories WHERE slug = 'commercial-equipment-tools' AND parent_id IS NULL LIMIT 1), 5),
('Welding & Fabrication Equipment', 'welding-fabrication', 'Welding and metalwork tools', '🔥', (SELECT id FROM public.classified_categories WHERE slug = 'commercial-equipment-tools' AND parent_id IS NULL LIMIT 1), 6),
('Pumps & Water Equipment', 'pumps-water-equipment', 'Industrial pumps and water systems', '💧', (SELECT id FROM public.classified_categories WHERE slug = 'commercial-equipment-tools' AND parent_id IS NULL LIMIT 1), 7),
('Compressors & Air Tools', 'compressors-air-tools', 'Air compressors and pneumatic tools', '💨', (SELECT id FROM public.classified_categories WHERE slug = 'commercial-equipment-tools' AND parent_id IS NULL LIMIT 1), 8),
('Safety Equipment', 'safety-equipment', 'Industrial safety gear and equipment', '🦺', (SELECT id FROM public.classified_categories WHERE slug = 'commercial-equipment-tools' AND parent_id IS NULL LIMIT 1), 9),
('Hydraulic Equipment', 'hydraulic-equipment', 'Hydraulic systems and components', '⚙️', (SELECT id FROM public.classified_categories WHERE slug = 'commercial-equipment-tools' AND parent_id IS NULL LIMIT 1), 10),
('Workshop Machinery', 'workshop-machinery', 'Workshop and manufacturing equipment', '🏭', (SELECT id FROM public.classified_categories WHERE slug = 'commercial-equipment-tools' AND parent_id IS NULL LIMIT 1), 11),
('Material Handling Equipment', 'material-handling', 'Forklifts and material handling', '📦', (SELECT id FROM public.classified_categories WHERE slug = 'commercial-equipment-tools' AND parent_id IS NULL LIMIT 1), 12)
ON CONFLICT (slug) DO NOTHING;
