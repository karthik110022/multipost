import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const cookieStore = cookies();
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          detectSessionInUrl: false
        },
        global: {
          headers: {
            'Cookie': cookieStore.toString()
          }
        }
      }
    );

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('Not authenticated');

    // Get post statistics
    const { data: posts, error: postsError } = await supabase
      .from('post_platforms')
      .select(`
        id,
        post_id,
        platform_post_id,
        status,
        error_message,
        published_at,
        subreddit,
        posts (
          title,
          content
        ),
        social_accounts (
          account_name,
          platform
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (postsError) throw postsError;

    return NextResponse.json(posts);
  } catch (error: any) {
    console.error('Error fetching post stats:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch post statistics' },
      { status: 500 }
    );
  }
}
