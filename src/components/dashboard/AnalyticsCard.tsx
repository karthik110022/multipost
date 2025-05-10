'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { PostStatistics } from '@/components/PostStatistics';

interface Post {
  id: string;
  title: string;
  post_platforms: {
    id: string;
    platform_post_id: string;
    status: string;
    social_account_id: string;
  }[];
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

interface AnalyticsData {
  totalPosts: number;
  successfulPosts: number;
  failedPosts: number;
  pendingPosts: number;
  postsByPlatform: {
    platform: string;
    count: number;
  }[];
  posts: Post[];
  totalReach: {
    upvotes: number;
    comments: number;
    views: number;
  };
}

export default function AnalyticsCard() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [postStats, setPostStats] = useState<Record<string, PostStats>>({});

  const handleStatsUpdate = useCallback((postId: string, stats: PostStats) => {
    setPostStats(prev => {
      // Only update if the stats have actually changed
      if (JSON.stringify(prev[postId]) === JSON.stringify(stats)) {
        return prev;
      }
      return { ...prev, [postId]: stats };
    });
  }, []);

  // Calculate total reach using useMemo to prevent unnecessary recalculations
  const totalReach = useMemo(() => {
    return Object.values(postStats).reduce((acc, stats) => {
      acc.upvotes += stats.upvotes;
      acc.comments += stats.comments;
      acc.views += stats.viewCount;
      return acc;
    }, { upvotes: 0, comments: 0, views: 0 });
  }, [postStats]);

  // Update analytics with new total reach
  useEffect(() => {
    if (analytics) {
      setAnalytics(prev => {
        if (!prev) return null;
        // Only update if the total reach has actually changed
        if (
          prev.totalReach.upvotes === totalReach.upvotes &&
          prev.totalReach.comments === totalReach.comments &&
          prev.totalReach.views === totalReach.views
        ) {
          return prev;
        }
        return { ...prev, totalReach };
      });
    }
  }, [totalReach, analytics]);

  useEffect(() => {
    let mounted = true;

    const fetchAnalytics = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      try {
        const { data: posts, error: postsError } = await supabase
          .from('posts')
          .select(`
            id,
            title,
            post_platforms (
              id,
              platform_post_id,
              status,
              social_account_id
            )
          `);

        if (postsError) throw postsError;

        if (!mounted) return;

        const typedPosts = (posts || []) as unknown as Post[];
        const successfulPosts = typedPosts.filter(post => 
          post.post_platforms?.some(pp => pp.status === 'success')
        );

        const stats: AnalyticsData = {
          totalPosts: typedPosts.length,
          successfulPosts: successfulPosts.length,
          failedPosts: typedPosts.filter(post => 
            post.post_platforms?.some(pp => pp.status === 'failed')
          ).length,
          pendingPosts: typedPosts.filter(post => 
            post.post_platforms?.some(pp => pp.status === 'pending')
          ).length,
          postsByPlatform: [
            {
              platform: 'Reddit',
              count: successfulPosts.length
            }
          ],
          posts: typedPosts,
          totalReach: {
            upvotes: 0,
            comments: 0,
            views: 0
          }
        };

        setAnalytics(stats);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching analytics:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchAnalytics();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Post Analytics</h2>
      
      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#FF4500] bg-opacity-10 rounded-lg p-4">
          <div className="text-2xl font-bold text-[#FF4500]">{analytics.totalPosts}</div>
          <div className="text-sm text-gray-600">Total Posts</div>
        </div>
        <div className="bg-green-100 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">{analytics.successfulPosts}</div>
          <div className="text-sm text-gray-600">Successful</div>
        </div>
        <div className="bg-red-100 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-600">{analytics.failedPosts}</div>
          <div className="text-sm text-gray-600">Failed</div>
        </div>
        <div className="bg-yellow-100 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-600">{analytics.pendingPosts}</div>
          <div className="text-sm text-gray-600">Pending</div>
        </div>
      </div>

      {/* Total Reach */}
      <div className="mt-8 mb-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Total Reach</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-[#FF4500]">{analytics.totalReach.upvotes.toLocaleString()}</div>
                <div className="text-sm text-gray-600">Total Upvotes</div>
              </div>
              <div className="p-2 bg-[#FF4500] bg-opacity-10 rounded-lg">
                <svg className="w-6 h-6 text-[#FF4500]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-blue-600">{analytics.totalReach.comments.toLocaleString()}</div>
                <div className="text-sm text-gray-600">Total Comments</div>
              </div>
              <div className="p-2 bg-blue-500 bg-opacity-10 rounded-lg">
                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-purple-600">{analytics.totalReach.views.toLocaleString()}</div>
                <div className="text-sm text-gray-600">Total Views</div>
              </div>
              <div className="p-2 bg-purple-500 bg-opacity-10 rounded-lg">
                <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Performing Posts */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Top Performing Posts</h3>
        <div className="space-y-4">
          {analytics.posts
            .filter(post => post.post_platforms?.some(pp => pp.status === 'success'))
            .slice(0, 3)
            .map((post, index) => (
              <div key={post.id} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-2">{post.title}</h4>
                    {post.post_platforms?.[0]?.platform_post_id && post.post_platforms?.[0]?.social_account_id && (
                      <PostStatistics 
                        postId={post.id}
                        accountId={post.post_platforms[0].social_account_id}
                        onStatsUpdate={(stats) => handleStatsUpdate(post.id, stats)}
                      />
                    )}
                  </div>
                  <div className="ml-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FF4500] text-white">
                      #{index + 1}
                    </span>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Success Rate */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-3">Success Rate</h3>
        <div className="relative pt-1">
          <div className="flex mb-2 items-center justify-between">
            <div>
              <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-[#FF4500] bg-[#FF4500] bg-opacity-10">
                Progress
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold inline-block text-[#FF4500]">
                {Math.round((analytics.successfulPosts / analytics.totalPosts) * 100)}%
              </span>
            </div>
          </div>
          <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200">
            <div
              style={{ width: `${(analytics.successfulPosts / analytics.totalPosts) * 100}%` }}
              className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-[#FF4500]"
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
} 