-- Create social_accounts table
CREATE TABLE social_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('reddit', 'twitter', 'facebook', 'linkedin', 'instagram')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires TIMESTAMP WITH TIME ZONE,
  account_name TEXT,
  account_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, platform, account_id)
);

-- Create posts table
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_urls TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scheduled_for TIMESTAMP WITH TIME ZONE
);

-- Create post_platforms table for tracking post status per platform
CREATE TABLE post_platforms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  social_account_id UUID REFERENCES social_accounts(id) ON DELETE CASCADE,
  platform_post_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'published', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(post_id, social_account_id)
);

-- Create RLS policies
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_platforms ENABLE ROW LEVEL SECURITY;

-- Social accounts policies
CREATE POLICY "Users can view their own social accounts"
  ON social_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own social accounts"
  ON social_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own social accounts"
  ON social_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own social accounts"
  ON social_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- Posts policies
CREATE POLICY "Users can view their own posts"
  ON posts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own posts"
  ON posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts"
  ON posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts"
  ON posts FOR DELETE
  USING (auth.uid() = user_id);

-- Post platforms policies
CREATE POLICY "Users can view their own post platforms"
  ON post_platforms FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM posts
    WHERE posts.id = post_platforms.post_id
    AND posts.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own post platforms"
  ON post_platforms FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM posts
    WHERE posts.id = post_platforms.post_id
    AND posts.user_id = auth.uid()
  ));
