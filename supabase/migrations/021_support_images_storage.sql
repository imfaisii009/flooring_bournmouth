-- =====================================================
-- Support Images Storage Bucket
-- =====================================================

-- Create storage bucket for support chat images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-images',
  'support-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- =====================================================
-- Storage Policies for support-images bucket
-- =====================================================

-- Policy: Anyone can view images (public bucket)
CREATE POLICY "Public Access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'support-images');

-- Policy: Service role can upload images
CREATE POLICY "Service role can upload support images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'support-images');

-- Policy: Service role can update images
CREATE POLICY "Service role can update support images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'support-images');

-- Policy: Service role can delete images
CREATE POLICY "Service role can delete support images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'support-images');
