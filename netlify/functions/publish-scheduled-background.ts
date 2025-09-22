import { Config } from "@netlify/functions"
import { createClient } from '@supabase/supabase-js';
import { SocialMediaService } from '../../src/lib/social-media-service';

async function processBatch(supabase: any, posts: any[], batchSize: number = 5) {
  // Initialize social media service with service role
  const socialMediaService = new SocialMediaService(supabase, true);

  for (let i = 0; i < posts.length; i += batchSize) {
    const batch = posts.slice(i, i + batchSize);
    console.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(posts.length / batchSize)}`);
    
    await Promise.all(batch.map(async (post) => {
      try {
        console.log('Processing post:', {
          id: post.id,
          title: post.title,
          accountId: post.social_account_id,
          subreddit: post.subreddit
        });

        // Get the social account with access token
        const { data: account, error: accountError } = await supabase
          .from('social_accounts')
          .select('*')
          .eq('id', post.social_account_id)
          .single();

        if (accountError) {
          console.error('Error fetching account:', accountError);
          throw new Error('Failed to fetch social account: ' + accountError.message);
        }

        if (!account?.access_token) {
          throw new Error('Access token not found for account');
        }

        // Create the post with correct parameters
        const result = await socialMediaService.createPost(
          post.title || '',
          post.content || '',
          [{
            accountId: post.social_account_id,
            subreddit: post.subreddit || '',
            flairId: post.flair_id || undefined
          }],
          undefined, // images
          post.user_id, // userId
          undefined  // videos
        );

        console.log('Post creation result:', result);

        if (!result[0]?.success) {
          throw new Error(result[0]?.error || 'Failed to create post');
        }

        // Update post status
        const { error: updateError } = await supabase
          .from('posts')
          .update({
            status: 'published',
            published_at: new Date().toISOString(),
            error_message: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', post.id);

        if (updateError) {
          console.error('Error updating post status:', updateError);
          throw new Error('Failed to update post status: ' + updateError.message);
        }

        return { postId: post.id, success: true };
      } catch (error: any) {
        console.error(`Error processing post ${post.id}:`, error);
        
        let errorStatus = 'failed';
        let errorMessage = error.message;

        // Determine specific error status
        if (error.message?.toLowerCase().includes('karma')) {
          errorStatus = 'karma_insufficient';
        } else if (error.message?.toLowerCase().includes('rate limit')) {
          errorStatus = 'rate_limited';
        } else if (error.message?.toLowerCase().includes('subreddit')) {
          errorStatus = 'invalid_subreddit';
        }
        
        // Update post status with specific error
        const { error: updateError } = await supabase
          .from('posts')
          .update({
            status: errorStatus,
            error_message: errorMessage,
            updated_at: new Date().toISOString(),
            published_at: null
          })
          .eq('id', post.id);

        if (updateError) {
          console.error('Error updating error status:', updateError);
        }

        return { postId: post.id, success: false, error: errorMessage, status: errorStatus };
      }
    }));

    // Add a small delay between batches to avoid rate limits
    if (i + batchSize < posts.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

export default async (req: Request) => {
  console.log('Netlify scheduled function triggered at:', new Date().toISOString());
  console.log('Environment check:', {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Present' : 'Missing',
    serviceRole: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Present' : 'Missing'
  });
  
  try {
    // Initialize Supabase client with service role
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        },
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
          }
        }
      }
    );

    // Verify service role connection
    console.log('Testing service role connection...');
    const { data: testConnection, error: testError } = await supabase
      .from('posts')
      .select('count')
      .limit(1)
      .single();

    if (testError) {
      console.error('Service role connection test failed:', testError);
      throw new Error('Failed to connect with service role: ' + testError.message);
    }
    console.log('Service role connection successful');

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
    console.log('Checking for due posts before:', currentTime);
    
    const { data: duePosts, error } = await supabase
      .from('posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_for', currentTime)
      .order('scheduled_for', { ascending: true });

    if (error) {
      console.error('Error fetching due posts:', error);
      throw error;
    }
    
    if (!duePosts || duePosts.length === 0) {
      console.log('No posts due for publishing at:', currentTime);
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'No posts due for publishing',
          timestamp: currentTime
        })
      };
    }

    console.log(`Found ${duePosts.length} posts due for publishing`);
    console.log('Posts to process:', duePosts.map(p => ({
      id: p.id,
      title: p.title?.substring(0, 50),
      scheduled_for: p.scheduled_for,
      subreddit: p.subreddit
    })));

    // Process posts in batches
    await processBatch(supabase, duePosts);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Successfully processed ${duePosts.length} posts`,
        processedCount: duePosts.length,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error: any) {
    console.error('Error in scheduled post processing:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString()
      })
    };
  }
}

export const config: Config = {
  schedule: '*/3 * * * *'  // Run every 3 minutes
}