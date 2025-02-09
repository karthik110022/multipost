import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SocialMediaService } from '@/lib/social-media-service';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
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
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, content, subreddit, accountIds, flairId } = body;

    if (!title || !content || !subreddit) {
      return new NextResponse(
        JSON.stringify({ error: 'Missing required fields: title, content, and subreddit are required' }),
        { status: 400 }
      );
    }

    const socialMediaService = new SocialMediaService(supabase);
    
    // If accountIds is provided, validate it's an array
    if (accountIds && (!Array.isArray(accountIds) || accountIds.length === 0)) {
      return new NextResponse(
        JSON.stringify({ error: 'If accountIds is provided, it must be a non-empty array' }),
        { status: 400 }
      );
    }

    const result = await socialMediaService.createPost(accountIds || null, content, title, subreddit, flairId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error creating post:', error);
    return new NextResponse(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500 }
    );
  }
}
