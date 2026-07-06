-- Ghana Regions & Cities for Marketplace Listings
-- Seed data: 16 administrative regions + major cities

BEGIN;

CREATE TABLE IF NOT EXISTS public.marketplace_ghana_regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_name TEXT NOT NULL UNIQUE,
    region_code TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.marketplace_ghana_cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id UUID NOT NULL REFERENCES public.marketplace_ghana_regions(id) ON DELETE CASCADE,
    city_name TEXT NOT NULL,
    CONSTRAINT unique_city_per_region UNIQUE(region_id, city_name)
);

-- Indexes
CREATE INDEX idx_marketplace_ghana_regions_name ON marketplace_ghana_regions(region_name);
CREATE INDEX idx_marketplace_ghana_cities_region ON marketplace_ghana_cities(region_id);
CREATE INDEX idx_marketplace_ghana_cities_name ON marketplace_ghana_cities(city_name);

-- Seed Ghana Regions
INSERT INTO marketplace_ghana_regions (region_name, region_code) VALUES
('Ahafo', 'AHA'),
('Ashanti', 'ASH'),
('Bono', 'BON'),
('Bono East', 'BOE'),
('Central', 'CEN'),
('Eastern', 'EAS'),
('Greater Accra', 'GAR'),
('North East', 'NOR'),
('Northern', 'NRT'),
('Oti', 'OTI'),
('Savannah', 'SAV'),
('Upper East', 'UEA'),
('Upper West', 'UEW'),
('Volta', 'VOL'),
('Western', 'WES'),
('Western North', 'WEN')
ON CONFLICT (region_name) DO NOTHING;

-- Seed Major Cities (by region)
INSERT INTO marketplace_ghana_cities (region_id, city_name)
SELECT r.id, cities.city FROM marketplace_ghana_regions r
CROSS JOIN (
    VALUES
    ('Greater Accra', 'Accra'),
    ('Greater Accra', 'Tema'),
    ('Greater Accra', 'Kasoa'),
    ('Ashanti', 'Kumasi'),
    ('Ashanti', 'Obuasi'),
    ('Ashanti', 'Ejisu'),
    ('Central', 'Cape Coast'),
    ('Central', 'Sekondi'),
    ('Central', 'Takoradi'),
    ('Eastern', 'Koforidua'),
    ('Eastern', 'New Juaben'),
    ('Volta', 'Ho'),
    ('Volta', 'Keta'),
    ('Northern', 'Tamale'),
    ('Northern', 'Yendi'),
    ('Upper East', 'Bolgatanga'),
    ('Upper East', 'Navrongo'),
    ('Upper West', 'Wa'),
    ('Bono', 'Sunyani'),
    ('Bono East', 'Techiman'),
    ('Ahafo', 'Goaso'),
    ('Oti', 'Dambai'),
    ('Savannah', 'Damongo'),
    ('North East', 'Nalerigu')
) AS cities(region, city)
WHERE r.region_name = cities.region
ON CONFLICT (region_id, city_name) DO NOTHING;

COMMIT;
