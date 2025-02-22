import axios, { AxiosError } from 'axios';
import { env, validateEnv } from '@/config/env';

class RateLimiter {
  private limits: Map<string, {
    count: number,
    resetTime: number,
    nextAllowedTime: number,
    dailyCount: number,
    lastDailyReset: number
  }> = new Map();

  private readonly DAILY_RESET_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  private readonly MAX_REQUESTS_PER_MINUTE = 30; // Half of Reddit's limit for safety
  private readonly REQUEST_INTERVAL = 60 * 1000; // 1 minute in milliseconds
  private readonly POSTS_PER_SUBREDDIT_INTERVAL = 30 * 60 * 1000; // 30 minutes between posts to same subreddit
  private readonly MAX_POSTS_PER_DAY = 60; // Target: 60 posts per day
  private readonly MIN_POST_INTERVAL = 5 * 60 * 1000; // 5 minutes between any posts

  async checkLimit(key: string, context: 'api' | 'post' | 'subreddit'): Promise<{ allowed: boolean; waitTime: number; reason?: string }> {
    const now = Date.now();
    let limit = this.limits.get(key);

    // Initialize or reset daily counters if needed
    if (!limit || now - limit.lastDailyReset >= this.DAILY_RESET_INTERVAL) {
      limit = {
        count: 0,
        resetTime: now + this.REQUEST_INTERVAL,
        nextAllowedTime: now,
        dailyCount: 0,
        lastDailyReset: now
      };
      this.limits.set(key, limit);
    }

    // Check different limits based on context
    switch (context) {
      case 'api':
        // Check API rate limits (30 requests per minute)
        if (limit.count >= this.MAX_REQUESTS_PER_MINUTE) {
          const waitTime = limit.resetTime - now;
          if (waitTime > 0) {
            return { allowed: false, waitTime, reason: 'API rate limit exceeded' };
          }
          // Reset counter if time window has passed
          limit.count = 0;
          limit.resetTime = now + this.REQUEST_INTERVAL;
        }
        break;

      case 'post':
        // Check daily post limit
        if (limit.dailyCount >= this.MAX_POSTS_PER_DAY) {
          const waitTime = (limit.lastDailyReset + this.DAILY_RESET_INTERVAL) - now;
          return { allowed: false, waitTime, reason: 'Daily post limit reached' };
        }

        // Check minimum interval between posts
        if (now < limit.nextAllowedTime) {
          return { allowed: false, waitTime: limit.nextAllowedTime - now, reason: 'Minimum post interval not met' };
        }
        limit.nextAllowedTime = now + this.MIN_POST_INTERVAL;
        break;

      case 'subreddit':
        // Check subreddit-specific cooldown
        if (now < limit.nextAllowedTime) {
          return { allowed: false, waitTime: limit.nextAllowedTime - now, reason: 'Subreddit cooldown period' };
        }
        limit.nextAllowedTime = now + this.POSTS_PER_SUBREDDIT_INTERVAL;
        break;
    }

    // Update counters
    limit.count++;
    if (context === 'post') {
      limit.dailyCount++;
    }
    
    this.limits.set(key, limit);
    return { allowed: true, waitTime: 0 };
  }

  getPostsRemaining(key: string): { daily: number; resetTime: number } {
    const now = Date.now();
    const limit = this.limits.get(key);

    if (!limit) {
      return { daily: this.MAX_POSTS_PER_DAY, resetTime: now + this.DAILY_RESET_INTERVAL };
    }

    const postsRemaining = this.MAX_POSTS_PER_DAY - limit.dailyCount;
    const resetTime = limit.lastDailyReset + this.DAILY_RESET_INTERVAL;

    return { daily: Math.max(0, postsRemaining), resetTime };
  }

  async checkApiLimit(key: string): Promise<{ allowed: boolean; waitTime: number }> {
    const result = await this.checkLimit(key, 'api');
    return { allowed: result.allowed, waitTime: result.waitTime };
  }
}

interface RedditTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

interface RedditUserResponse {
  name: string;
  id: string;
  created_utc: number;
}

interface RedditSubredditResponse {
  data: {
    children: {
      data: {
        display_name: string;
        display_name_prefixed: string;
      };
    }[];
    after: string | null;
    before: string | null;
  };
}

interface RedditSubmitResponse {
  json: {
    errors: Array<[string, string]>;
    data?: {
      url?: string;
      name?: string;
      id?: string;
    };
  };
}

