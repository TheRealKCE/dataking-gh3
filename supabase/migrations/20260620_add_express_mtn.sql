ALTER TABLE data_packages DROP CONSTRAINT IF EXISTS data_packages_network_check;
ALTER TABLE data_packages DROP CONSTRAINT IF EXISTS data_packages_network_check1;
ALTER TABLE data_packages ADD CONSTRAINT data_packages_network_check CHECK (network IN ('MTN', 'Telecel', 'AT-iShare', 'AT-BigTime', 'Special MTN Mashup', 'EXPRESS MTN'));
