import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { RedditService } from '@/lib/reddit-service';

export async function GET(request: Request) {
  try {
    console.log('Reddit callback endpoint hit');
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');

    console.log('Callback parameters:', {
      hasCode: !!code,
      error,
      state,
      url: request.url
    });

    if (error) {
      console.error('Reddit OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/dashboard?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code) {
      console.error('No code received from Reddit');
      return NextResponse.redirect(
        new URL('/dashboard?error=no_code', request.url)
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

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('Auth error:', userError);
      return NextResponse.redirect(
        new URL('/auth/signin?error=auth_required', request.url)
      );
    }

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
          new URL('/dashboard?error=token_error', request.url)
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
          new URL('/dashboard?error=db_error', request.url)
        );
      }

      console.log('Reddit account connection successful');
      return NextResponse.redirect(new URL('/dashboard?success=true', request.url));
    } catch (error) {
      console.error('Error during token exchange or user info fetch:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return NextResponse.redirect(
        new URL(`/dashboard?error=${encodeURIComponent(errorMessage)}`, request.url)
      );
    }
  } catch (error) {
    console.error('Reddit callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.redirect(
      new URL(`/dashboard?error=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }
}
