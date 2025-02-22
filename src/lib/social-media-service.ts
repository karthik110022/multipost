import { createBrowserClient } from '@supabase/ssr';
import { RedditService } from './reddit-service';

export interface SocialAccount {
  id: string;
  platform: 'reddit';
  accountName: string;
  accountId: string;
  accessToken?: string;
  isActive?: boolean;
  createdAt: string;
}

export interface PostResult {
  success: boolean;
  platformPostId?: string;
  error?: string;
  accountId?: string;
  subreddit?: string;
  requiresFlair?: boolean;
  availableFlairs?: Array<{ id: string; text: string }>;
  id?: string;
  text?: string;
  account?: any;
}

interface PostPlatformRecord {
  post_id: string | null;
  social_account_id: string;
  platform_post_id: string | null;
  status: 'pending' | 'published' | 'failed' | 'karma_insufficient' | 'rate_limited' | 'invalid_subreddit';
  error_message?: string;
  subreddit: string;
  flair_id: string | null;
}

export interface PostHistory {
  id: string;
  content: string;
  title?: string;
  subreddit?: string;
  postUrl?: string;
  externalPostId?: string;
  status: 'pending' | 'published' | 'failed';
  errorMessage?: string;
  createdAt: string;
  publishedAt?: string;
  account?: SocialAccount;
  media_urls?: string[];
  accounts?: any[];
  platformStatuses?: any[];
}

interface RedditPostResult {
  url: string;
  id: string;
  name: string;
}

interface RedditPostConfig {
  accountId: string;
  subreddit: string;
  flairId?: string;
}

export interface Comment {
  id: string;
  author: string;
  content: string;
  createdAt: number;
  score: number;
  replies?: Comment[];
}

export class SocialMediaService {
  private redditService: RedditService;
  private supabase;

  constructor(supabase?: any) {
    this.redditService = new RedditService();
    this.supabase = supabase || createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  getRedditAuthUrl(): string {
    try {
      return this.redditService.getAuthUrl();
    } catch (error) {
      console.error('Error getting Reddit auth URL:', error);
      throw new Error('Reddit is not properly configured. Please check your environment variables.');
    }
  }

  async getConnectedAccounts(): Promise<SocialAccount[]> {
    try {
      const { data: accounts, error } = await this.supabase
        .from('social_accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching accounts:', error);
        return [];
      }

      if (!accounts) {
        return [];
      }

      // Get the active account ID from local storage
      const activeAccountId = localStorage.getItem('activeAccountId');

      const transformedAccounts = accounts.map((account: {
        id: string;
        platform: 'reddit';
        account_name: string;
        account_id: string;
        access_token?: string;
        created_at: string;
      }) => ({
        ...this.transformAccount(account),
        isActive: account.id === activeAccountId,
        createdAt: account.created_at
      }));

      // If no active account is set and we have accounts, set the first one as active
      if (!activeAccountId && transformedAccounts.length > 0) {
        localStorage.setItem('activeAccountId', transformedAccounts[0].id);
        transformedAccounts[0].isActive = true;
      }

      return transformedAccounts;
    } catch (error) {
      console.error('Error fetching accounts:', error);
      return [];
    }
  }

  async setActiveAccount(accountId: string): Promise<void> {
    try {
      const { data: account, error } = await this.supabase
        .from('social_accounts')
        .select('*')
        .eq('id', accountId)
        .maybeSingle();

      if (error || !account) {
        throw new Error('Account not found');
      }

      localStorage.setItem('activeAccountId', accountId);
    } catch (error) {
      console.error('Error setting active account:', error);
      throw error;
    }
  }

  async getActiveAccount(): Promise<SocialAccount | null> {
    try {
      const activeAccountId = localStorage.getItem('activeAccountId');
      if (!activeAccountId) return null;

      const { data: account, error } = await this.supabase
        .from('social_accounts')
        .select('*')
        .eq('id', activeAccountId)
        .maybeSingle();

      if (error || !account) {
        localStorage.removeItem('activeAccountId');
        return null;
      }

      return {
        ...this.transformAccount(account),
        isActive: true,
        createdAt: account.created_at
      };
    } catch (error) {
      console.error('Error getting active account:', error);
      return null;
    }
  }