interface RedditPostInfoResponse {
  data?: {
    children?: Array<{
      data?: {
        permalink?: string;
        name?: string;
        id?: string;
      };
    }>;
  };
}

interface RedditPostResult {
  url: string;
  id: string;
  name: string;
}

interface RedditSubredditAboutResponse {
  data: {
    submission_type?: string;
    allow_images?: boolean;
  };
}

export interface RedditTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

interface SubredditListingResponse {
  items: Array<{ name: string; displayName: string }>;
  after?: string;
  before?: string;
}

interface RedditFlair {
  id: string;
  text: string;
  type: string;
}

interface RedditApiResponse {
  json?: {
    data?: {
      url?: string;
      name?: string;
    };
    errors?: [string, string][];
  };
  jquery?: Array<[number, number, string, Array<any>]>;
  success?: boolean;
}

interface RedditError {
  reason?: string;
  message?: string;
}

interface RedditPostHistoryDetails {
  id: string;
  title: string;
  subreddit: string;
  subredditDisplayName: string;
  authorName: string;
  upvotes: number;
  downvotes: number;
  commentCount: number;
  shareCount: number;
  createdAt: number;
  permalink: string;
}

interface RedditPostStats {
  upvotes: number;
  downvotes: number;
  comments: number;
  shares: number;
  awards: Array<{
    name: string;
    count: number;
    icon_url: string;
  }>;
}

interface RedditComment {
  id: string;
  author: string;
  body: string;
  created_utc: number;
  score: number;
  replies?: RedditComment[];
}

interface SubredditActivityData {
  activeUsers: number;
  posts: Array<{
    id: string;
    created_utc: number;
    score: number;
    num_comments: number;
  }>;
}

interface SubredditEngagementMetrics {
  avgScore: number;
  avgComments: number;
  peakHours: Array<{
    hour: number;
    engagement: number;
  }>;
  topKeywords: Array<{
    keyword: string;
    frequency: number;
  }>;
}

export class RedditService {
  private readonly rateLimiter: RateLimiter;
  private clientId: string = '';
  private clientSecret: string = '';
  private redirectUri: string = '';

  constructor() {
    this.rateLimiter = new RateLimiter();
    this.validateCredentials();
  }

  private validateCredentials() {
    try {
      validateEnv();

      const clientId = env.NEXT_PUBLIC_REDDIT_CLIENT_ID;
      const clientSecret = env.REDDIT_CLIENT_SECRET;
      const appUrl = env.NEXT_PUBLIC_APP_URL;

      if (!clientId || !clientSecret) {
        console.error('Missing Reddit credentials:', {
          hasClientId: !!clientId,
          hasClientSecret: !!clientSecret,
        });
        throw new Error('Reddit credentials are not properly configured. Please check your environment variables.');
      }

      this.clientId = clientId;
      this.clientSecret = clientSecret;
      this.redirectUri = `${appUrl}/auth/callback/reddit`;

      // Log the configuration
      console.log('Reddit Configuration:', {
        hasClientId: !!this.clientId,
        redirectUri: this.redirectUri,
        hasSecret: !!this.clientSecret,
        appUrl
      });
    } catch (error) {
      console.error('Reddit service initialization failed:', error);
      throw error;
    }
  }

  private handleApiError(error: any): never {
    console.error('Reddit API Error:', error?.response?.data || error);
    
    // Handle specific Reddit API errors
    if (error?.response?.data) {
      const redditError = error.response.data;
      
      // Check for karma-related errors
      if (redditError.reason === 'LOW_KARMA' || 
          (redditError.message && redditError.message.toLowerCase().includes('karma'))) {
        throw new Error('INSUFFICIENT_KARMA');
      }
      
      // Check for rate limiting
      if (redditError.reason === 'RATELIMIT' || 
          redditError.message && redditError.message.toLowerCase().includes('rate limit')) {
        throw new Error('RATE_LIMITED');
      }

      // Check for invalid subreddit
      if (redditError.reason === 'SUBREDDIT_NOTALLOWED' || 
          redditError.reason === 'SUBREDDIT_NOEXIST') {
        throw new Error('INVALID_SUBREDDIT');
      }

      // If we have a specific error message from Reddit, use it
      if (redditError.message) {
        throw new Error(redditError.message);
      }
    }

    // Generic error fallback
    throw new Error('Failed to make Reddit API request');
  }

