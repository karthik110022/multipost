import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { RedditService } from '@/lib/reddit-service';

export async function GET(request: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    console.log('Reddit callback received:', { code, error }); // Debug log

    if (error) {
      console.error('Reddit auth error:', error); // Debug log
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/accounts?error=${error}`
      );
    }

    if (!code) {
      console.error('No code received from Reddit'); // Debug log
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/accounts?error=missing_code`
      );
    }

    // Get the user from Supabase auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError); // Debug log
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/auth/signin?error=auth_required`
      );
    }

    // Initialize Reddit service
    const redditService = new RedditService();

    // Exchange the code for tokens
    console.log('Exchanging code for tokens...'); // Debug log
    const tokens = await redditService.exchangeCode(code);
    console.log('Tokens received'); // Debug log

    // Get user info from Reddit
    console.log('Getting Reddit user info...'); // Debug log
    const userInfo = await redditService.getUserInfo(tokens.access_token);
    console.log('Reddit user info received:', userInfo); // Debug log

    // First check if account exists
    const { data: existingAccount, error: lookupError } = await supabase
      .from('social_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('platform', 'reddit')
      .eq('account_id', userInfo.id)
      .single();

    if (lookupError && lookupError.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error looking up account:', lookupError);
      throw lookupError;
    }

    if (existingAccount) {
      // Update existing account
      const { error: updateError } = await supabase
        .from('social_accounts')
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires: new Date(tokens.expires_at).toISOString(),
          account_name: userInfo.name,
        })
        .eq('id', existingAccount.id);

      if (updateError) {
        console.error('Error updating account:', updateError);
        throw updateError;
      }
      
      console.log('Updated existing account');
    } else {
      // Create new account
      const { error: insertError } = await supabase
        .from('social_accounts')
        .insert({
          user_id: user.id,
          platform: 'reddit',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires: new Date(tokens.expires_at).toISOString(),
          account_name: userInfo.name,
          account_id: userInfo.id,
        });

      if (insertError) {
        console.error('Error inserting account:', insertError);
        throw insertError;
      }
      
      console.log('Created new account');
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/accounts?success=true`);
  } catch (err) {
    console.error('Error in Reddit callback:', err);
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/accounts?error=${encodeURIComponent(errorMessage)}`
    );
  }
}
