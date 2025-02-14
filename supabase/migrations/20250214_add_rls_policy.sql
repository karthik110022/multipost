-- Enable RLS
ALTER TABLE post_platforms ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see their own posts
CREATE POLICY "Users can view their own posts"
ON post_platforms
FOR SELECT
USING (
  social_account_id IN (
    SELECT id FROM social_accounts
    WHERE user_id = auth.uid()
  )
);

-- Create policy to allow users to insert their own posts
CREATE POLICY "Users can insert their own posts"
ON post_platforms
FOR INSERT
WITH CHECK (
  social_account_id IN (
    SELECT id FROM social_accounts
    WHERE user_id = auth.uid()
  )
);

-- Create policy to allow users to update their own posts
CREATE POLICY "Users can update their own posts"
ON post_platforms
FOR UPDATE
USING (
  social_account_id IN (
    SELECT id FROM social_accounts
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  social_account_id IN (
    SELECT id FROM social_accounts
    WHERE user_id = auth.uid()
  )
);

-- Create policy to allow users to delete their own posts
CREATE POLICY "Users can delete their own posts"
ON post_platforms
FOR DELETE
USING (
  social_account_id IN (
    SELECT id FROM social_accounts
    WHERE user_id = auth.uid()
  )
);