  private async makeApiRequest<T>(
    endpoint: string,
    options: {
      method: string;
      headers?: Record<string, string>;
      body?: string;
      accessToken?: string;
    }
  ): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `https://oauth.reddit.com${endpoint}`;
    console.log('🌐 Making API request to:', endpoint);
    console.log('Method:', options.method);

    const headers: Record<string, string> = {
      ...options.headers,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    // Add authorization header if access token is provided
    if (options.accessToken) {
      headers['Authorization'] = `Bearer ${options.accessToken}`;
    }

    console.log('Headers:', headers);
    console.log('Body:', options.body);

    try {
      const response = await fetch(url, {
        method: options.method,
        headers,
        body: options.body
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API request failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      console.log('✅ API request successful');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ API request error:', error);
      throw error;
    }
  }

  async validateAccessToken(accessToken: string): Promise<boolean> {
    try {
      console.log('Validating Reddit access token...');
      await this.makeApiRequest('/api/v1/me', { 
        method: 'GET', 
        accessToken 
      });
      console.log('✅ Access token is valid');
      return true;
    } catch (error) {
      console.log('❌ Access token is invalid');
      return false;
    }
  }

  async refreshToken(refreshToken: string): Promise<string> {
    console.log('Refreshing Reddit access token...');
    const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    
    try {
      const response = await this.makeApiRequest<RedditTokenResponse>(
        'https://www.reddit.com/api/v1/access_token',
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `grant_type=refresh_token&refresh_token=${refreshToken}`,
        }
      );

      if (!response.access_token) {
        throw new Error('No access token in refresh response');
      }

      console.log('✅ Token refreshed successfully');
      return response.access_token;
    } catch (error) {
      console.error('❌ Failed to refresh token:', error);
      throw new Error('Failed to refresh access token');
    }
  }

  async getAccessToken(code: string): Promise<string> {
    try {
      this.validateCredentials();
      const apiCheck = await this.rateLimiter.checkApiLimit('token_requests');
      if (!apiCheck.allowed) {
        throw new Error(`Too many token requests. Please wait ${Math.ceil(apiCheck.waitTime / 1000)} seconds`);
      }

      const response = await this.makeApiRequest<RedditTokenResponse>('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
        },
        body: `grant_type=authorization_code&code=${code}&redirect_uri=${this.redirectUri}`
      });

      return response.access_token;
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  async getFlairOptions(accessToken: string, subreddit: string): Promise<Array<{ id: string; text: string }>> {
    try {
      const response = await fetch(`https://oauth.reddit.com/r/${subreddit}/api/link_flair_v2`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error fetching flair options:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(`Failed to fetch flair options: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      // If the response is empty array or has error, it means no flairs are required
      if (!data || !Array.isArray(data) || data.length === 0) {
        return [];
      }

      return data.map((flair: RedditFlair) => ({
        id: flair.id,
        text: flair.text,
      }));
    } catch (error: any) {
      // If we get a 403 or 404, it means flairs are not available or not required
      if (error.response && (error.response.status === 403 || error.response.status === 404)) {
        return [];
      }
      console.error('Error fetching flair options:', error);
      throw error;
    }
  }

  async submitPost(
    accessToken: string,
    subreddit: string,
    title: string,
    content: string,
    flairId: string
  ): Promise<string> {
    console.log('Starting post submission...', { subreddit, hasFlairId: !!flairId });
    
    try {
      // Remove any 'r/' prefix if present and convert to lowercase
      const cleanSubreddit = subreddit.replace(/^r\//, '').toLowerCase();
      
      console.log('Submitting post to Reddit API...');
      const formData = new URLSearchParams();
      formData.append('api_type', 'json');
      formData.append('sr', cleanSubreddit);
      formData.append('kind', 'self');
      formData.append('title', title);
      formData.append('text', content);
      
      if (flairId) {
        formData.append('flair_id', flairId);
      }

      // Log the form data for debugging
      console.log('Form data:', Object.fromEntries(formData));

      const response = await this.makeApiRequest<RedditApiResponse>('/api/submit', {
        method: 'POST',
        body: formData.toString(),
        accessToken
      });

      // Log the full response for debugging
      console.log('Reddit API Response:', JSON.stringify(response, null, 2));

      // Check for errors in the response
      if (response?.json?.errors && response.json.errors.length > 0) {
        const [errorCode, errorMessage] = response.json.errors[0];
        throw new Error(errorMessage || errorCode);
      }

      // Get the post ID from the response
      const fullName = response?.json?.data?.name;
      if (!fullName) {
        throw new Error('Failed to get post ID from Reddit response');
      }

      // Reddit returns the post name in format 't3_postid'
      // We need to extract just the post id part
      const postId = fullName.replace('t3_', '');
      console.log('Successfully created Reddit post with ID:', postId);

      return postId;
    } catch (error: any) {
      console.error('Error in submitPost:', error);
      throw error;
    }
  }

  async getPostStats(accessToken: string, postId: string): Promise<RedditPostStats> {
    try {
      console.log('Fetching stats for post:', postId);
      
      // Make sure we're using just the ID part, not the fullname
      const cleanPostId = postId.replace('t3_', '');
      
      console.log('Making API request for post:', cleanPostId);
      const response = await this.makeApiRequest<any>(`/by_id/t3_${cleanPostId}`, {
        method: 'GET',
        accessToken
      });

      console.log('API Response:', JSON.stringify(response, null, 2));

      if (!response?.data?.children || response.data.children.length === 0) {
        console.error('No post data found in response:', response);
        throw new Error('Post not found or may have been deleted');
      }

      const postData = response.data.children[0].data;
      if (!postData) {
        console.error('Invalid post data structure:', response.data.children[0]);
        throw new Error('Invalid post data structure received');
      }
      
      console.log('Retrieved post data:', postData);
      
      return {
        upvotes: postData.ups || 0,
        downvotes: postData.downs || 0,
        comments: postData.num_comments || 0,
        shares: 0, // Reddit API doesn't provide share count
        awards: (postData.all_awardings || []).map((award: any) => ({
          name: award.name,
          count: award.count,
          icon_url: award.icon_url
        }))
      };
    } catch (error: any) {
      console.error('Error fetching post stats:', error);
      if (error.response?.status === 404) {
        throw new Error('Post not found or may have been deleted');
      }
      throw error;
    }
  }

  async revokeToken(token: string): Promise<void> {
    try {
      this.validateCredentials();
      await this.makeApiRequest('https://www.reddit.com/api/v1/revoke_token', {
        method: 'POST',
        body: `token=${token}`
      });
    } catch (error) {
      return this.handleApiError(error);
    }
  }

  async exchangeCode(code: string): Promise<RedditTokens> {
    console.log('Exchanging code for tokens...');
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', `${env.NEXT_PUBLIC_APP_URL}/auth/callback/reddit`);

    try {
      console.log('Making token request to Reddit...');
      const response = await fetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error exchanging code:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(`Failed to exchange code: ${response.status} ${response.statusText}`);
      }

      console.log('Token response received:', { 
        status: response.status,
        hasAccessToken: !!response.headers.get('access_token'),
        hasRefreshToken: !!response.headers.get('refresh_token'),
        expiresIn: response.headers.get('expires_in')
      });

      const { access_token, refresh_token, expires_in } = await response.json();
      return {
        access_token,
        refresh_token: refresh_token || '',
        expires_at: Date.now() + expires_in * 1000,
      };
    } catch (error: any) {
      console.error('Error exchanging code:', error);
      throw error;
    }
  }

  getAuthUrl(): string {
    this.validateCredentials();
    const params = {
      client_id: this.clientId,
      response_type: 'code',
      state: 'random_state',
      redirect_uri: `${env.NEXT_PUBLIC_APP_URL}/auth/callback/reddit`,
      duration: 'permanent',
      scope: 'identity submit read subscribe mysubreddits flair',
      prompt: 'consent'
    };

    // Log the redirect URI for debugging
    console.log('Redirect URI:', params.redirect_uri);

    return `https://www.reddit.com/api/v1/authorize?${new URLSearchParams(params).toString()}`;
  }

  async getUserInfo(accessToken: string): Promise<{ name: string; id: string }> {
    console.log('Getting user info...');
    const response = await this.makeApiRequest<RedditUserResponse>('/api/v1/me', {
      method: 'GET',
      accessToken
    });

    if (!response) {
      throw new Error('Failed to get user info');
    }

    console.log('Got user info:', response.name);
    return {
      name: response.name,
      id: response.id,
    };
  }

  async getSubreddits(accessToken: string): Promise<Array<{ id: string; name: string; displayName: string }>> {
    try {
      console.log('Fetching subreddits with token:', accessToken ? 'present' : 'missing');
      const response = await this.makeApiRequest<any>('/subreddits/mine/subscriber', {
        method: 'GET',
        accessToken
      });

      if (!response.data || !Array.isArray(response.data.children)) {
        console.error('Invalid response format from Reddit API:', response);
        return [];
      }

      return response.data.children.map((sub: any) => ({
        id: sub.data.name,
        name: sub.data.display_name,
        displayName: `r/${sub.data.display_name}`
      }));
    } catch (error) {
      console.error('Failed to fetch subreddits:', error);
      return [];
    }
  }

  async getPostHistory(accessToken: string): Promise<RedditPostHistoryDetails[]> {
    const endpoint = 'https://oauth.reddit.com/user/submitted';
    
    try {
      const response = await this.makeApiRequest<{
        data: {
          children: Array<{
            data: {
              id: string;
              title: string;
              subreddit: string;
              subreddit_name_prefixed: string;
              author: string;
              ups: number;
              downs: number;
              num_comments: number;
              created_utc: number;
              permalink: string;
              score: number;
            };
          }>;
        };
      }>(endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data.children.map(child => ({
        id: child.data.id,
        title: child.data.title,
        subreddit: child.data.subreddit,
        subredditDisplayName: child.data.subreddit_name_prefixed,
        authorName: child.data.author,
        upvotes: child.data.ups,
        downvotes: child.data.downs,
        commentCount: child.data.num_comments,
        shareCount: child.data.score, // Using score as a proxy for shares since Reddit API doesn't directly expose share count
        createdAt: child.data.created_utc,
        permalink: `https://reddit.com${child.data.permalink}`,
      }));
    } catch (error) {
      this.handleApiError(error);
    }
  }

  async getPostComments(accessToken: string, postId: string): Promise<RedditComment[]> {
    try {
      const response = await this.makeApiRequest<any>(`/comments/${postId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        accessToken,
      });

      // Reddit returns an array where the first element is the post and the second element contains comments
      if (!Array.isArray(response) || response.length < 2) {
        return [];
      }

      const parseComments = (commentData: any): RedditComment[] => {
        if (!commentData?.data?.children) {
          return [];
        }

        return commentData.data.children
          .filter((child: any) => child.kind === 't1') // Filter only comments
          .map((child: any) => {
            const comment: RedditComment = {
              id: child.data.id,
              author: child.data.author,
              body: child.data.body,
              created_utc: child.data.created_utc,
              score: child.data.score,
            };

            if (child.data.replies && child.data.replies.data) {
              comment.replies = parseComments(child.data.replies);
            }

            return comment;
          });
      };

      return parseComments(response[1]);
    } catch (error) {
      console.error('Error fetching comments:', error);
      return [];
    }
  }

  async getSubredditActivity(accessToken: string, subreddit: string): Promise<SubredditActivityData> {
    try {
      console.log('Fetching real-time data from Reddit for subreddit:', subreddit);
      
      // Fetch subreddit about data to get active users
      const aboutData = await this.makeApiRequest<any>(`/r/${subreddit}/about`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        accessToken,
      });
      
      console.log('Reddit API Response - Active Users:', aboutData.data.active_user_count);

      // Fetch recent posts to analyze activity
      const recentPosts = await this.makeApiRequest<any>(`/r/${subreddit}/new?limit=100`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        accessToken,
      });
      
      console.log('Reddit API Response - Number of posts fetched:', recentPosts.data.children.length);

      const activeUsers = aboutData.data.active_user_count || 0;
      
      return {
        activeUsers,
        posts: recentPosts.data.children.map((child: any) => ({
          id: child.data.id,
          created_utc: child.data.created_utc,
          score: child.data.score,
          num_comments: child.data.num_comments
        }))
      };
    } catch (error) {
      console.error('Error fetching subreddit activity:', error);
      return { activeUsers: 0, posts: [] };
    }
  }

  async analyzeBestPostingTime(accessToken: string, subreddit: string): Promise<Array<{
    dayOfWeek: string;
    hourOfDay: number;
    score: number;
    activeUsers: number;
  }>> {
    try {
      // Fetch posts from different time periods for better analysis
      const [topPosts, hotPosts] = await Promise.all([
        this.makeApiRequest<any>(`/r/${subreddit}/top?t=month&limit=100`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${accessToken}` },
          accessToken,
        }),
        this.makeApiRequest<any>(`/r/${subreddit}/hot?limit=100`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${accessToken}` },
          accessToken,
        })
      ]);

      // Combine all posts
      const allPosts = [...topPosts.data.children, ...hotPosts.data.children]
        .map(child => child.data);

      // Create a map to store engagement by day and hour
      const activityMap = new Map<string, Map<number, {
        totalScore: number;
        totalComments: number;
        count: number;
        activeUsers: number;
      }>>();

      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

      // Analyze each post
      allPosts.forEach(post => {
        const date = new Date(post.created_utc * 1000);
        const day = days[date.getUTCDay()];
        const hour = date.getUTCHours();
        
        if (!activityMap.has(day)) {
          activityMap.set(day, new Map());
        }
        
        const dayMap = activityMap.get(day)!;
        if (!dayMap.has(hour)) {
          dayMap.set(hour, {
            totalScore: 0,
            totalComments: 0,
            count: 0,
            activeUsers: 0
          });
        }

        const hourData = dayMap.get(hour)!;
        hourData.totalScore += post.score;
        hourData.totalComments += post.num_comments;
        hourData.count += 1;
        hourData.activeUsers = Math.max(hourData.activeUsers, post.subreddit_subscribers || 0);
      });

      // Convert the activity map to sorted recommendations
      const recommendations: Array<{
        dayOfWeek: string;
        hourOfDay: number;
        score: number;
        activeUsers: number;
      }> = [];

      activityMap.forEach((dayMap, day) => {
        dayMap.forEach((data, hour) => {
          const avgScore = data.count > 0 ? 
            (data.totalScore + data.totalComments * 2) / data.count : 0;

          recommendations.push({
            dayOfWeek: day,
            hourOfDay: hour,
            score: avgScore,
            activeUsers: data.activeUsers
          });
        });
      });

      // Sort by score and return top recommendations
      return recommendations
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    } catch (error) {
      console.error('Error analyzing best posting time:', error);
      return [];
    }
  }

  async analyzeSubredditEngagement(accessToken: string, subreddit: string): Promise<SubredditEngagementMetrics> {
    try {
      // Get posts from different time periods for better analysis
      const [topPosts, newPosts, hotPosts] = await Promise.all([
        this.makeApiRequest<any>(`/r/${subreddit}/top?t=month&limit=100`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${accessToken}` },
          accessToken,
        }),
        this.makeApiRequest<any>(`/r/${subreddit}/new?limit=100`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${accessToken}` },
          accessToken,
        }),
        this.makeApiRequest<any>(`/r/${subreddit}/hot?limit=100`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${accessToken}` },
          accessToken,
        })
      ]);

      // Combine all posts
      const allPosts = [
        ...topPosts.data.children,
        ...newPosts.data.children,
        ...hotPosts.data.children
      ].map(child => child.data);

      // Calculate average metrics
      const avgScore = allPosts.reduce((sum, post) => sum + post.score, 0) / allPosts.length;
      const avgComments = allPosts.reduce((sum, post) => sum + post.num_comments, 0) / allPosts.length;

      // Analyze peak hours
      const hourlyEngagement = new Map<number, { total: number; count: number }>();
      allPosts.forEach(post => {
        const hour = new Date(post.created_utc * 1000).getHours();
        const engagement = post.score + post.num_comments;
        const current = hourlyEngagement.get(hour) || { total: 0, count: 0 };
        hourlyEngagement.set(hour, {
          total: current.total + engagement,
          count: current.count + 1
        });
      });

      const peakHours = Array.from(hourlyEngagement.entries())
        .map(([hour, data]) => ({
          hour,
          engagement: data.total / data.count
        }))
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, 6);

      // Analyze common keywords in successful posts
      const wordFrequency = new Map<string, number>();
      const commonWords = new Set(['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at']);
      
      allPosts
        .filter(post => post.score > avgScore) // Only analyze high-performing posts
        .forEach(post => {
          const words: string[] = post.title.toLowerCase().split(/\W+/);
          words.forEach((word: string) => {
            if (word.length > 3 && !commonWords.has(word)) {
              wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
            }
          });
        });

      const topKeywords = Array.from(wordFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([keyword, frequency]) => ({ keyword, frequency }));

      return {
        avgScore,
        avgComments,
        peakHours,
        topKeywords
      };
    } catch (error) {
      console.error('Error analyzing subreddit engagement:', error);
      return {
        avgScore: 0,
        avgComments: 0,
        peakHours: [],
        topKeywords: []
      };
    }
  }
}
