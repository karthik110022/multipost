-- Drop existing policies if they exist
drop policy if exists "Users can view their own posts" on public.posts;
drop policy if exists "Users can view their own post platforms" on public.post_platforms;

-- Create or update posts table
create table if not exists public.posts (
  id uuid default uuid_generate_v4() primary key,
  content text not null,
  media_urls text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS and add policy for posts
alter table public.posts enable row level security;
create policy "Users can view their own posts"
  on public.posts for select
  using (
    auth.uid() in (
      select user_id 
      from public.social_accounts sa
      join public.post_platforms pp on pp.social_account_id = sa.id
      where pp.post_id = posts.id
    )
  );

-- Create or update post_platforms table
create table if not exists public.post_platforms (
  id uuid default uuid_generate_v4() primary key,
  post_id uuid references public.posts(id) on delete cascade,
  social_account_id uuid references public.social_accounts(id) on delete cascade,
  platform_post_id text,
  status text not null default 'pending',
  error_message text,
  subreddit text,
  published_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS and add policy for post_platforms
alter table public.post_platforms enable row level security;
create policy "Users can view their own post platforms"
  on public.post_platforms for select
  using (
    auth.uid() in (
      select user_id 
      from public.social_accounts 
      where id = post_platforms.social_account_id
    )
  );

-- Add insert policies
create policy if not exists "Users can insert their own posts"
  on public.posts for insert
  with check (true);  -- We'll control access through post_platforms

create policy if not exists "Users can insert their own post platforms"
  on public.post_platforms for insert
  with check (
    auth.uid() in (
      select user_id 
      from public.social_accounts 
      where id = social_account_id
    )
  );

-- Add delete policies
create policy if not exists "Users can delete their own posts"
  on public.posts for delete
  using (
    auth.uid() in (
      select user_id 
      from public.social_accounts sa
      join public.post_platforms pp on pp.social_account_id = sa.id
      where pp.post_id = posts.id
    )
  );

create policy if not exists "Users can delete their own post platforms"
  on public.post_platforms for delete
  using (
    auth.uid() in (
      select user_id 
      from public.social_accounts 
      where id = social_account_id
    )
  );
