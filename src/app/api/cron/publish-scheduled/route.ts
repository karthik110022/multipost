import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { ScheduledPostService } from '@/lib/scheduled-post-service';

export async function GET(request: Request) {
  try {
    // Initialize Supabase client
    const supabase = createRouteHandlerClient({ cookies });

    // Verify the request is authorized using service role key
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    if (secret !== process.env.CRON_SECRET) {
      console.log('Secret mismatch:', { 
        provided: secret,
        expected: process.env.CRON_SECRET
      });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const scheduledPostService = new ScheduledPostService();
    const results = await scheduledPostService.publishScheduledPosts();

    return NextResponse.json({
      success: true,
      results
    });
  } catch (error: any) {
    console.error('Error in publish-scheduled route:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to publish scheduled posts' },
      { status: 500 }
    );
  }
}
