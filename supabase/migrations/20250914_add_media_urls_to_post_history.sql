-- Add media URL columns to post_platforms table (where posts are actually stored)
ALTER TABLE public.post_platforms 
ADD COLUMN IF NOT EXISTS media_urls TEXT[], -- Array of Reddit media URLs (images/videos)
ADD COLUMN IF NOT EXISTS has_media BOOLEAN DEFAULT FALSE; -- Quick flag to check if post has media

-- Create index for better performance when querying posts with media
CREATE INDEX IF NOT EXISTS idx_post_platforms_has_media ON public.post_platforms(has_media) WHERE has_media = true;

-- Update existing posts to set has_media flag based on content analysis (optional)
UPDATE public.post_platforms 
SET has_media = FALSE 
WHERE has_media IS NULL;