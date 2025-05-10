'use client';

import { User } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { format, parseISO } from 'date-fns';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { PostStatistics } from '@/components/PostStatistics';
import CommentModal from '@/components/CommentModal';
import { toast } from 'react-hot-toast';

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
  const [selectedPost, setSelectedPost] = useState<{ id: string; accountId: string } | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
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
    
    // If the platform_post_id already includes the full path, use it directly
    if (platformPostId.startsWith('http')) {
      return platformPostId;
    }
    
    // Otherwise, construct the Reddit URL
    return `https://reddit.com/comments/${platformPostId}`;
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

  const handleDeletePost = async (postId: string, platformPostId?: string, socialAccountId?: string) => {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      return;
    }

    setDeletingPostId(postId);
    try {
      console.log('🗑️ Starting post deletion process:', {
        postId,
        platformPostId,
        socialAccountId
      });

      // If the post was published to Reddit, use the Reddit deletion endpoint
      const endpoint = platformPostId && socialAccountId
        ? `/api/social/delete-reddit-post?postId=${postId}&platformPostId=${platformPostId}&socialAccountId=${socialAccountId}`
        : `/api/social/delete-post?postId=${postId}`;

      console.log('📤 Sending delete request to:', endpoint);
      const response = await fetch(endpoint, {
        method: 'DELETE',
      });

      const data = await response.json();
      console.log('📥 Delete response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete post');
      }

      toast.success('Post deleted successfully');
      console.log('✅ Post deleted successfully');
      setPosts(posts.filter(post => post.id !== postId));
    } catch (error: any) {
      console.error('❌ Error deleting post:', {
        error: error.message,
        stack: error.stack
      });
      toast.error(error.message || 'Failed to delete post');
    } finally {
      setDeletingPostId(null);
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
            const platformPostId = post.post_platforms?.[0]?.platform_post_id;
            const socialAccountId = post.post_platforms?.[0]?.social_account_id;
            
            return (
              <div
                key={post.id}
                className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-semibold">{post.title || 'Untitled Post'}</h2>
                  <div className="flex items-center space-x-2">
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
                    <button
                      onClick={() => handleDeletePost(post.id, platformPostId, socialAccountId)}
                      disabled={deletingPostId === post.id}
                      className={`p-1 rounded-full hover:bg-red-100 transition-colors ${
                        deletingPostId === post.id ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      title="Delete post"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-red-500"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
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
                {post.post_platforms?.map((platform) => (
                  platform.platform_post_id && (
                    <button
                      key={platform.id}
                      onClick={() => setSelectedPost({ 
                        id: platform.platform_post_id,
                        accountId: platform.social_account_id
                      })}
                      className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                      <span>View Comments</span>
                    </button>
                  )
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No posts found. Start creating posts to see them here!
        </div>
      )}
      <CommentModal
        isOpen={!!selectedPost}
        onClose={() => setSelectedPost(null)}
        postId={selectedPost?.id || ''}
        accountId={selectedPost?.accountId || ''}
      />
    </div>
  );
}
