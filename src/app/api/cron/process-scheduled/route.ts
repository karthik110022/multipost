import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { socialMediaService } from '@/lib/social-media-service';

// Allowed IPs from cron-job.org
const ALLOWED_IPS = [
  '116.203.134.67',
  '116.203.129.16',
  '23.88.105.37',
  '128.140.8.200'
];

async function processBatch(supabase: any, posts: any[], batchSize: number = 5) {
  for (let i = 0; i < posts.length; i += batchSize) {
    const batch = posts.slice(i, i + batchSize);
    console.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(posts.length / batchSize)}`);
    
    await Promise.all(batch.map(async (post) => {
      try {
        // Get the social account with access token
        const { data: account } = await supabase
          .from('social_accounts')
          .select('*')
          .eq('id', post.social_account_id)
          .single();

        if (!account?.access_token) {
          throw new Error('Access token not found for account');
        }

        // Create the post
        const result = await socialMediaService.createPost(
          post.title || '',
          post.content || '',
          [{
            accountId: post.social_account_id,
            subreddit: post.subreddit || '',
            flairId: post.flair_id || undefined
          }],
          post.user_id
        );

        // Update post status
        await supabase
          .from('posts')
          .update({
            status: result[0]?.success ? 'published' : 'failed',
            published_at: result[0]?.success ? new Date().toISOString() : null,
            error_message: result[0]?.error || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', post.id);

        return { postId: post.id, success: true };
      } catch (error: any) {
        console.error(`Error processing post ${post.id}:`, error);
        
        let errorStatus = 'failed';
        let errorMessage = error.message;

        // Determine specific error status
        if (error.message.includes('karma')) {
          errorStatus = 'karma_insufficient';
        } else if (error.message.includes('rate limit')) {
          errorStatus = 'rate_limited';
        } else if (error.message.includes('subreddit')) {
          errorStatus = 'invalid_subreddit';
        }
        
        // Update post status with specific error
        await supabase
          .from('posts')
          .update({
            status: errorStatus,
            error_message: errorMessage,
            updated_at: new Date().toISOString()
          })
          .eq('id', post.id);

        return { postId: post.id, success: false, error: errorMessage, status: errorStatus };
      }
    }));

    // Add a small delay between batches to avoid rate limits
    if (i + batchSize < posts.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

export async function POST(request: Request) {
  try {
    // Verify request is from cron-job.org
    const forwardedFor = request.headers.get('x-forwarded-for');
    const clientIP = forwardedFor ? forwardedFor.split(',')[0] : null;
    
    if (!clientIP || !ALLOWED_IPS.includes(clientIP)) {
      console.warn('Unauthorized IP attempt:', clientIP);
      return NextResponse.json(
        { error: 'Unauthorized IP' },
        { status: 403 }
      );
    }

    // Verify secret token
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.warn('Invalid authorization token');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false }
      }
    );

    // First, update any pending posts to scheduled
    const { data: pendingPosts, error: pendingError } = await supabase
      .from('posts')
      .update({ 
        status: 'scheduled',
        updated_at: new Date().toISOString()
      })
      .eq('status', 'pending')
      .not('scheduled_for', 'is', null)
      .select();

    if (pendingError) {
      console.error('Error updating pending posts:', pendingError);
    } else if (pendingPosts && pendingPosts.length > 0) {
      console.log(`Updated ${pendingPosts.length} pending posts to scheduled`);
    }

    // Get all due posts
    const currentTime = new Date().toISOString();
    const { data: duePosts, error } = await supabase
      .from('posts')
      .select('*, social_accounts(*)')
      .eq('status', 'scheduled')
      .lte('scheduled_for', currentTime)
      .order('scheduled_for', { ascending: true });

    if (error) throw error;
    if (!duePosts || duePosts.length === 0) {
      return NextResponse.json({
        message: 'No posts due for publishing',
        timestamp: currentTime
      });
    }

    // Process posts in batches
    await processBatch(supabase, duePosts);

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${duePosts.length} posts`,
      processedCount: duePosts.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error in scheduled post processing:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 