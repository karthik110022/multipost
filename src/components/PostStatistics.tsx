'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { socialMediaService } from '@/lib/social-media-service';
import { RedditService } from '@/lib/reddit-service';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowBigUp,
  ArrowBigDown,
  MessageCircle,
  Share2,
  Award
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface PostStatsProps {
  postId: string;
  accountId: string;
  onStatsUpdate?: (stats: PostStats) => void;
}

interface PostStats {
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

interface PlatformData {
  id: string;
  platform_post_id: string;
  status: string;
  error_message: string;
  subreddit: string;
  social_account_id: string;
  published_at: string;
  social_accounts?: {
    platform: string;
    account_name: string;
  };
}

export function PostStatistics({ postId, accountId, onStatsUpdate }: PostStatsProps) {
  const [stats, setStats] = useState<PostStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 10;
  const RETRY_DELAY = 1000; // 1 second

  useEffect(() => {
    let isMounted = true;
    let retryTimeout: NodeJS.Timeout;

    const fetchStats = async () => {
      if (!postId || !accountId) {
        console.log('Missing postId or accountId');
        setError('Missing required data');
        setLoading(false);
        return;
      }

      try {
        console.log('Checking post status...', { postId, accountId, retryCount });
        
        // Direct query for the platform record
        const { data: platformData, error: platformError } = await supabase
          .from('post_platforms')
          .select(`
            *,
            social_accounts (
              platform,
              account_name
            )
          `)
          .eq('post_id', postId)
          .eq('social_account_id', accountId)
          .single();

        if (platformError) {
          console.error('Error fetching platform data:', platformError);
          setError(platformError.message);
          setLoading(false);
          return;
        }

        console.log('Platform data:', platformData);
        
        if (!platformData) {
          const error = new Error('No platform data found for this post');
          console.error(error);
          setError(error.message);
          setLoading(false);
          return;
        }

        if (platformData.status !== 'published') {
          console.log('Post not yet published.', {
            currentStatus: platformData.status,
            retryCount,
            maxRetries: MAX_RETRIES,
            platformPostId: platformData.platform_post_id
          });

          if (platformData.status === 'failed') {
            setError('Post failed to publish');
            setLoading(false);
            return;
          }

          // Only retry for pending posts
          if (retryCount < MAX_RETRIES) {
            console.log(`Retrying in ${RETRY_DELAY}ms (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
            setRetryCount(prev => prev + 1);
            retryTimeout = setTimeout(fetchStats, RETRY_DELAY);
            return;
          } else {
            setError(`Post is ${platformData.status}`);
            setLoading(false);
            return;
          }
        }

        if (!platformData.platform_post_id) {
          const error = new Error('Post ID not found');
          console.error(error);
          setError(error.message);
          setLoading(false);
          return;
        }

        console.log('Fetching account data...');
        const account = await socialMediaService.getAccount(accountId);
        if (!account?.accessToken) {
          const error = new Error('Account not found or no access token');
          console.error(error);
          setError(error.message);
          setLoading(false);
          return;
        }

        console.log('Fetching post stats for ID:', platformData.platform_post_id);
        const redditService = new RedditService();
        const postStats = await redditService.getPostStats(account.accessToken, platformData.platform_post_id);
        console.log('Received post stats:', postStats);
        
        if (isMounted) {
          setStats(postStats);
          setRetryCount(0); // Reset retry count on success
          setLoading(false);
          onStatsUpdate?.(postStats);
        }
      } catch (err) {
        console.error('Error fetching stats:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch post statistics';
        
        if (isMounted) {
          setError(errorMessage);
          setLoading(false);
        }
      }
    };

    fetchStats();
    
    return () => {
      isMounted = false;
      if (retryTimeout) {
        console.log('Cleaning up retry timeout');
        clearTimeout(retryTimeout);
      }
    };
  }, [postId, accountId, retryCount, onStatsUpdate]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3 animate-pulse">
            <div className="flex items-center space-x-2">
              <div className="h-5 w-5 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 w-12 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 w-12 bg-gray-200 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
            <div className="text-center py-2">
              <div className="text-sm text-gray-500">Loading post statistics...</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-red-600 font-medium">Analytics Unavailable</p>
              <p className="text-sm text-gray-500 mt-1">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center space-x-2">
            <div className="flex items-center">
              <ArrowBigUp className="text-green-500" />
              <span className="ml-1">{stats.upvotes}</span>
            </div>
            <div className="flex items-center">
              <ArrowBigDown className="text-red-500" />
              <span className="ml-1">{stats.downvotes}</span>
            </div>
            <div className="text-sm text-gray-500">
              ({Math.round(stats.upvoteRatio * 100)}% upvoted)
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <MessageCircle className="text-blue-500" />
            <span>{stats.comments} comments</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Share2 className="text-purple-500" />
            <span>{stats.shares} shares</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Award className="text-yellow-500" />
            <span>{stats.awards.reduce((sum, award) => sum + award.count, 0)} awards</span>
            {stats.totalAwardValue > 0 && (
              <span className="text-sm text-gray-500">
                ({stats.totalAwardValue} coins)
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="text-sm text-gray-500">
            <span className="font-medium">Score:</span> {stats.score}
          </div>
          <div className="text-sm text-gray-500">
            <span className="font-medium">Views:</span> {stats.viewCount.toLocaleString()}
          </div>
        </div>

        {stats.awards.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Awards</h4>
            <div className="flex flex-wrap gap-2">
              {stats.awards.map((award, index) => (
                <Badge key={index} variant="secondary" className="flex items-center">
                  <img 
                    src={award.icon_url} 
                    alt={award.name} 
                    className="w-4 h-4 mr-1"
                  />
                  {award.count}x {award.name}
                  {award.coin_price > 0 && (
                    <span className="ml-1 text-xs text-gray-500">
                      ({award.coin_price} coins)
                    </span>
                  )}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
