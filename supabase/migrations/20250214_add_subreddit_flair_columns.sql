-- Add subreddit and flair_id columns to post_platforms table
ALTER TABLE post_platforms
ADD COLUMN IF NOT EXISTS subreddit text,
ADD COLUMN IF NOT EXISTS flair_id text;
