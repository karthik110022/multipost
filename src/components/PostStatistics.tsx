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
  }>;
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

export function PostStatistics({ postId, accountId }: PostStatsProps) {
  const [stats, setStats] = useState<PostStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 seconds

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

      if (isMounted) {
        setLoading(true);
        setError(null);
      }

      try {
        console.log('Checking post status...', { postId, accountId });
        
        const { data: postData, error: postError } = await supabase
          .from('posts')
          .select(`
            *,
            post_platforms (
              id,
              platform_post_id,
              status,
              error_message,
              subreddit,
              social_account_id,
              published_at,
              social_accounts (
                platform,
                account_name
              )
            )
          `)
          .eq('id', postId)
          .maybeSingle();

        if (postError) {
          console.error('Error fetching post:', postError);
          setError(postError.message);
          setLoading(false);
          return;
        }

        console.log('Post data:', postData);

        if (!postData) {
          const error = new Error('Post not found');
          console.error(error);
          setError(error.message);
          setLoading(false);
          return;
        }

        const platformData = postData.post_platforms?.find(
          (platform: PlatformData) => platform.social_account_id === accountId
        );
        
        console.log('Platform data:', platformData);
        
        if (!platformData) {
          const error = new Error('No platform data found for this post');
          console.error(error);
          setError(error.message);
          setLoading(false);
          return;
        }

        if (platformData.status !== 'published') {
          console.log('Post not yet published. Status:', platformData.status);
          if (platformData.status === 'failed') {
            const error = new Error('Post failed to publish');
            setError(error.message);
            setLoading(false);
            return;
          } else {
            // Only retry for pending/draft posts
            if (retryCount < MAX_RETRIES) {
              console.log(`Retrying in ${RETRY_DELAY}ms (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
              setRetryCount(prev => prev + 1);
              retryTimeout = setTimeout(fetchStats, RETRY_DELAY);
              return;
            } else {
              const error = new Error(`Post is ${platformData.status}`);
              setError(error.message);
              setLoading(false);
              return;
            }
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
    
    // Set up real-time subscription for post_platforms changes
    const subscription = supabase
      .channel('post-stats-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'post_platforms',
          filter: `post_id=eq.${postId} AND social_account_id=eq.${accountId}`
        },
        (payload) => {
          console.log('Post platform update:', payload);
          // Reset retry count and fetch stats when the post status changes
          if (isMounted) {
            setRetryCount(0);
            fetchStats();
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      if (retryTimeout) {
        console.log('Cleaning up subscription');
        clearTimeout(retryTimeout);
      }
      console.log('Cleaning up subscription');
      subscription.unsubscribe();
    };
  }, [postId, accountId, retryCount]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-[200px]" />
            <Skeleton className="h-4 w-[150px]" />
            <Skeleton className="h-4 w-[180px]" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-4 text-red-500">
          {error}
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
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
