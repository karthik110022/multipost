import { createClient } from '@supabase/supabase-js';
import { socialMediaService, PostResult, SocialMediaService } from './social-media-service';

export class ScheduledPostService {
  private supabase;

  constructor() {
    // Use service role key for better permissions
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false
        }
      }
    );
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  }

  async publishScheduledPosts() {
    try {
      console.log('Starting publishScheduledPosts...');
      // Get all posts that are scheduled and due
      // Log current time for debugging
      console.log('Current time:', new Date().toISOString());

      // First get all posts to see what's in the database
      const { data: allPosts, error: allPostsError } = await this.supabase
        .from('posts')
        .select('id, title, scheduled_for, status');

      console.log('All posts in database:', allPosts);

      // Then get scheduled posts
      const { data: allScheduled, error: allError } = await this.supabase
        .from('posts')
        .select('id, title, scheduled_for, status')
        .eq('status', 'scheduled');

      if (allError) {
        console.error('Error fetching scheduled posts:', allError);
      }

      console.log('All scheduled posts:', allScheduled);

      // Then get due posts
      const currentTime = new Date().toISOString();
      console.log('Checking for due posts before:', currentTime);

      const { data: duePosts, error } = await this.supabase
        .from('posts')
        .select('*, social_accounts(*)')
        .eq('status', 'scheduled')
        .lte('scheduled_for', currentTime)
        .order('scheduled_for', { ascending: true });

      if (error) {
        console.error('Error fetching due posts:', error);
      }

      console.log('Due posts:', duePosts);

      if (error) throw error;
      if (!duePosts || duePosts.length === 0) return [];

      const results = await Promise.all(
        duePosts.map(async (post) => {
          try {
            // Get the social account with access token
            const { data: account, error: accountError } = await this.supabase
              .from('social_accounts')
              .select('*')
              .eq('id', post.social_account_id)
              .single();

            if (accountError) throw accountError;
            if (!account?.access_token) throw new Error('Access token not found for account');

            console.log('Found account:', { id: account.id, name: account.account_name });

            // Create a new service instance with service role
            const service = new SocialMediaService(this.supabase, true);

            // Create the post using service role
            const result = await service.createPost(
              post.title || '',
              post.content || '',
              [{
                accountId: post.social_account_id,
                subreddit: post.subreddit || '',
                flairId: post.flair_id || undefined
              }],
              post.user_id
            );

            // Update post status based on result
            const { error: updateError } = await this.supabase
              .from('posts')
              .update({
                status: result[0]?.success ? 'published' : 'failed',
                published_at: result[0]?.success ? new Date().toISOString() : null,
                error_message: result[0]?.error || null
              })
              .eq('id', post.id);

            if (updateError) throw updateError;

            return {
              postId: post.id,
              success: result[0]?.success || false,
              error: result[0]?.error
            };
          } catch (error: any) {
            // Update post status to failed
            await this.supabase
              .from('posts')
              .update({
                status: 'failed',
                error_message: error.message
              })
              .eq('id', post.id);

            return {
              postId: post.id,
              success: false,
              error: error.message
            };
          }
        })
      );

      return results;
    } catch (error: any) {
      console.error('Error publishing scheduled posts:', error);
      throw error;
    }
  }
}