  async disconnectAccount(accountId: string): Promise<void> {
    const { error } = await this.supabase
      .from('social_accounts')
      .delete()
      .eq('id', accountId);

    if (error) throw error;
  }

  async getAccount(accountId: string): Promise<SocialAccount | null> {
    const { data: account, error } = await this.supabase
      .from('social_accounts')
      .select('*')
      .eq('id', accountId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching account:', error);
      throw error;
    }

    if (!account) return null;

    return this.transformAccount(account);
  }

  async getSubreddits(accountId: string): Promise<Array<{ id: string; name: string; displayName: string }>> {
    try {
      const { data: account } = await this.supabase
        .from('social_accounts')
        .select('*')
        .eq('id', accountId)
        .maybeSingle();

      if (!account || !account.access_token) {
        console.error('No access token found for account:', accountId);
        return [];
      }

      try {
        // First validate the access token
        const isValid = await this.redditService.validateAccessToken(account.access_token);
        
        if (!isValid && account.refresh_token) {
          // Token is invalid, try to refresh it
          console.log('Access token invalid, attempting to refresh...');
          const newAccessToken = await this.redditService.refreshToken(account.refresh_token);
          
          // Update the account with the new access token
          await this.supabase
            .from('social_accounts')
            .update({ access_token: newAccessToken })
            .eq('id', accountId);
            
          // Use the new access token
          console.log('Fetching subreddits with refreshed token');
          return await this.redditService.getSubreddits(newAccessToken);
        }
        
        console.log('Fetching subreddits with access token');
        return await this.redditService.getSubreddits(account.access_token);
      } catch (error) {
        if (error instanceof Error) {
          console.error('Error during subreddit fetch:', error.message);
          // If we get an auth error even after refresh, the account may need to be re-authenticated
          if (error.message.includes('401')) {
            throw new Error('Account needs to be re-authenticated');
          }
        }
        throw error;
      }
    } catch (error) {
      console.error('Failed to fetch subreddits:', error);
      return [];
    }
  }

  async getSubredditFlairs(accountId: string, subreddit: string): Promise<Array<{ id: string; text: string }>> {
    try {
      const { data: account } = await this.supabase
        .from('social_accounts')
        .select('*')
        .eq('id', accountId)
        .maybeSingle();

      if (!account || !account.access_token) {
        console.error('No access token found for account:', accountId);
        return [];
      }

      return await this.redditService.getFlairOptions(account.access_token, subreddit);
    } catch (error) {
      console.error('Failed to fetch subreddit flairs:', error);
      return [];
    }
  }

