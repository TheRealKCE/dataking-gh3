-- Add icon column to classified_categories for lucide-react icon names
ALTER TABLE public.classified_categories ADD COLUMN icon VARCHAR(50);

-- Main categories
UPDATE public.classified_categories SET icon = 'Smartphone' WHERE slug = 'electronics' AND parent_id IS NULL;
UPDATE public.classified_categories SET icon = 'Home' WHERE slug = 'home-furniture-appliances' AND parent_id IS NULL;
UPDATE public.classified_categories SET icon = 'Shirt' WHERE slug = 'fashion' AND parent_id IS NULL;
UPDATE public.classified_categories SET icon = 'Sparkles' WHERE slug = 'beauty-personal-care' AND parent_id IS NULL;
UPDATE public.classified_categories SET icon = 'Wrench' WHERE slug = 'repair-construction' AND parent_id IS NULL;
UPDATE public.classified_categories SET icon = 'Hammer' WHERE slug = 'commercial-equipment-tools' AND parent_id IS NULL;
UPDATE public.classified_categories SET icon = 'Trophy' WHERE slug = 'leisure-activities' AND parent_id IS NULL;
UPDATE public.classified_categories SET icon = 'Baby' WHERE slug = 'babies-kids' AND parent_id IS NULL;
UPDATE public.classified_categories SET icon = 'Car' WHERE slug = 'vehicles' AND parent_id IS NULL;

-- Electronics subcategories
UPDATE public.classified_categories SET icon = 'Laptop' WHERE slug = 'laptops-computers';
UPDATE public.classified_categories SET icon = 'Tv' WHERE slug = 'tv-video-equipment';
UPDATE public.classified_categories SET icon = 'Gamepad2' WHERE slug = 'video-game-consoles';
UPDATE public.classified_categories SET icon = 'Music' WHERE slug = 'audio-music-equipment';
UPDATE public.classified_categories SET icon = 'Headphones' WHERE slug = 'headphones';
UPDATE public.classified_categories SET icon = 'Camera' WHERE slug = 'photo-video-cameras';
UPDATE public.classified_categories SET icon = 'VideoIcon' WHERE slug = 'security-surveillance';
UPDATE public.classified_categories SET icon = 'Wifi' WHERE slug = 'networking-products';
UPDATE public.classified_categories SET icon = 'Printer' WHERE slug = 'printers-scanners';
UPDATE public.classified_categories SET icon = 'Monitor' WHERE slug = 'computer-monitors';
UPDATE public.classified_categories SET icon = 'Smartphone' WHERE slug = 'mobile-phones-accessories';

-- Home, Furniture & Appliances subcategories
UPDATE public.classified_categories SET icon = 'Chair' WHERE slug = 'furniture';
UPDATE public.classified_categories SET icon = 'Lightbulb' WHERE slug = 'lighting';
UPDATE public.classified_categories SET icon = 'BoxIcon' WHERE slug = 'storage-organization';
UPDATE public.classified_categories SET icon = 'Home' WHERE slug = 'home-accessories';
UPDATE public.classified_categories SET icon = 'Microwave' WHERE slug = 'home-appliances';
UPDATE public.classified_categories SET icon = 'UtensilsCrossed' WHERE slug = 'kitchen-appliances';
UPDATE public.classified_categories SET icon = 'UtensilsCrossed' WHERE slug = 'kitchenware-cookware';
UPDATE public.classified_categories SET icon = 'Droplet' WHERE slug = 'household-chemicals';
UPDATE public.classified_categories SET icon = 'Leaf' WHERE slug = 'garden-supplies';

-- Fashion subcategories
UPDATE public.classified_categories SET icon = 'Dress' WHERE slug = 'womens-fashion';
UPDATE public.classified_categories SET icon = 'Shirt' WHERE slug = 'mens-fashion';
UPDATE public.classified_categories SET icon = 'Baby' WHERE slug = 'baby-kids-fashion';

-- Beauty & Personal Care subcategories
UPDATE public.classified_categories SET icon = 'Scissors' WHERE slug = 'hair-beauty';
UPDATE public.classified_categories SET icon = 'Droplet' WHERE slug = 'face-care';
UPDATE public.classified_categories SET icon = 'Smile' WHERE slug = 'oral-care';
UPDATE public.classified_categories SET icon = 'Droplets' WHERE slug = 'body-care';
UPDATE public.classified_categories SET icon = 'Flower' WHERE slug = 'fragrance';
UPDATE public.classified_categories SET icon = 'Palette' WHERE slug = 'makeup';
UPDATE public.classified_categories SET icon = 'Pill' WHERE slug = 'vitamins-supplements';

