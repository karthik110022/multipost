-- Create subreddit_analytics table
CREATE TABLE IF NOT EXISTS public.subreddit_analytics (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    subreddit text NOT NULL UNIQUE,
    post_count integer DEFAULT 0,
    last_post_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_subreddit_analytics_subreddit ON public.subreddit_analytics(subreddit);
CREATE INDEX IF NOT EXISTS idx_subreddit_analytics_post_count ON public.subreddit_analytics(post_count);

-- Add RLS policies
ALTER TABLE public.subreddit_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" ON public.subreddit_analytics
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.subreddit_analytics
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON public.subreddit_analytics
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true); 