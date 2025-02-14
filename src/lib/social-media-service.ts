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
}

interface PostPlatformRecord {
  post_id: string | null;
  social_account_id: string;
  platform_post_id: string | null;
  status: 'success' | 'failed' | 'karma_insufficient' | 'rate_limited' | 'invalid_subreddit';
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
        .single();

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
        .single();

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
    title: string,
    content: string,
    posts: RedditPostConfig[]
  ): Promise<PostResult[]> {
    const results: PostResult[] = [];

    try {
      // Get the current user's ID
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('User not authenticated');

      // First, create the post record with user_id
      const { data: postRecord, error: postError } = await this.supabase
        .from('posts')
        .insert({
          content: content,
          created_at: new Date().toISOString(),
          user_id: user.id  // Add the user_id here
        })
        .select()
        .single();

      if (postError) throw postError;

      // Now try to post to each platform
      for (const post of posts) {
        try {
          if (!post.subreddit) {
            throw new Error('Subreddit is required');
          }

          // Get the account to get the access token
          const account = await this.getAccount(post.accountId);
          if (!account?.accessToken) {
            throw new Error('Account not found or not authenticated');
          }

          // Try to post to Reddit
          let platformPostId: string | undefined;
          try {
            if (post.flairId) {
              platformPostId = await this.redditService.submitPost(
                account.accessToken,
                post.subreddit,
                title,
                content,
                post.flairId
              );
            } else {
              // Check if flair is required
              const flairs = await this.getSubredditFlairs(post.accountId, post.subreddit);
              if (flairs.length > 0) {
                const errorResult: PostResult = {
                  success: false,
                  error: `Flair is required for r/${post.subreddit}`,
                  accountId: post.accountId,
                  subreddit: post.subreddit,
                  requiresFlair: true,
                  availableFlairs: flairs,
                  id: postRecord.id,
                  text: content
                };
                results.push(errorResult);
                continue;
              }
              
              platformPostId = await this.redditService.submitPost(
                account.accessToken,
                post.subreddit,
                title,
                content,
                ''
              );
            }

            // Create post_platforms record for successful post
            await this.supabase
              .from('post_platforms')
              .insert({
                post_id: postRecord.id,
                social_account_id: post.accountId,
                platform_post_id: platformPostId,
                status: 'success',
                subreddit: post.subreddit,
                published_at: new Date().toISOString()
              });

            results.push({
              success: true,
              platformPostId,
              accountId: post.accountId,
              subreddit: post.subreddit,
              id: postRecord.id,
              text: content
            });

          } catch (postError: any) {
            // Create post_platforms record for failed post
            await this.supabase
              .from('post_platforms')
              .insert({
                post_id: postRecord.id,
                social_account_id: post.accountId,
                status: 'failed',
                error_message: postError.message,
                subreddit: post.subreddit
              });

            results.push({
              success: false,
              error: postError.message,
              accountId: post.accountId,
              subreddit: post.subreddit,
              id: postRecord.id,
              text: content
            });
          }
        } catch (error: any) {
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
    } catch (error: any) {
      console.error('Error creating post:', error);
      throw error;
    }

    return results;
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

  async getPostHistory(): Promise<PostHistory[]> {
    try {
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
            social_accounts (
              id,
              platform,
              account_name,
              account_id
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return posts.map((post: any) => {
        // Get unique accounts this post was shared from (if any)
        const accounts = post.post_platforms
          ? post.post_platforms
              .map((platform: any) => platform.social_accounts)
              .filter((account: any) => account !== null)
          : [];

        // Get post statuses across platforms (if any)
        const statuses = post.post_platforms
          ? post.post_platforms.map((platform: any) => ({
              platform: platform.social_accounts?.platform || 'unknown',
              status: platform.status || 'pending',
              errorMessage: platform.error_message,
              postUrl: platform.platform_post_id ? `https://reddit.com/${platform.platform_post_id}` : undefined,
              subreddit: platform.subreddit
            }))
          : [];

        return {
          id: post.id,
          content: post.content,
          title: post.content?.split('\n')[0] || '',
          createdAt: post.created_at,
          media_urls: post.media_urls,
          accounts: accounts,
          platformStatuses: statuses
        };
      });
    } catch (error) {
      console.error('Error fetching post history:', error);
      throw error;
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
