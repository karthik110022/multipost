import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { RedditService } from '@/lib/reddit-service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/accounts?error=${error}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/accounts?error=missing_code`
    );
  }

  try {
    // Get the user from Supabase auth
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/auth/signin?error=auth_required`
      );
    }

    // Exchange the code for tokens
    const redditService = new RedditService();
    const tokens = await redditService.exchangeCode(code);

    // Get user info from Reddit
    const userInfo = await redditService.getUserInfo(tokens.access_token);

    // Store the connection in Supabase
    const { error: dbError } = await supabase.from('social_accounts').upsert({
      user_id: user.id,
      platform: 'reddit',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires: new Date(tokens.expires_at).toISOString(),
      account_name: userInfo.name,
      account_id: userInfo.id,
    });

    if (dbError) {
      throw dbError;
    }

    // Redirect back to accounts page
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/accounts?success=true`
    );
  } catch (error) {
    console.error('Error connecting Reddit account:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/accounts?error=connection_failed`
    );
  }
}
