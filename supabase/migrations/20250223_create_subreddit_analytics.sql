-- Create enum for day of week
CREATE TYPE day_of_week AS ENUM ('sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday');

-- Create table for subreddit activity data
CREATE TABLE subreddit_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subreddit TEXT NOT NULL,
    day_of_week day_of_week NOT NULL,
    hour_of_day INTEGER CHECK (hour_of_day >= 0 AND hour_of_day < 24),
    active_users INTEGER DEFAULT 0,
    post_count INTEGER DEFAULT 0,
    avg_score FLOAT DEFAULT 0,
    avg_comments FLOAT DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Composite unique constraint
    UNIQUE(subreddit, day_of_week, hour_of_day)
);

-- Add RLS policies
ALTER TABLE subreddit_analytics ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY "Allow read access for authenticated users" 
    ON subreddit_analytics
    FOR SELECT
    TO authenticated
    USING (true);

-- Create function to update analytics
CREATE OR REPLACE FUNCTION update_subreddit_analytics(
    p_subreddit TEXT,
    p_day_of_week day_of_week,
    p_hour_of_day INTEGER,
    p_active_users INTEGER,
    p_post_count INTEGER,
    p_score INTEGER,
    p_comments INTEGER
) RETURNS void AS $$
BEGIN
    INSERT INTO subreddit_analytics (
        subreddit,
        day_of_week,
        hour_of_day,
        active_users,
        post_count,
        avg_score,
        avg_comments,
        last_updated
    ) VALUES (
        p_subreddit,
        p_day_of_week,
        p_hour_of_day,
        p_active_users,
        p_post_count,
        p_score,
        p_comments,
        NOW()
    )
    ON CONFLICT (subreddit, day_of_week, hour_of_day)
    DO UPDATE SET
        active_users = (subreddit_analytics.active_users + EXCLUDED.active_users) / 2,
        post_count = (subreddit_analytics.post_count + EXCLUDED.post_count) / 2,
        avg_score = (subreddit_analytics.avg_score + EXCLUDED.avg_score) / 2,
        avg_comments = (subreddit_analytics.avg_comments + EXCLUDED.avg_comments) / 2,
        last_updated = NOW();
END;
$$ LANGUAGE plpgsql;
