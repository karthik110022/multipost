import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { RedditService } from '@/lib/reddit-service';
import { redirect } from 'next/navigation';

export default async function RedditCallback({
  searchParams,
}: {
  searchParams: { code?: string; error?: string };
}) {
  const { code, error } = searchParams;

  if (error) {
    redirect(`/accounts?error=${error}`);
  }

  if (!code) {
    redirect('/accounts?error=missing_code');
  }

  try {
    // Get the user from Supabase auth
    const supabase = createServerComponentClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect('/auth/signin?error=auth_required');
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

    redirect('/accounts?success=connected');
  } catch (error) {
    console.error('Error in Reddit callback:', error);
    redirect('/accounts?error=connection_failed');
  }
}
