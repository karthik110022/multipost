import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { socialMediaService } from '@/lib/social-media-service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform');

  if (!platform) {
    return NextResponse.json({ error: 'Platform is required' }, { status: 400 });
  }

  if (platform !== 'reddit') {
    return NextResponse.json(
      { error: 'Only Reddit is supported' },
      { status: 400 }
    );
  }

  const authUrl = socialMediaService.getRedditAuthUrl();
  return NextResponse.redirect(authUrl);
}
