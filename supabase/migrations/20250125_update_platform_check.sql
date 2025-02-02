-- Drop the existing check constraint
ALTER TABLE social_accounts 
DROP CONSTRAINT IF EXISTS social_accounts_platform_check;

-- Add the new check constraint with reddit
ALTER TABLE social_accounts 
ADD CONSTRAINT social_accounts_platform_check 
CHECK (platform IN ('reddit', 'twitter', 'facebook', 'linkedin', 'instagram'));
