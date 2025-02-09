'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { toast } from 'react-hot-toast';
import { createBrowserClient } from '@supabase/ssr';
import { SocialMediaService } from '@/lib/social-media-service';
import type { PostHistory as PostHistoryType } from '@/lib/social-media-service';

// Create Supabase client
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function PostHistory() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostHistoryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const socialMediaService = new SocialMediaService();

  useEffect(() => {
    if (user) {
      loadPosts();
    }
  }, [user]);

  const loadPosts = async () => {
    try {
      const posts = await socialMediaService.getPostHistory();
      setPosts(posts);
    } catch (error) {
      console.error('Error loading posts:', error);
      setError('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (postId: string) => {
    try {
      await socialMediaService.deletePostHistory(postId);
      toast.success('Post deleted successfully');
      loadPosts();
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error('Failed to delete post');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#FF4500]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 p-4 rounded-md">
        {error}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">No posts yet</h3>
        <p className="mt-1 text-sm text-gray-500">Your post history will appear here once you create posts.</p>
      </div>
    );
  }

  const filteredPosts = posts.filter(post =>
    filter === 'all' ? true : post.account?.platform === filter.toLowerCase()
  );

  return (
    <div className="p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Post History</h1>
        <div className="flex items-center space-x-4">
          <label htmlFor="platform-filter" className="text-sm font-medium text-gray-700">
            Filter by Platform:
          </label>
          <select
            id="platform-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="all">All Platforms</option>
            <option value="reddit">Reddit</option>
          </select>
        </div>
      </div>

      <div className="space-y-6">
        {filteredPosts.map((post) => (
          <div key={post.id} className="bg-white shadow rounded-lg p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  {post.title || 'Untitled Post'}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {post.content}
                </p>
                {post.media_urls && post.media_urls.length > 0 && (
                  <div className="mt-4">
                    <img 
                      src={post.media_urls[0]} 
                      alt="Post media" 
                      className="max-w-md rounded-lg shadow-md"
                    />
                  </div>
                )}
              </div>
              <div className="flex space-x-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(post.status)}`}>
                  {post.status}
                </span>
                {post.account?.platform && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {post.account.platform}
                  </span>
                )}
                {post.errorMessage && (
                  <span className="text-xs text-red-600">{post.errorMessage}</span>
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-between items-center text-sm text-gray-500">
              <div>
                {(() => {
                  if (!post.createdAt) return 'Date not available';
                  try {
                    return `Posted ${formatDistanceToNow(parseISO(post.createdAt))} ago`;
                  } catch (error) {
                    console.error('Error formatting date:', error);
                    return 'Invalid date';
                  }
                })()}
              </div>
              <div className="flex items-center space-x-4">
                {post.postUrl && (
                  <a
                    href={post.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    View on Reddit
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(post.id)}
                  className="text-red-600 hover:text-red-900"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
