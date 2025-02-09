import { createBrowserClient } from '@supabase/ssr';
import { RedditService } from './reddit-service';

export interface SocialAccount {
  id: string;
  platform: 'reddit';
  accountName: string;
  accountId: string;
  accessToken?: string;
}

export interface PostResult {
  success: boolean;
  platformPostId?: string;
  error?: string;
  requiresFlair?: boolean;
  availableFlairs?: Array<{ id: string; text: string }>;
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
}

interface RedditPostResult {
  url: string;
  id: string;
  name: string;
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
        .select('*');

      if (error) {
        console.error('Error fetching accounts:', error);
        return [];
      }

      if (!accounts) {
        return [];
      }

      console.log('Raw account data:', accounts);

      const transformedAccounts = accounts.map((account: {
        id: string;
        platform: 'reddit';
        account_name: string;
        account_id: string;
        access_token?: string;
      }) => this.transformAccount(account));

      console.log('Transformed accounts:', transformedAccounts);
      return transformedAccounts;
    } catch (error) {
      console.error('Error fetching accounts:', error);
      return [];
    }
  }

  private transformAccount(account: {
    id: string;
    platform: 'reddit';
    account_name: string;
    account_id: string;
    access_token?: string;
  }): SocialAccount {
    return {
      id: account.id,
      platform: account.platform,
      accountName: account.account_name,
      accountId: account.account_id,
      accessToken: account.access_token,
    };
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
      .single();

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
        .single();

      if (!account || !account.access_token) {
        console.error('No access token found for account:', accountId);
        return [];
      }

      console.log('Fetching subreddits with access token');
      return await this.redditService.getSubreddits(account.access_token);
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
        .single();

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
    accountIds: string[],
    content: string,
    title?: string,
    subreddit?: string,
    flairId?: string,
    imageUrl?: string
  ): Promise<PostResult[]> {
    try {
      console.log('Creating post for accounts:', accountIds);
      
      const results: PostResult[] = [];

      // Get the authenticated user
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Create the post record with the authenticated user's ID
      const { data: post, error: postError } = await this.supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: content,
          media_urls: imageUrl ? [imageUrl] : [],
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (postError) {
        console.error('Error creating post:', postError);
        return [{
          success: false,
          error: 'Failed to create post'
        }];
      }

      for (const accountId of accountIds) {
        const { data: account, error } = await this.supabase
          .from('social_accounts')
          .select('*')
          .eq('id', accountId)
          .single();

        if (error) {
          console.error(`Error fetching account ${accountId}:`, error);
          results.push({
            success: false,
            error: 'Failed to fetch account'
          });
          continue;
        }

        if (!account) {
          console.error(`Account not found: ${accountId}`);
          results.push({
            success: false,
            error: 'Account not found'
          });
          continue;
        }

        try {
          if (account.platform === 'reddit') {
            if (!title) {
              throw new Error('Title is required for Reddit posts');
            }

            if (!subreddit) {
              throw new Error('Subreddit is required for Reddit posts');
            }

            // Get available flairs if not provided
            const flairs = await this.getSubredditFlairs(accountId, subreddit);
            if (flairs.length > 0 && !flairId) {
              results.push({
                success: false,
                error: `Flair is required for r/${subreddit}. Available flairs: ${flairs.map(f => f.text).join(', ')}`,
                requiresFlair: true,
                availableFlairs: flairs
              });
              continue;
            }

            console.log(`Posting to Reddit - Subreddit: ${subreddit}`);
            const result = await this.redditService.submitPost(
              account.access_token!,
              subreddit,
              title,
              content,
              flairId,
              imageUrl
            );

            // Record successful post
            const { error: platformError } = await this.supabase
              .from('post_platforms')
              .insert({
                post_id: post.id,
                social_account_id: account.id,
                platform_post_id: result,
                status: 'published',
                published_at: new Date().toISOString()
              });

            if (platformError) {
              console.error('Error recording post platform:', platformError);
            }

            results.push({
              success: true,
              platformPostId: result
            });
          }
          // Handle other platforms...
        } catch (error: any) {
          // Record failed post attempt
          const { error: platformError } = await this.supabase
            .from('post_platforms')
            .insert({
              post_id: post.id,
              social_account_id: account.id,
              status: 'failed',
              error_message: error.message
            });

          if (platformError) {
            console.error('Error recording failed post:', platformError);
          }

          results.push({
            success: false,
            error: error.message
          });
        }
      }
      return results;
    } catch (error: any) {
      console.error('Failed to create post:', error);
      return [{ success: false, error: error.message || 'Failed to create post' }];
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
        .single();

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

  async getPostHistory(): Promise<PostHistory[]> {
    try {
      const { data: posts, error } = await this.supabase
        .from('post_platforms')
        .select(`
          id,
          post_id,
          social_account_id,
          platform_post_id,
          status,
          error_message,
          published_at,
          social_accounts (
            id,
            platform,
            account_name,
            account_id
          ),
          post:posts (
            content
          )
        `)
        .order('published_at', { ascending: false });

      if (error) {
        console.error('Error fetching post history:', error);
        return [];
      }

      if (!posts) {
        return [];
      }

      return posts.map((post: any) => ({
        id: post.id,
        content: post.post?.content || '',
        status: post.status,
        errorMessage: post.error_message,
        publishedAt: post.published_at,
        externalPostId: post.platform_post_id,
        account: post.social_accounts ? {
          id: post.social_accounts.id,
          platform: post.social_accounts.platform,
          accountName: post.social_accounts.account_name,
          accountId: post.social_accounts.account_id
        } : undefined
      }));
    } catch (error) {
      console.error('Error fetching post history:', error);
      return [];
    }
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
}

export const socialMediaService = new SocialMediaService();
