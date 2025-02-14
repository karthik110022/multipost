-- Create post_platforms table
create table if not exists public.post_platforms (
  id uuid default uuid_generate_v4() primary key,
  post_id uuid references public.posts(id) on delete cascade,
  social_account_id uuid references public.social_accounts(id) on delete cascade,
  platform_post_id text,
  status text not null default 'pending',
  error_message text,
  subreddit text,
  published_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add RLS policies
alter table public.post_platforms enable row level security;

-- Allow users to view their own post platforms
create policy "Users can view their own post platforms"
  on public.post_platforms for select
  using (
    auth.uid() in (
      select user_id 
      from public.social_accounts 
      where id = post_platforms.social_account_id
    )
  );

-- Allow users to insert their own post platforms
create policy "Users can insert their own post platforms"
  on public.post_platforms for insert
  with check (
    auth.uid() in (
      select user_id 
      from public.social_accounts 
      where id = social_account_id
    )
  );

-- Add indexes for better performance
create index if not exists idx_post_platforms_post_id on public.post_platforms(post_id);
create index if not exists idx_post_platforms_social_account_id on public.post_platforms(social_account_id);
create index if not exists idx_post_platforms_created_at on public.post_platforms(created_at desc);
