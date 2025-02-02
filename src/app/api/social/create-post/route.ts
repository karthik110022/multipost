import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import { SocialMediaService } from '@/lib/social-media-service';

export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const socialMediaService = new SocialMediaService(supabase);

    const { accountIds, content, title, subreddit, flairId } = await request.json();

    if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
      return NextResponse.json({ error: 'No accounts selected' }, { status: 400 });
    }

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Create the post
    await socialMediaService.createPost(accountIds, content, title, subreddit, flairId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error creating post:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create post' },
      { status: 500 }
    );
  }
}
