import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import PostHistoryClient from '@/components/history/PostHistoryClient';

export default async function PostHistory() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set(name, value, options);
        },
        remove(name: string, options: any) {
          cookieStore.set(name, '', options);
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/signin');
  }

  // Fetch posts from Supabase
  const { data: posts } = await supabase
    .from('posts')
    .select(`
      *,
      post_platforms (
        id,
        platform_post_id,
        status,
        error_message,
        subreddit,
        social_account_id,
        published_at,
        social_accounts (
          id,
          platform,
          account_name,
          account_id
        )
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // Transform posts to include platform and status
  const transformedPosts = posts?.map(post => ({
    ...post,
    platform: post.post_platforms?.[0]?.social_accounts?.platform || 'reddit',
    status: post.post_platforms?.[0]?.status || 'pending'
  })) || [];

  return <PostHistoryClient user={user} initialPosts={transformedPosts} />;
}
