import axios from 'axios';
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
  json: {
    errors: string[][];
    data?: {
      name?: string;
      id?: string;
      url?: string;
    };
  };
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

  private async handleApiError(error: unknown, context: string): Promise<never> {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status: number; headers: Record<string, string>; }; };

      if (axiosError.response?.status === 429) {
        const retryAfter = parseInt(axiosError.response.headers['retry-after'] || '60', 10);
        throw new Error(`Rate limit exceeded. Try again in ${retryAfter} seconds`);
      } else if (axiosError.response?.status === 403) {
        throw new Error('Forbidden: Check subreddit access and account age requirements');
      } else if (axiosError.response?.status === 401) {
        throw new Error('Authentication failed. Please reconnect your Reddit account');
      }
    }
    console.error(`Error in ${context}:`, error);
    throw new Error(`Failed to ${context}`);
  }

  private async makeApiRequest<T>(
    endpoint: string,
    options: {
      method?: string;
      data?: any;
      params?: any;
      headers?: any;
      accessToken?: string;
    } = {}
  ): Promise<T> {
    const {
      method = 'GET',
      data,
      params,
      headers = {},
      accessToken
    } = options;

    const baseHeaders: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...headers
    };

    if (accessToken) {
      baseHeaders['Authorization'] = `Bearer ${accessToken}`;
    }

    try {
      console.log(`🌐 Making API request to: ${endpoint}`);
      console.log('Method:', method);
      console.log('Headers:', JSON.stringify(baseHeaders, null, 2));
      if (data) {
        console.log('Data:', JSON.stringify(data, null, 2));
      }
      
      const response = await axios({
        method,
        url: endpoint.startsWith('http') ? endpoint : `https://oauth.reddit.com${endpoint}`,
        data,
        params,
        headers: baseHeaders,
        transformRequest: [(data) => {
          if (!data) return data;
          return Object.entries(data)
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
            .join('&');
        }]
      });

      console.log('✅ API request successful');
      return response.data;
    } catch (error: any) {
      console.error('❌ API request failed:', {
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });

      // Check if it's a network error
      if (error.message === 'Network Error') {
        throw new Error('Unable to connect to Reddit. Please check your internet connection and Reddit access token.');
      }

      // Check if it's an authentication error
      if (error.response?.status === 401) {
        throw new Error('Reddit authentication failed. Please reconnect your Reddit account.');
      }

      return this.handleApiError(error, `API request to ${endpoint} failed`);
    }
  }

  async validateAccessToken(accessToken: string): Promise<boolean> {
    try {
      console.log('Validating Reddit access token...');
      await this.makeApiRequest('/api/v1/me', { accessToken });
      console.log('✅ Access token is valid');
      return true;
    } catch (error) {
      console.error('❌ Access token validation failed:', error);
      return false;
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
        data: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.redirectUri
        },
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
        }
      });

      return response.access_token;
    } catch (error) {
      return this.handleApiError(error, 'get access token');
    }
  }

  async refreshToken(refreshToken: string): Promise<string> {
    try {
      this.validateCredentials();
      const response = await this.makeApiRequest<RedditTokenResponse>('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        data: {
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        },
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
        }
      });

      return response.access_token;
    } catch (error) {
      return this.handleApiError(error, 'refresh token');
    }
  }

  async getFlairOptions(accessToken: string, subreddit: string): Promise<Array<{ id: string; text: string }>> {
    try {
      const response = await axios.get<RedditFlair[]>(
        `https://oauth.reddit.com/r/${subreddit}/api/link_flair_v2`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // If the response is empty array or has error, it means no flairs are required
      if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
        return [];
      }

      return response.data.map((flair: RedditFlair) => ({
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
    flairId?: string,
    imageUrl?: string
  ): Promise<string> {
    try {
      // First check if the subreddit requires flairs
      const flairs = await this.getFlairOptions(accessToken, subreddit);
      
      // If flairs exist but none was provided, throw an error
      if (flairs.length > 0 && !flairId) {
        throw new Error(`Flair is required for r/${subreddit}. Available flairs: ${flairs.map(f => f.text).join(', ')}`);
      }

      // If an image URL is provided, create an image post
      if (imageUrl) {
        const response = await axios.post<RedditApiResponse>(
          'https://oauth.reddit.com/api/submit',
          {
            sr: subreddit,
            kind: 'image',
            title,
            url: imageUrl,
            ...(content ? { text: content } : {}),
            ...(flairId ? { flair_id: flairId } : {}),
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        );

        if (response.data.json.errors?.length > 0) {
          throw new Error(response.data.json.errors[0][1]);
        }

        return response.data.json.data?.name || '';
      }

      // Otherwise, create a text post
      const response = await axios.post<RedditApiResponse>(
        'https://oauth.reddit.com/api/submit',
        {
          sr: subreddit,
          kind: 'self',
          title,
          text: content,
          ...(flairId ? { flair_id: flairId } : {}),
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      if (response.data.json.errors?.length > 0) {
        throw new Error(response.data.json.errors[0][1]);
      }

      return response.data.json.data?.name || '';
    } catch (error: any) {
      console.error('Error submitting post:', error);
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  }

  async revokeToken(token: string): Promise<void> {
    try {
      this.validateCredentials();
      await this.makeApiRequest('https://www.reddit.com/api/v1/revoke_token', {
        method: 'POST',
        data: {
          token
        },
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
        }
      });
    } catch (error) {
      return this.handleApiError(error, 'revoke token');
    }
  }

  async exchangeCode(code: string): Promise<RedditTokens> {
    console.log('Exchanging code for tokens...');
    try {
      this.validateCredentials();
      const response = await this.makeApiRequest<RedditTokenResponse>('/api/v1/access_token', {
        method: 'POST',
        data: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.redirectUri
        },
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
        }
      });

      console.log('Token exchange successful');
      return {
        access_token: response.access_token,
        refresh_token: response.refresh_token || '',
        expires_at: Date.now() + (response.expires_in * 1000),
      };
    } catch (error) {
      return this.handleApiError(error, 'exchange code');
    }
  }

  getAuthUrl(): string {
    const scopes = [
      'identity',
      'submit',
      'read',
      'subscribe',
      'mysubreddits',
      'flair'
    ];

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      state: 'random_state',
      redirect_uri: this.redirectUri,
      duration: 'permanent',
      scope: scopes.join(' ')
    });

    return `https://www.reddit.com/api/v1/authorize?${params.toString()}`;
  }

  async getUserInfo(accessToken: string): Promise<{ name: string; id: string }> {
    console.log('Getting user info...');
    const response = await this.makeApiRequest<RedditUserResponse>('/api/v1/me', {
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
        accessToken,
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
}
