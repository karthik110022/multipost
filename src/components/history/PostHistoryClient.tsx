'use client';

import { User } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { format, parseISO } from 'date-fns';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { PostStatistics } from '@/components/PostStatistics';

interface Post {
  id: string;
  title: string;
  content: string;
  platform: string;
  status: string;
  created_at: string;
  scheduled_for?: string;
  media_urls?: string[];
  url?: string;
  subreddit?: string;
  external_post_id?: string;
  account_id?: string;
  post_platforms?: {
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
  }[];
}

interface PostHistoryClientProps {
  user: User;
  initialPosts: Post[];
}

export default function PostHistoryClient({ user, initialPosts }: PostHistoryClientProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    try {
      return format(parseISO(dateStr), 'MMM d, yyyy h:mm a');
    } catch (error) {
      console.error('Error formatting date:', dateStr, error);
      return 'Invalid date';
    }
  };

  useEffect(() => {
    async function fetchPosts() {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Fetching posts...');
        const { data: posts, error } = await supabase
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
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching posts:', error);
          throw error;
        }

        console.log('Fetched posts:', posts);
        setPosts(posts || []);
      } catch (error) {
        console.error('Error in fetchPosts:', error);
        setError('Failed to load posts');
      } finally {
        setLoading(false);
      }
    }

    // Initial fetch
    fetchPosts();

    // Subscribe to post_platforms changes
    const subscription = supabase
      .channel('post-platforms-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_platforms'
        },
        async (payload) => {
          console.log('Received post_platforms update:', payload);
          
          if (payload.eventType === 'UPDATE') {
            // Fetch the complete post data that contains this platform
            const { data: updatedPost, error } = await supabase
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
              .eq('id', payload.new.post_id)
              .single();

            if (error) {
              console.error('Error fetching updated post:', error);
              return;
            }

            if (updatedPost) {
              console.log('Updating post in state:', updatedPost);
              setPosts(currentPosts => 
                currentPosts.map(post => 
                  post.id === updatedPost.id ? updatedPost : post
                )
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up subscriptions...');
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Filter posts based on platform
  const filteredPosts = posts.filter((post) => {
    if (filter === 'all') return true;
    const platform = post.post_platforms?.[0]?.social_accounts?.platform || post.platform;
    return platform.toLowerCase() === filter.toLowerCase();
  });

  const getPostStatus = (post: Post) => {
    if (!post.post_platforms || post.post_platforms.length === 0) {
      return 'pending';
    }
    
    // Get the latest platform status
    const latestPlatform = post.post_platforms[0];
    return latestPlatform.status || 'pending';
  };

  const getPostUrl = (post: Post) => {
    const platformPostId = post.post_platforms?.[0]?.platform_post_id;
    if (!platformPostId) return null;
    
    return `https://reddit.com/${platformPostId}`;
  };

  const getPostSubreddit = (post: Post) => {
    return post.post_platforms?.[0]?.subreddit || post.subreddit;
  };

  const getPostAccount = (post: Post) => {
    return post.post_platforms?.[0]?.social_accounts;
  };

  const getPlatformColor = (platform: string | undefined) => {
    if (!platform) return 'bg-gray-100 text-gray-800';
    
    switch (platform.toLowerCase()) {
      case 'reddit':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string | undefined) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    switch (status.toLowerCase()) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'karma_insufficient':
        return 'bg-orange-100 text-orange-800';
      case 'rate_limited':
        return 'bg-purple-100 text-purple-800';
      case 'invalid_subreddit':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Post History</h1>

      {/* Filter Controls */}
      <div className="mb-6">
        <label htmlFor="platform-filter" className="block text-sm font-medium text-gray-700 mb-2">
          Filter by Platform
        </label>
        <select
          id="platform-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
        >
          <option value="all">All Platforms</option>
          <option value="reddit">Reddit</option>
        </select>
      </div>

      {/* Posts List */}
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : error ? (
        <div className="text-center py-8 text-gray-500">
          {error}
        </div>
      ) : filteredPosts.length > 0 ? (
        <div className="space-y-4">
          {filteredPosts.map((post) => {
            const status = getPostStatus(post);
            const postUrl = getPostUrl(post);
            const subreddit = getPostSubreddit(post);
            const account = getPostAccount(post);
            
            return (
              <div
                key={post.id}
                className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-semibold">{post.title || 'Untitled Post'}</h2>
                  <div className="flex space-x-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getPlatformColor(
                        account?.platform || post.platform
                      )}`}
                    >
                      {account?.platform || post.platform}
                    </span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}
                    >
                      {status}
                    </span>
                  </div>
                </div>
                <p className="text-gray-600 mb-4">{post.content}</p>
                {post.post_platforms?.[0]?.error_message && (
                  <p className="text-red-600 text-sm mb-4">{post.post_platforms[0].error_message}</p>
                )}
                <div className="flex justify-between items-center text-sm text-gray-500">
                  <div>
                    <p>Created: {formatDate(post.created_at)}</p>
                    {post.post_platforms?.[0]?.published_at && (
                      <p>Published: {formatDate(post.post_platforms[0].published_at)}</p>
                    )}
                  </div>
                  {postUrl && (
                    <a
                      href={postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-800"
                    >
                      View Post →
                    </a>
                  )}
                </div>
                {subreddit && (
                  <div className="mt-2 text-sm text-gray-500">
                    Posted to r/{subreddit}
                  </div>
                )}
                {post.post_platforms?.[0]?.platform_post_id && post.post_platforms?.[0]?.social_account_id && (
                  <div className="mt-4">
                    <PostStatistics 
                      postId={post.id} 
                      accountId={post.post_platforms[0].social_account_id} 
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No posts found. Start creating posts to see them here!
        </div>
      )}
    </div>
  );
}
