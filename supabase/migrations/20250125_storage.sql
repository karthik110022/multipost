-- Create a bucket for media uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true);

-- Allow authenticated users to upload media
CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own media
CREATE POLICY "Users can update their own media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own media
CREATE POLICY "Users can delete their own media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public access to media files
CREATE POLICY "Public access to media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'media');
