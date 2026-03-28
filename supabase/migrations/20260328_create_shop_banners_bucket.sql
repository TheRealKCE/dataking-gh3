-- Enable public access to the shop-banners bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('shop-banners', 'shop-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow anyone to view shop-banners files
CREATE POLICY "Shop Banners Public Read" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'shop-banners');

-- Policy to allow authenticated users to insert files to their own folder within shop-banners
CREATE POLICY "Shop Banners Auth Insert" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
    bucket_id = 'shop-banners' 
    AND (auth.uid()::text = (storage.foldername(name))[1])
);

-- Policy to allow authenticated users to update files in their own folder
CREATE POLICY "Shop Banners Auth Update" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (
    bucket_id = 'shop-banners' 
    AND (auth.uid()::text = (storage.foldername(name))[1])
);

-- Policy to allow authenticated users to delete files in their own folder
CREATE POLICY "Shop Banners Auth Delete" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
    bucket_id = 'shop-banners' 
    AND (auth.uid()::text = (storage.foldername(name))[1])
);
