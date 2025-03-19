import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { RedditService } from '@/lib/reddit-service';
import { env } from '@/config/env';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeNetlifyUrl(url: string): string {
  // If the URL is undefined or invalid, use the Netlify URL
  if (!url || url === 'undefined' || url === 'https://undefined') {
    return 'https://multpost.netlify.app';
  }

  // Handle all Netlify preview URL patterns
  if (url.includes('--multpost.netlify.app')) {
    // Extract the base domain without any preview prefixes
    const baseUrl = 'multpost.netlify.app';
    return `https://${baseUrl}`;
  }

  // If we're in production and the URL is localhost or invalid, use the Netlify URL
  if (process.env.NODE_ENV === 'production' && 
      (url.includes('localhost') || !url.startsWith('https://'))) {
    return 'https://multpost.netlify.app';
  }

  return url;
}

export async function GET(request: Request) {
  try {
    console.log('Reddit callback endpoint hit');
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');

    // Get the base URL for redirects
    let baseUrl = normalizeNetlifyUrl(env.NEXT_PUBLIC_APP_URL);

    // Ensure we're using HTTPS in production
    if (process.env.NODE_ENV === 'production' && !baseUrl.startsWith('https://')) {
      baseUrl = `https://${baseUrl.replace(/^https?:\/\//, '')}`;
    }

    console.log('Callback parameters:', {
      hasCode: !!code,
      error,
      state,
      url: request.url,
      originalUrl: env.NEXT_PUBLIC_APP_URL,
      normalizedUrl: baseUrl,
      isPreviewUrl: env.NEXT_PUBLIC_APP_URL.includes('--multpost.netlify.app'),
      environment: process.env.NODE_ENV
    });

    if (error) {
      console.error('Reddit OAuth error:', error);
      return NextResponse.redirect(
        new URL(`${baseUrl}/dashboard?error=${encodeURIComponent(error)}`)
      );
    }

    if (!code) {
      console.error('No code received from Reddit');
      return NextResponse.redirect(
        new URL(`${baseUrl}/dashboard?error=no_code`)
      );
    }

    console.log('Getting user session...');
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
            cookieStore.delete({ name, ...options });
          },
        },
      }
    );

    // Get the session instead of just the user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error('Session error:', sessionError);
      // Store the code in a cookie for later use
      cookieStore.set('reddit_auth_code', code, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
      return NextResponse.redirect(
        new URL(`${baseUrl}/auth/signin?redirect=/auth/callback/reddit`)
      );
    }

    const user = session.user;
    console.log('User session found:', { userId: user.id });

    console.log('Initializing Reddit service...');
    const redditService = new RedditService();

    console.log('Exchanging code for tokens...');
    try {
      const tokens = await redditService.exchangeCode(code);
      console.log('Token exchange successful:', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiresAt: tokens.expires_at
      });

      if (!tokens.access_token) {
        console.error('Failed to get access token');
        return NextResponse.redirect(
          new URL(`${baseUrl}/dashboard?error=token_error`)
        );
      }

      console.log('Getting Reddit user info...');
      const redditUser = await redditService.getUserInfo(tokens.access_token);
      console.log('Reddit user info received:', {
        username: redditUser.name,
        userId: redditUser.id
      });

      console.log('Storing Reddit connection in database...');
      const { error: dbError } = await supabase.from('social_accounts').upsert({
        user_id: user.id,
        platform: 'reddit',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        account_name: redditUser.name,
        account_id: redditUser.id,
        token_expires: new Date(tokens.expires_at).toISOString(),
      });

      if (dbError) {
        console.error('Database error:', dbError);
        return NextResponse.redirect(
          new URL(`${baseUrl}/dashboard?error=db_error`)
        );
      }

      console.log('Reddit account connection successful');
      return NextResponse.redirect(new URL(`${baseUrl}/dashboard?success=true`));
    } catch (error) {
      console.error('Error during token exchange or user info fetch:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return NextResponse.redirect(
        new URL(`${baseUrl}/dashboard?error=${encodeURIComponent(errorMessage)}`)
      );
    }
  } catch (error) {
    console.error('Reddit callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    const baseUrl = env.NEXT_PUBLIC_APP_URL.includes('--multpost.netlify.app') 
      ? 'https://multpost.netlify.app' 
      : env.NEXT_PUBLIC_APP_URL;
    return NextResponse.redirect(
      new URL(`${baseUrl}/dashboard?error=${encodeURIComponent(errorMessage)}`)
    );
  }
}
