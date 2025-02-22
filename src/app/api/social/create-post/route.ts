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
    const { title, content, posts } = body;

    if (!title || !content || !posts || !Array.isArray(posts) || posts.length === 0) {
      return new NextResponse(
        JSON.stringify({ error: 'Missing required fields: title, content, and at least one post configuration are required' }),
        { status: 400 }
      );
    }

    // Validate each post configuration
    for (const post of posts) {
      if (!post.accountId || !post.subreddit) {
        return new NextResponse(
          JSON.stringify({ error: 'Each post configuration must include accountId and subreddit' }),
          { status: 400 }
        );
      }
    }

    const socialMediaService = new SocialMediaService(supabase);
    // Fix parameter order: title, content, posts (was passing content first)
    const result = await socialMediaService.createPost(title, content, posts);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error creating post:', error);
    return new NextResponse(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500 }
    );
  }
}
