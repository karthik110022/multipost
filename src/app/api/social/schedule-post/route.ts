import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    console.log('Scheduling request body:', body);
    const { content, title, posts, scheduledFor } = body;

    if (!scheduledFor) {
      return NextResponse.json(
        { error: 'Scheduled time is required' },
        { status: 400 }
      );
    }

    // Create a scheduled post entry for each platform
    const results = await Promise.all(
      posts.map(async (post: any) => {
        try {
          console.log('Creating scheduled post:', {
            user_id: session.user.id,
            content,
            title,
            scheduledFor,
            accountId: post.accountId,
            subreddit: post.subreddit
          });

          const { data, error } = await supabase
            .from('posts')
            .insert({
              user_id: session.user.id,
              content,
              title,
              status: 'scheduled',
              scheduled_for: scheduledFor, // Already in ISO format from the client
              social_account_id: post.accountId,
              subreddit: post.subreddit,
              flair_id: post.flairId
            })
            .select()
            .single();

          if (error) {
            console.error('Supabase error:', error);
            throw error;
          }

          console.log('Created post:', data);

          return {
            success: true,
            platformPostId: data.id,
            accountId: post.accountId,
            subreddit: post.subreddit
          };
        } catch (error: any) {
          console.error('Error scheduling post:', error);
          return {
            success: false,
            error: error.message,
            accountId: post.accountId,
            subreddit: post.subreddit
          };
        }
      })
    );

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('Error in schedule-post route:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to schedule posts' },
      { status: 500 }
    );
  }
}
