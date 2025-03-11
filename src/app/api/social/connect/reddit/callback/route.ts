import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { RedditService } from '@/lib/reddit-service';

export async function GET(request: Request) {
  console.log('Reddit OAuth callback initiated');
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');

  console.log('Callback params:', { code: !!code, error, state });

  if (error) {
    console.error('Reddit OAuth error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/accounts?error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    console.error('No authorization code received from Reddit');
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/accounts?error=no_code`
    );
  }

  try {
    console.log('Getting user session...');
    // Get the user from Supabase auth
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set(name, value, options);
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set(name, '', options);
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error('No authenticated user found');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/accounts?error=auth_required`
      );
    }

    console.log('Exchanging code for tokens...');
    // Exchange code for tokens
    const redditService = new RedditService();
    const tokens = await redditService.exchangeCode(code);
    console.log('Token exchange successful');

    console.log('Getting Reddit user info...');
    // Get Reddit user info
    const userInfo = await redditService.getUserInfo(tokens.access_token);
    console.log('Got Reddit user info:', { username: userInfo.name });

    // Check if this Reddit account is already connected
    console.log('Checking for existing connection...');
    const { data: existingAccount } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('account_id', userInfo.id)
      .maybeSingle();

    if (existingAccount) {
      console.log('Account already connected:', existingAccount);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/accounts?error=already_connected`
      );
    }

    console.log('Storing connection in database...');
    // Store the connection in the database
    const { error: dbError } = await supabase
      .from('social_accounts')
      .insert({
        user_id: user.id,
        platform: 'reddit',
        account_name: userInfo.name,
        account_id: userInfo.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expires_at,
      });

    if (dbError) {
      console.error('Error storing Reddit connection:', dbError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/accounts?error=connection_failed`
      );
    }

    console.log('Reddit account connected successfully');
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/accounts?success=true`
    );
  } catch (error) {
    console.error('Error connecting Reddit account:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/accounts?error=${encodeURIComponent(errorMessage)}`
    );
  }
}
