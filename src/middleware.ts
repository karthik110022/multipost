import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req: request, res });
  const { data: { session } } = await supabase.auth.getSession();

  const publicPaths = ['/auth/signin', '/auth/signup', '/auth/verify-email'];
  const isPublicPath = publicPaths.includes(request.nextUrl.pathname);

  // If user is not signed in and the current path is not public,
  // redirect the user to /auth/signin
  if (!session && !isPublicPath) {
    const redirectUrl = new URL('/auth/signin', request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // If user is signed in and trying to access a public path,
  // redirect them to /dashboard
  if (session && isPublicPath) {
    const redirectUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
