-- Add new columns to posts table
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS flair_id text,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS scheduled_for timestamp with time zone,
ADD COLUMN IF NOT EXISTS published_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS error_message text;
