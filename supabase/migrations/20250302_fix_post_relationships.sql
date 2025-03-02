-- Add social_account_id and subreddit to posts table
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS social_account_id uuid REFERENCES public.social_accounts(id),
ADD COLUMN IF NOT EXISTS subreddit text;
