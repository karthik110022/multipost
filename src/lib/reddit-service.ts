import axios, { AxiosError } from 'axios';
import { env, validateEnv } from '@/config/env';
import { CloudflareService } from './cloudflare-service';

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
    coin_price: number;
  }>;
  totalAwardValue: number;
  score: number;
  upvoteRatio: number;
  viewCount: number;
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
  upvotesByTime: Array<{
    hour: number;
    upvotes: number;
  }>;
  commentsByTime: Array<{
    hour: number;
    comments: number;
  }>;
  awardsByTime: Array<{
    hour: number;
    awards: number;
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

  private normalizeNetlifyUrl(url: string): string {
    // Handle all Netlify preview URL patterns
    if (url.includes('--multpost.netlify.app')) {
      // Extract the base domain without any preview prefixes
      const baseUrl = 'multpost.netlify.app';
      return `https://${baseUrl}`;
    }
    return url;
  }

  private validateCredentials() {
    try {
      console.log('Validating Reddit credentials...');
      validateEnv();

      const clientId = env.NEXT_PUBLIC_REDDIT_CLIENT_ID;
      const clientSecret = env.REDDIT_CLIENT_SECRET;
      let appUrl = env.NEXT_PUBLIC_APP_URL;

      // Normalize the URL for Netlify previews
      appUrl = this.normalizeNetlifyUrl(appUrl);

      console.log('Environment validation:', {
        clientIdPresent: !!clientId,
        clientIdValid: clientId.length > 0,
        clientSecretPresent: !!clientSecret,
        clientSecretValid: clientSecret.length > 0,
        originalAppUrl: env.NEXT_PUBLIC_APP_URL,
        normalizedAppUrl: appUrl,
        isPreviewUrl: env.NEXT_PUBLIC_APP_URL.includes('--multpost.netlify.app')
      });

      if (!clientId || !clientSecret) {
        const missingVars = [];
        if (!clientId) missingVars.push('NEXT_PUBLIC_REDDIT_CLIENT_ID');
        if (!clientSecret) missingVars.push('REDDIT_CLIENT_SECRET');
        
        console.error('Missing Reddit credentials:', {
          missingVars,
          hasClientId: !!clientId,
          hasClientSecret: !!clientSecret,
        });
        throw new Error(`Reddit credentials are not properly configured. Missing: ${missingVars.join(', ')}`);
      }

      if (!appUrl) {
        console.error('Missing APP_URL configuration');
        throw new Error('APP_URL is not properly configured');
      }

      this.clientId = clientId;
      this.clientSecret = clientSecret;
      this.redirectUri = `${appUrl}/auth/callback/reddit`;

      // Log the configuration (safely)
      console.log('Reddit Configuration:', {
        hasClientId: !!this.clientId,
        clientIdLength: this.clientId.length,
        redirectUri: this.redirectUri,
        hasSecret: !!this.clientSecret,
        secretLength: this.clientSecret.length,
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
      'Content-Type': 'application/x-www-form-urlencoded',
      ...options.headers,
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
          url,
          method: options.method,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          error: errorText,
          requestHeaders: headers,
          requestBody: options.body
        });
        
        // Try to parse error response as JSON for more details
        let errorDetails = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorDetails = JSON.stringify(errorJson, null, 2);
        } catch (e) {
          // Keep original text if it's not JSON
        }
        
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorDetails}`);
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

  async uploadMedia(accessToken: string, file: File): Promise<{ url: string; websocket_url?: string }> {
    const isVideo = file.type.startsWith('video/');
    const mediaType = isVideo ? 'video' : 'image';
    
    console.log(`Starting ${mediaType} upload...`, { 
      fileName: file.name, 
      fileSize: file.size, 
      fileType: file.type,
      mediaType 
    });

    // Use Cloudflare hosting service instead of Reddit's broken API
    try {
      const cloudflareService = new CloudflareService();
      
      if (isVideo) {
        // Use Cloudflare Stream for videos
        const videoUrl = await cloudflareService.uploadVideo(file);
        
        console.log('Video uploaded successfully via Cloudflare Stream:', videoUrl);
        
        return {
          url: videoUrl,
          websocket_url: undefined
        };
      } else {
        // Use Cloudflare Images for images
        const imageUrl = await cloudflareService.uploadImage(file);
        
        console.log('Image uploaded successfully via Cloudflare Images:', imageUrl);
        
        return {
          url: imageUrl,
          websocket_url: undefined
        };
      }
    } catch (error: any) {
      console.error(`Error uploading ${mediaType}:`, error);
      
      // Try Reddit's native API as last resort
      console.log('Attempting Reddit native upload as fallback...');
      try {
        // Try Reddit's media upload
        const leaseResponse = await this.makeApiRequest<any>('/api/media/asset.json', {
          method: 'POST',
          body: JSON.stringify({
            filepath: file.name,
            mimetype: file.type
          }),
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'MultiPost:1.0.0 (by /u/multipost-app)'
          },
          accessToken
        });

        const uploadData = new FormData();
        Object.keys(leaseResponse.args.fields).forEach(key => {
          uploadData.append(key, leaseResponse.args.fields[key]);
        });
        uploadData.append('file', file);

        const uploadResponse = await fetch(leaseResponse.args.action, {
          method: 'POST',
          body: uploadData,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.status}`);
        }

        const mediaUrl = `https://i.redd.it/${leaseResponse.asset.asset_id}`;
        return {
          url: mediaUrl,
          websocket_url: leaseResponse.asset.websocket_url
        };
      } catch (redditError) {
        console.error('Reddit native upload also failed:', redditError);
        // Return a fallback indicator
        return this.uploadMediaFallback(accessToken, file);
      }
    }
  }

  async uploadMediaFallback(accessToken: string, file: File): Promise<{ url: string; websocket_url?: string }> {
    const isVideo = file.type.startsWith('video/');
    const mediaType = isVideo ? 'video' : 'image';
    
    console.log(`Using fallback method - will create text post instead of ${mediaType} post`);
    
    // For fallback, we'll indicate that this media should be handled as text
    // The submitPost method will create a text post with media information
    return {
      url: `FALLBACK_MEDIA:${file.name}:${file.type}:${file.size}:${mediaType}`,
      websocket_url: undefined
    };
  }

  async submitPost(
    accessToken: string,
    subreddit: string,
    title: string,
    content: string,
    flairId: string,
    images?: File[],
    videos?: File[]
  ): Promise<string> {
    console.log('Starting post submission...', { 
      subreddit, 
      hasFlairId: !!flairId, 
      hasImages: !!(images && images.length > 0),
      hasVideos: !!(videos && videos.length > 0),
      imageCount: images?.length || 0,
      videoCount: videos?.length || 0,
      totalMediaCount: (images?.length || 0) + (videos?.length || 0)
    });
    
    try {
      // Remove any 'r/' prefix if present and convert to lowercase
      const cleanSubreddit = subreddit.replace(/^r\//, '').toLowerCase();
      
      // Handle media uploads if provided (images and videos)
      let uploadedMediaUrls: string[] = [];
      const allMediaFiles = [...(images || []), ...(videos || [])];
      
      if (allMediaFiles.length > 0) {
        console.log('Uploading media files via Cloudflare...');
        for (const file of allMediaFiles) {
          try {
            const isVideo = file.type.startsWith('video/');
            const mediaType = isVideo ? 'video' : 'image';
            
            const uploadResult = await this.uploadMedia(accessToken, file);
            uploadedMediaUrls.push(uploadResult.url);
            console.log(`Uploaded ${mediaType} via Cloudflare:`, uploadResult.url);
          } catch (error: any) {
            console.error(`Failed to upload ${file.type.startsWith('video/') ? 'video' : 'image'}:`, file.name, error);
            throw new Error(`Failed to upload ${file.type.startsWith('video/') ? 'video' : 'image'} ${file.name}: ${error.message}`);
          }
        }
      }
      
      console.log('Submitting post to Reddit API...');
      const formData = new URLSearchParams();
      formData.append('api_type', 'json');
      formData.append('sr', cleanSubreddit);
      
      // Determine post type based on whether we have media
      const fallbackMedia: string[] = [];
      const validMediaUrls: string[] = [];
      
      uploadedMediaUrls.forEach(url => {
        if (url.startsWith('FALLBACK_MEDIA:') || url.startsWith('FALLBACK_IMAGE:')) {
          fallbackMedia.push(url);
        } else {
          validMediaUrls.push(url);
        }
      });
      
      if (validMediaUrls.length > 0) {
        // For media posts with valid URLs, use 'link' kind with the first media as primary
        formData.append('kind', 'link');
        formData.append('url', validMediaUrls[0]);
        
        // Add content as text if provided, append other media URLs
        let fullContent = content || '';
        if (validMediaUrls.length > 1) {
          fullContent += '\n\nAdditional media:\n';
          validMediaUrls.slice(1).forEach((url, index) => {
            fullContent += `\n${index + 2}. ${url}`;
          });
        }
        if (fullContent) {
          formData.append('text', fullContent);
        }
      } else {
        // Text post (either no media or all media failed)
        formData.append('kind', 'self');
        
        let fullContent = content || '';
        
        // Don't add fallback text that triggers Reddit's spam filters
        // Just post the content without mentioning failed uploads
        if (fallbackMedia.length > 0) {
          console.log('Media upload failed, posting as text only to avoid filter triggers');
          // Don't add any text about failed uploads - this triggers spam filters
        }
        
        formData.append('text', fullContent);
      }
      
      formData.append('title', title);
      
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
      
      // Calculate total awards value
      const totalAwardValue = (postData.all_awardings || []).reduce((sum: number, award: any) => {
        return sum + (award.coin_price || 0) * award.count;
      }, 0);
      
      return {
        upvotes: postData.ups || 0,
        downvotes: postData.downs || 0,
        comments: postData.num_comments || 0,
        shares: postData.num_crossposts || 0, // Using crossposts as a proxy for shares
        awards: (postData.all_awardings || []).map((award: any) => ({
          name: award.name,
          count: award.count,
          icon_url: award.icon_url,
          coin_price: award.coin_price || 0
        })),
        totalAwardValue,
        score: postData.score || 0,
        upvoteRatio: postData.upvote_ratio || 0,
        viewCount: postData.view_count || 0
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
    
    try {
      // Validate environment variables first
      this.validateCredentials();
      
      // Log the configuration being used
      console.log('Exchange configuration:', {
        clientIdPresent: !!this.clientId,
        clientIdLength: this.clientId.length,
        clientSecretPresent: !!this.clientSecret,
        clientSecretLength: this.clientSecret.length,
        appUrl: env.NEXT_PUBLIC_APP_URL,
        redirectUri: `${env.NEXT_PUBLIC_APP_URL}/auth/callback/reddit`
      });

      const params = new URLSearchParams();
      params.append('grant_type', 'authorization_code');
      params.append('code', code);
      params.append('redirect_uri', `${env.NEXT_PUBLIC_APP_URL}/auth/callback/reddit`);

      console.log('Making token request to Reddit with params:', {
        grantType: params.get('grant_type'),
        hasCode: !!params.get('code'),
        redirectUri: params.get('redirect_uri')
      });

      const response = await fetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString()
      });

      const responseText = await response.text();
      console.log('Raw response from Reddit:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseText
      });

      if (!response.ok) {
        console.error('Error exchanging code:', {
          status: response.status,
          statusText: response.statusText,
          response: responseText
        });
        throw new Error(`Failed to exchange code: ${response.status} ${response.statusText} - ${responseText}`);
      }

      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response as JSON:', e);
        throw new Error('Invalid response format from Reddit');
      }

      const { access_token, refresh_token, expires_in } = responseData;
      
      if (!access_token) {
        console.error('No access token in response:', responseData);
        throw new Error('No access token received from Reddit');
      }

      console.log('Token exchange successful:', {
        hasAccessToken: !!access_token,
        hasRefreshToken: !!refresh_token,
        expiresIn: expires_in
      });

      return {
        access_token,
        refresh_token: refresh_token || '',
        expires_at: Date.now() + (expires_in * 1000),
      };
    } catch (error: any) {
      console.error('Error in exchangeCode:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  getAuthUrl(): string {
    try {
      console.log('Starting Reddit auth URL generation...');
      this.validateCredentials();
      
      // Log environment variables (safely)
      console.log('Environment check:', {
        hasClientId: !!this.clientId,
        clientIdLength: this.clientId.length,
        hasClientSecret: !!this.clientSecret,
        appUrl: env.NEXT_PUBLIC_APP_URL
      });

      const redirectUri = `${env.NEXT_PUBLIC_APP_URL}/auth/callback/reddit`;
      console.log('Redirect URI:', redirectUri);

      const params = {
        client_id: this.clientId,
        response_type: 'code',
        state: 'random_state',
        redirect_uri: redirectUri,
        duration: 'permanent',
        scope: 'identity submit read subscribe mysubreddits flair edit',
        prompt: 'consent'
      };

      console.log('Auth parameters:', {
        ...params,
        client_id: params.client_id.substring(0, 4) + '...' // Only show first 4 chars for security
      });

      const authUrl = `https://www.reddit.com/api/v1/authorize?${new URLSearchParams(params).toString()}`;
      console.log('Generated auth URL:', authUrl);

      return authUrl;
    } catch (error) {
      console.error('Error generating Reddit auth URL:', error);
      throw error;
    }
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

      // Analyze hourly engagement patterns
      const hourlyEngagement = new Map<number, { totalScore: number; totalComments: number; totalAwards: number; count: number }>();
      
      allPosts.forEach(post => {
        const hour = new Date(post.created_utc * 1000).getHours();
        const current = hourlyEngagement.get(hour) || { totalScore: 0, totalComments: 0, totalAwards: 0, count: 0 };
        hourlyEngagement.set(hour, {
          totalScore: current.totalScore + post.score,
          totalComments: current.totalComments + post.num_comments,
          totalAwards: current.totalAwards + (post.total_awards_received || 0),
          count: current.count + 1
        });
      });

      // Generate data for all 24 hours
      const upvotesByTime = Array.from({ length: 24 }, (_, hour) => {
        const data = hourlyEngagement.get(hour);
        return {
          hour,
          upvotes: data ? Math.round(data.totalScore / data.count) : 0
        };
      });

      const commentsByTime = Array.from({ length: 24 }, (_, hour) => {
        const data = hourlyEngagement.get(hour);
        return {
          hour,
          comments: data ? Math.round(data.totalComments / data.count) : 0
        };
      });

      const awardsByTime = Array.from({ length: 24 }, (_, hour) => {
        const data = hourlyEngagement.get(hour);
        return {
          hour,
          awards: data ? Math.round(data.totalAwards / data.count) : 0
        };
      });

      const peakHours = Array.from(hourlyEngagement.entries())
        .map(([hour, data]) => ({
          hour,
          engagement: (data.totalScore + data.totalComments) / data.count
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
        topKeywords,
        upvotesByTime,
        commentsByTime,
        awardsByTime
      };
    } catch (error) {
      console.error('Error analyzing subreddit engagement:', error);
      return {
        avgScore: 0,
        avgComments: 0,
        peakHours: [],
        topKeywords: [],
        upvotesByTime: Array.from({ length: 24 }, (_, hour) => ({ hour, upvotes: 0 })),
        commentsByTime: Array.from({ length: 24 }, (_, hour) => ({ hour, comments: 0 })),
        awardsByTime: Array.from({ length: 24 }, (_, hour) => ({ hour, awards: 0 }))
      };
    }
  }

  async deletePost(accessToken: string, postId: string): Promise<void> {
    const endpoint = `/api/del`;
    console.log('🔍 RedditService.deletePost called with:', {
      endpoint,
      postId,
      hasAccessToken: !!accessToken
    });
    
    try {
      console.log('📤 Sending delete request to Reddit API...');
      console.log('Request details:', {
        url: `https://oauth.reddit.com${endpoint}`,
        method: 'POST',
        body: `id=t3_${postId}`
      });

      // First verify the post exists and we have access to it
      const verifyResponse = await this.makeApiRequest<any>(`/by_id/t3_${postId}`, {
        method: 'GET',
        accessToken
      });

      console.log('📥 Post verification response:', verifyResponse);

      if (!verifyResponse?.data?.children?.[0]?.data) {
        throw new Error('Post not found or not accessible');
      }

      // Now attempt to delete the post
      const response = await this.makeApiRequest<any>(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `id=t3_${postId}`,
        accessToken
      });

      console.log('📥 Reddit API response:', response);

      // Check for errors in the response
      if (response?.json?.errors?.length > 0) {
        const errors = response.json.errors;
        console.error('❌ Reddit API returned errors:', errors);
        throw new Error(`Reddit API errors: ${JSON.stringify(errors)}`);
      }

      // An empty response with 200 status code indicates successful deletion
      if (response === null || Object.keys(response).length === 0) {
        console.log('✅ Post successfully deleted from Reddit (empty response indicates success)');
        return;
      }

      // If we get here, something unexpected happened
      console.error('❌ Unexpected Reddit API response:', response);
      throw new Error('Unexpected response from Reddit API');
    } catch (error: any) {
      console.error('❌ Error in RedditService.deletePost:', {
        error: error.message,
        stack: error.stack,
        postId,
        response: error.response?.data
      });

      // Handle specific Reddit API errors
      if (error.response?.data) {
        const redditError = error.response.data;
        if (redditError.reason === 'RATELIMIT') {
          throw new Error('RATE_LIMITED');
        }
        if (redditError.message) {
          throw new Error(redditError.message);
        }
      }

      throw error;
    }
  }

  async postCommentReply(accessToken: string, parentId: string, content: string): Promise<RedditComment> {
    try {
      console.log('Posting comment reply:', { parentId });
      
      const formData = new URLSearchParams();
      formData.append('api_type', 'json');
      formData.append('text', content);
      formData.append('thing_id', parentId);

      const response = await this.makeApiRequest<any>('/api/comment', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
        accessToken
      });

      console.log('Comment reply response:', response);

      if (response?.json?.errors?.length > 0) {
        const [errorCode, errorMessage] = response.json.errors[0];
        throw new Error(errorMessage || errorCode);
      }

      if (!response?.json?.data?.things?.[0]?.data) {
        throw new Error('Failed to get comment data from response');
      }

      const commentData = response.json.data.things[0].data;
      return {
        id: commentData.id,
        author: commentData.author,
        body: commentData.body,
        created_utc: commentData.created_utc,
        score: commentData.score,
        replies: []
      };
    } catch (error: any) {
      console.error('Error posting comment reply:', error);
      throw error;
    }
  }
}
