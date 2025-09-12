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

    // Handle both JSON and FormData requests
    let title: string, content: string, posts: any[], images: File[] = [], videos: File[] = [];
    
    const contentType = request.headers.get('content-type');
    
    if (contentType?.includes('multipart/form-data')) {
      // Handle FormData (with media files)
      const formData = await request.formData();
      title = formData.get('title') as string;
      content = formData.get('content') as string;
      posts = JSON.parse(formData.get('posts') as string);
      
      // Extract media files (images and videos)
      const mediaCount = parseInt(formData.get('mediaCount') as string || '0');
      for (let i = 0; i < mediaCount; i++) {
        const mediaFile = formData.get(`media_${i}`) as File;
        if (mediaFile) {
          // Separate images and videos
          if (mediaFile.type.startsWith('video/')) {
            videos.push(mediaFile);
          } else if (mediaFile.type.startsWith('image/')) {
            images.push(mediaFile);
          }
        }
      }
    } else {
      // Handle JSON (text-only posts)
      const body = await request.json();
      ({ title, content, posts } = body);
    }

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
    // Pass both images and videos if provided
    const result = await socialMediaService.createPost(
      title, 
      content, 
      posts, 
      images.length > 0 ? images : undefined, 
      user.id,
      videos.length > 0 ? videos : undefined
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error creating post:', error);
    return new NextResponse(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500 }
    );
  }
}
