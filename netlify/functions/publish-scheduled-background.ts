import { Config } from "@netlify/functions"
import { createClient } from '@supabase/supabase-js';
import { socialMediaService } from '../../src/lib/social-media-service';

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
            error_message: result[0]?.error || null
          })
          .eq('id', post.id);

        return { postId: post.id, success: true };
      } catch (error: any) {
        console.error(`Error processing post ${post.id}:`, error);
        
        // Update post status to failed
        await supabase
          .from('posts')
          .update({
            status: 'failed',
            error_message: error.message
          })
          .eq('id', post.id);

        return { postId: post.id, success: false, error: error.message };
      }
    }));

    // Add a small delay between batches to avoid rate limits
    if (i + batchSize < posts.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

export default async (req: Request) => {
  try {
    // Initialize Supabase client with service role
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false }
      }
    );

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
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No posts due for publishing' })
      };
    }

    // Process posts in batches
    await processBatch(supabase, duePosts);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: `Successfully processed ${duePosts.length} posts`,
        processedCount: duePosts.length
      })
    };
  } catch (error: any) {
    console.error('Error in scheduled post processing:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}

export const config: Config = {
  schedule: '@hourly'
} 