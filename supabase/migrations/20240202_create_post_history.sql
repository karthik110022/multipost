-- Create the post_history table if it doesn't exist
create or replace function public.create_post_history_if_not_exists()
returns void
language plpgsql
security definer
as $$
begin
  if not exists (select from pg_tables where schemaname = 'public' and tablename = 'post_history') then
    create table public.post_history (
      id uuid default uuid_generate_v4() primary key,
      social_account_id uuid references public.social_accounts(id) on delete cascade,
      platform text not null,
      content text not null,
      title text,
      subreddit text,
      post_url text,
      external_post_id text,
      status text not null,
      error_message text,
      created_at timestamp with time zone default timezone('utc'::text, now()) not null,
      updated_at timestamp with time zone default timezone('utc'::text, now()) not null
    );

    -- Add RLS policies
    alter table public.post_history enable row level security;

    -- Allow users to view their own post history
    create policy "Users can view their own post history"
      on public.post_history for select
      using (
        auth.uid() in (
          select user_id 
          from public.social_accounts 
          where id = post_history.social_account_id
        )
      );

    -- Allow users to insert their own post history
    create policy "Users can insert their own post history"
      on public.post_history for insert
      with check (
        auth.uid() in (
          select user_id 
          from public.social_accounts 
          where id = social_account_id
        )
      );

    -- Add indexes for better performance
    create index if not exists idx_post_history_social_account_id on public.post_history(social_account_id);
    create index if not exists idx_post_history_created_at on public.post_history(created_at desc);
    create index if not exists idx_post_history_account_created on public.post_history(social_account_id, created_at desc);
  end if;
end;
$$;

-- Execute the function
select public.create_post_history_if_not_exists();
