import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { RedditService } from '@/lib/reddit-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    console.log('Reddit callback received:', { code, error }); // Debug log

    if (error) {
      console.error('Reddit OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/dashboard?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code) {
      console.error('No code received from Reddit'); // Debug log
      return NextResponse.redirect(
        new URL('/dashboard?error=no_code', request.url)
      );
    }

    const cookieStore = await cookies(); // Fix: await cookies()
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
      console.error('Auth error:', userError); // Debug log
      return NextResponse.redirect(
        new URL('/auth/signin?error=auth_required', request.url)
      );
    }

    const redditService = new RedditService();
    const tokens = await redditService.exchangeCode(code);

    console.log('Exchanging code for tokens...'); // Debug log
    console.log('Tokens received'); // Debug log

    if (!tokens.access_token) {
      console.error('Failed to get access token'); // Debug log
      return NextResponse.redirect(
        new URL('/dashboard?error=token_error', request.url)
      );
    }

    const redditUser = await redditService.getUserInfo(tokens.access_token);

    console.log('Getting Reddit user info...'); // Debug log
    console.log('Reddit user info received:', redditUser); // Debug log

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
      console.error('Database error:', dbError); // Debug log
      return NextResponse.redirect(
        new URL('/dashboard?error=db_error', request.url)
      );
    }

    return NextResponse.redirect(new URL('/dashboard?success=true', request.url));
  } catch (error) {
    console.error('Reddit callback error:', error); // Debug log
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.redirect(
      new URL(`/dashboard?error=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }
}
