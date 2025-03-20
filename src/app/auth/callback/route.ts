import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getSiteUrl(requestUrl: string): string {
  const url = new URL(requestUrl);
  // If we're on Netlify (production or preview)
  if (url.hostname.includes('netlify.app')) {
    return 'https://multpost.netlify.app';
  }
  return url.origin;
}

export async function GET(request: Request) {
  try {
    console.log('Email verification callback initiated');
    const { searchParams } = new URL(request.url);
    const token_hash = searchParams.get('token_hash');
    const type = searchParams.get('type');
    const next = searchParams.get('next') ?? '/dashboard';
    const siteUrl = getSiteUrl(request.url);

    console.log('Callback parameters:', {
      hasTokenHash: !!token_hash,
      type,
      next,
      fullUrl: request.url,
      siteUrl
    });

    if (token_hash && type) {
      console.log('Verifying token...');
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

      const { data, error } = await supabase.auth.verifyOtp({
        token_hash,
        type: type as any,
      });

      console.log('Verification result:', { data, error });

      if (error) {
        console.error('Verification error:', error);
        return NextResponse.redirect(
          new URL(`${siteUrl}/auth/signin?error=${encodeURIComponent(error.message)}`)
        );
      }

      console.log('Verification successful, redirecting to:', next);
      return NextResponse.redirect(new URL(`${siteUrl}${next}`));
    }

    console.log('Missing token_hash or type, redirecting to signin');
    return NextResponse.redirect(new URL(`${siteUrl}/auth/signin`));
  } catch (error) {
    console.error('Auth callback error:', error);
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://multpost.netlify.app';
    return NextResponse.redirect(
      new URL(`${siteUrl}/auth/signin?error=Something went wrong`)
    );
  }
} 