-- Repair & Construction subcategories
UPDATE public.classified_categories SET icon = 'Zap' WHERE slug = 'electrical-equipment';
UPDATE public.classified_categories SET icon = 'Brick' WHERE slug = 'building-materials-supplies';
UPDATE public.classified_categories SET icon = 'Droplet' WHERE slug = 'plumbing-water-systems';
UPDATE public.classified_categories SET icon = 'Hammer' WHERE slug = 'hand-tools';
UPDATE public.classified_categories SET icon = 'Bolt' WHERE slug = 'hardware-fasteners';
UPDATE public.classified_categories SET icon = 'DoorOpen' WHERE slug = 'doors-security';

-- Babies & Kids subcategories
UPDATE public.classified_categories SET icon = 'Gamepad2' WHERE slug = 'toys-games';
UPDATE public.classified_categories SET icon = 'Bed' WHERE slug = 'childrens-furniture';
UPDATE public.classified_categories SET icon = 'Shirt' WHERE slug = 'childrens-clothing';
UPDATE public.classified_categories SET icon = 'Footprints' WHERE slug = 'childrens-shoes';
UPDATE public.classified_categories SET icon = 'Backpack' WHERE slug = 'babies-kids-accessories';
UPDATE public.classified_categories SET icon = 'Stroller' WHERE slug = 'baby-gear-equipment';
UPDATE public.classified_categories SET icon = 'Baby' WHERE slug = 'care-feeding';
UPDATE public.classified_categories SET icon = 'Heart' WHERE slug = 'maternity-pregnancy';
UPDATE public.classified_categories SET icon = 'Car' WHERE slug = 'transport-safety';
UPDATE public.classified_categories SET icon = 'Smile' WHERE slug = 'playground-equipment';
UPDATE public.classified_categories SET icon = 'BookOpen' WHERE slug = 'child-care-education';

-- Leisure & Activities subcategories
UPDATE public.classified_categories SET icon = 'Zap' WHERE slug = 'personal-mobility';
UPDATE public.classified_categories SET icon = 'Trophy' WHERE slug = 'sports-equipment';
UPDATE public.classified_categories SET icon = 'Hand' WHERE slug = 'massagers';
UPDATE public.classified_categories SET icon = 'Music' WHERE slug = 'musical-instruments-gear';
UPDATE public.classified_categories SET icon = 'BookOpen' WHERE slug = 'books-table-games';
UPDATE public.classified_categories SET icon = 'Palette' WHERE slug = 'arts-crafts-awards';
UPDATE public.classified_categories SET icon = 'Tent' WHERE slug = 'outdoor-gear';
UPDATE public.classified_categories SET icon = 'Cigarette' WHERE slug = 'smoking-accessories';
UPDATE public.classified_categories SET icon = 'Film' WHERE slug = 'music-video';
UPDATE public.classified_categories SET icon = 'Dumbbell' WHERE slug = 'fitness-personal-training';

-- Vehicles subcategories
UPDATE public.classified_categories SET icon = 'Settings' WHERE slug = 'vehicle-parts-accessories';
UPDATE public.classified_categories SET icon = 'Car' WHERE slug = 'cars';
UPDATE public.classified_categories SET icon = 'Bike' WHERE slug = 'motorcycles-scooters';
UPDATE public.classified_categories SET icon = 'Bus' WHERE slug = 'buses-microbuses';
UPDATE public.classified_categories SET icon = 'Truck' WHERE slug = 'trucks-trailers';
UPDATE public.classified_categories SET icon = 'Hammer' WHERE slug = 'construction-heavy-machinery';
UPDATE public.classified_categories SET icon = 'Anchor' WHERE slug = 'watercraft-boats';
UPDATE public.classified_categories SET icon = 'Wrench' WHERE slug = 'car-services';

-- Commercial Equipment & Tools subcategories
UPDATE public.classified_categories SET icon = 'Hammer' WHERE slug = 'heavy-machinery';
UPDATE public.classified_categories SET icon = 'Zap' WHERE slug = 'power-tools';
UPDATE public.classified_categories SET icon = 'Wrench' WHERE slug = 'hand-tools-equipment';
UPDATE public.classified_categories SET icon = 'Monitor' WHERE slug = 'office-equipment-furniture';
UPDATE public.classified_categories SET icon = 'Zap' WHERE slug = 'industrial-generators';
UPDATE public.classified_categories SET icon = 'Flame' WHERE slug = 'welding-fabrication';
UPDATE public.classified_categories SET icon = 'Droplet' WHERE slug = 'pumps-water-equipment';
UPDATE public.classified_categories SET icon = 'Wind' WHERE slug = 'compressors-air-tools';
UPDATE public.classified_categories SET icon = 'Shield' WHERE slug = 'safety-equipment';
UPDATE public.classified_categories SET icon = 'Settings' WHERE slug = 'hydraulic-equipment';
UPDATE public.classified_categories SET icon = 'Factory' WHERE slug = 'workshop-machinery';
UPDATE public.classified_categories SET icon = 'BoxIcon' WHERE slug = 'material-handling';
