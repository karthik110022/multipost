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

        // Get the platformPostId from Reddit
        let platformPostId: string;
        if (post.flairId) {
          platformPostId = await this.redditService.submitPost(
            account.accessToken,
            post.subreddit,
            title,
            content,
            post.flairId
          );
        } else {
          // If no flair ID is provided, check if the subreddit requires one
          const flairs = await this.getSubredditFlairs(post.accountId, post.subreddit);
          if (flairs.length > 0) {
            // Subreddit requires flair
            const errorResult: PostResult = {
              success: false,
              error: `Flair is required for r/${post.subreddit}`,
              accountId: post.accountId,
              subreddit: post.subreddit,
              requiresFlair: true,
              availableFlairs: flairs
            };
            results.push(errorResult);
            continue;
          }
          
          // No flair required, proceed with post
          platformPostId = await this.redditService.submitPost(
            account.accessToken,
            post.subreddit,
            title,
            content,
            ''  // Empty string for no flair
          );
        }

        // Create successful result
        const successResult: PostResult = {
          success: true,
          platformPostId,
          accountId: post.accountId,
          subreddit: post.subreddit
        };
        results.push(successResult);

        // Record successful post
        await this.recordPost({
          post_id: platformPostId,
          social_account_id: post.accountId,
          platform_post_id: platformPostId,
          status: 'success',
          subreddit: post.subreddit,
          flair_id: post.flairId || null
        });

      } catch (error: any) {
        console.error('Error creating post:', error);
        
        let errorMessage = error.message;
        let status: PostPlatformRecord['status'] = 'failed';

        // Map specific error types to user-friendly messages
        switch (error.message) {
          case 'INSUFFICIENT_KARMA':
            errorMessage = `Not enough karma to post in r/${post.subreddit}`;
            status = 'karma_insufficient';
            break;
          case 'RATE_LIMITED':
            errorMessage = 'Rate limited by Reddit. Please wait before posting again.';
            status = 'rate_limited';
            break;
          case 'INVALID_SUBREDDIT':
            errorMessage = `Subreddit r/${post.subreddit} not found or not accessible`;
            status = 'invalid_subreddit';
            break;
        }

        // Create error result
        const errorResult: PostResult = {
          success: false,
          error: errorMessage,
          accountId: post.accountId,
          subreddit: post.subreddit
        };
        results.push(errorResult);

        // Record failed post
        await this.recordPost({
          post_id: null,
          social_account_id: post.accountId,
          platform_post_id: null,
          status: status,
          error_message: errorMessage,
          subreddit: post.subreddit,
          flair_id: post.flairId || null
        });
      }
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
      // Start from post_platforms to get all posts with their platform info
      const { data: platforms, error } = await this.supabase
        .from('post_platforms')
        .select(`
          id,
          platform_post_id,
          status,
          error_message,
          subreddit,
          published_at,
          social_account_id,
          posts (
            id,
            content,
            media_urls,
            created_at
          ),
          social_accounts (
            id,
            platform,
            account_name,
            account_id
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching post history:', error);
        return [];
      }

      if (!platforms || platforms.length === 0) {
        console.log('No platforms found');
        return [];
      }

      return platforms.map((platform: any) => {
        const post = platform.posts;
        const account = platform.social_accounts;
        
        return {
          id: post?.id,
          content: post?.content || '',
          title: post?.content?.split('\n')[0] || '', // Use first line of content as title
          subreddit: platform.subreddit,
          postUrl: platform.platform_post_id ? `https://reddit.com/${platform.platform_post_id}` : undefined,
          externalPostId: platform.platform_post_id,
          status: this.mapPostStatus(platform.status),
          errorMessage: platform.error_message,
          createdAt: post?.created_at,
          publishedAt: platform.published_at,
          media_urls: post?.media_urls,
          account: account ? {
            id: account.id,
            platform: account.platform,
            accountName: account.account_name,
            accountId: account.account_id
          } : undefined
        };
      });
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
