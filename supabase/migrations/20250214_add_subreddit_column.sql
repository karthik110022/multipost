-- Add subreddit column to post_platforms table
ALTER TABLE post_platforms
ADD COLUMN subreddit TEXT;
