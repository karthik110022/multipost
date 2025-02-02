import { createServerClient } from '@supabase/ssr';
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

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      redirect('/auth/signin?error=auth_required');
    }

    // Exchange the code for tokens
    const redditService = new RedditService();
    const tokens = await redditService.exchangeCode(code);

    // Get user info from Reddit
    const userInfo = await redditService.getUserInfo(tokens.access_token);

    // Store the connection in Supabase
    const { error: dbError } = await supabase.from('social_accounts').upsert({
      user_id: session.user.id,
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