  async createPost(
    title: string,
    content: string,
    posts: RedditPostConfig[]
  ): Promise<PostResult[]> {
    const results: PostResult[] = [];

    try {
      // Get the current user
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('User not authenticated');

      // Create the main post record
      const { data: postRecord, error: postError } = await this.supabase
        .from('posts')
        .insert({
          title,
          content,
          user_id: user.id,
          created_at: new Date().toISOString()
        })
        .select()
        .maybeSingle();

      if (postError) throw postError;
      if (!postRecord) throw new Error('Failed to create post record');

      // Process each platform post
      for (const post of posts) {
        try {
          if (!post.subreddit) {
            throw new Error('Subreddit is required');
          }

          // Get the account and access token
          const account = await this.getAccount(post.accountId);
          if (!account?.accessToken) {
            throw new Error('Account not found or not authenticated');
          }

          console.log('Creating initial post_platforms record...');
          // Create initial post_platforms entry
          const { data: platformRecord, error: platformError } = await this.supabase
            .from('post_platforms')
            .insert({
              post_id: postRecord.id,
              social_account_id: post.accountId,
              status: 'pending',
              subreddit: post.subreddit,
              flair_id: post.flairId || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select('*')
            .maybeSingle();

          if (platformError) {
            console.error('Error creating platform record:', platformError);
            throw platformError;
          }
          if (!platformRecord) {
            throw new Error('Failed to create platform record');
          }

          console.log('Created platform record:', platformRecord);

          // Attempt to post to Reddit
          try {
            console.log('Attempting to post to Reddit...');
            const platformPostId = await this.redditService.submitPost(
              account.accessToken,
              post.subreddit,
              title,
              content,
              post.flairId || ''
            );

            console.log('Successfully posted to Reddit with ID:', platformPostId);
            
            try {
              console.log('Attempting to update post status to published...', {
                platformRecordId: platformRecord.id,
                platformPostId,
                currentStatus: platformRecord.status
              });

              // Prepare update data
              const updateData = {
                id: platformRecord.id, // Include id for upsert
                post_id: platformRecord.post_id, // Include all required fields
                social_account_id: platformRecord.social_account_id,
                platform_post_id: platformPostId,
                status: 'published',
                published_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                error_message: null,
                flair_id: platformRecord.flair_id,
                subreddit: platformRecord.subreddit
              };
              
              console.log('Updating with data:', updateData);

              // Try upsert instead of update
              const { data: upsertResult, error: upsertError } = await this.supabase
                .from('post_platforms')
                .upsert(updateData, {
                  onConflict: 'id',
                  ignoreDuplicates: false
                })
                .select();

              console.log('Upsert result:', upsertResult);
              
              if (upsertError) {
                console.error('Error upserting platform record:', upsertError);
                throw new Error(`Failed to upsert platform record: ${upsertError.message}`);
              }

              // Verify the update
              const { data: verifiedRecord, error: verifyError } = await this.supabase
                .from('post_platforms')
                .select('*')
                .eq('id', platformRecord.id)
                .single();

              if (verifyError) {
                console.error('Error verifying record:', verifyError);
                throw new Error(`Failed to verify record: ${verifyError.message}`);
              }

              console.log('Verification result:', verifiedRecord);

              if (!verifiedRecord) {
                console.error('Record not found after update');
                throw new Error('Failed to update platform record - record not found');
              }

              if (verifiedRecord.status !== 'published' || verifiedRecord.platform_post_id !== platformPostId) {
                console.error('Update verification failed:', {
                  record: verifiedRecord,
                  expectedStatus: 'published',
                  expectedPostId: platformPostId
                });
                throw new Error('Update verification failed - record not updated correctly');
              }

              console.log('Successfully updated post status:', verifiedRecord);

              // Add to results
              results.push({
                success: true,
                platformPostId,
                accountId: post.accountId,
                subreddit: post.subreddit,
                id: postRecord.id,
                text: content
              });
            } catch (updateError) {
              console.error('Error updating platform record:', updateError);
              throw new Error('Failed to update platform record');
            }

          } catch (error: any) {
            console.error('Error posting to Reddit:', error);
            
            // Update post_platforms with error status
            const { error: updateError } = await this.supabase
              .from('post_platforms')
              .update({
                status: 'failed',
                error_message: error.message,
                updated_at: new Date().toISOString()
              })
              .eq('id', platformRecord.id);

            if (updateError) {
              console.error('Error updating error status:', updateError);
            }

            results.push({
              success: false,
              error: error.message,
              accountId: post.accountId,
              subreddit: post.subreddit,
              id: postRecord.id,
              text: content
            });
          }
        } catch (error: any) {
          console.error('Error processing post:', error);
          results.push({
            success: false,
            error: error.message,
            accountId: post.accountId,
            subreddit: post.subreddit,
            id: postRecord.id,
            text: content
          });
        }
      }

      return results;
    } catch (error: any) {
      console.error('Error in createPost:', error);
      throw error;
    }
  }

  async handleRedditCallback(
    userId: string,
    code: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Exchange code for tokens
      const tokens = await this.redditService.exchangeCode(code);

      // Get user info from Reddit
      const userInfo = await this.redditService.getUserInfo(tokens.access_token);

      // Check if this Reddit account is already connected
      const { data: existingAccount } = await this.supabase
        .from('social_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('account_id', userInfo.id)
        .maybeSingle();

      if (existingAccount) {
        return {
          success: false,
          error: `Reddit account u/${userInfo.name} is already connected`,
        };
      }

      // Insert new account
      const { error: insertError } = await this.supabase
        .from('social_accounts')
        .insert({
          user_id: userId,
          platform: 'reddit',
          account_id: userInfo.id,
          account_name: userInfo.name,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires: new Date(tokens.expires_at).toISOString(),
          created_at: new Date().toISOString()
        });

      if (insertError) throw insertError;

      return { success: true };
    } catch (error) {
      console.error('Error in Reddit callback:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect Reddit account',
      };
    }
  }

  async getPostHistory(): Promise<any[]> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get all posts with their platform details and account information
    const { data: posts, error } = await this.supabase
      .from('posts')
      .select(`
        *,
        post_platforms (
          id,
          platform_post_id,
          status,
          error_message,
          subreddit,
          published_at,
          social_accounts (*)
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching post history:', error);
      throw error;
    }

    // Log raw data for debugging
    console.log('Raw posts data:', JSON.stringify(posts, null, 2));

    // Transform the data to include account details
    return posts.map((post: any) => ({
      id: post.id,
      title: post.title || post.content.split('\n')[0],
      content: post.title ? post.content : post.content.split('\n').slice(1).join('\n').trim(),
      created_at: post.created_at,
      platforms: (post.post_platforms || []).map((platform: any) => ({
        id: platform.id,
        platform_post_id: platform.platform_post_id,
        status: platform.status,
        error_message: platform.error_message,
        subreddit: platform.subreddit,
        published_at: platform.published_at,
        account: platform.social_accounts
      }))
    }));
  }

  async deletePostHistory(postId: string): Promise<void> {
    try {
      // First delete all post platforms
      const { error: platformError } = await this.supabase
        .from('post_platforms')
        .delete()
        .eq('post_id', postId);

      if (platformError) {
        throw platformError;
      }

      // Then delete the post
      const { error } = await this.supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error deleting post history:', error);
      throw new Error('Failed to delete post history');
    }
  }

  async getPostComments(accountId: string, postId: string): Promise<Comment[]> {
    try {
      const account = await this.getAccount(accountId);
      if (!account?.accessToken) {
        throw new Error('Account not found or invalid access token');
      }

      const comments = await this.redditService.getPostComments(account.accessToken, postId);
      
      const convertComment = (redditComment: any): Comment => ({
        id: redditComment.id,
        author: redditComment.author,
        content: redditComment.body,
        createdAt: redditComment.created_utc,
        score: redditComment.score,
        replies: redditComment.replies?.map(convertComment)
      });

      return comments.map(convertComment);
    } catch (error) {
      console.error('Error fetching comments:', error);
      return [];
    }
  }

  private async recordPost(post: PostPlatformRecord) {
    try {
      const { error } = await this.supabase
        .from('post_platforms')
        .insert(post);

      if (error) {
        console.error('Error recording post:', error);
      }
    } catch (error) {
      console.error('Error recording post:', error);
    }
  }

  private transformAccount(account: {
    id: string;
    platform: 'reddit';
    account_name: string;
    account_id: string;
    access_token?: string;
    created_at: string;
  }): SocialAccount {
    return {
      id: account.id,
      platform: account.platform,
      accountName: account.account_name,
      accountId: account.account_id,
      accessToken: account.access_token,
      createdAt: account.created_at
    };
  }

  private mapPostStatus(status: string): PostHistory['status'] {
    switch (status) {
      case 'success':
        return 'published';
      case 'karma_insufficient':
      case 'rate_limited':
      case 'invalid_subreddit':
      case 'failed':
        return 'failed';
      default:
        return 'pending';
    }
  }
}

export const socialMediaService = new SocialMediaService();
