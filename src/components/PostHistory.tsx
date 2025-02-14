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

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
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

  return (
    <div className="p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Post History</h1>
      </div>

      <div className="space-y-6">
        {posts.map((post) => (
          <div key={post.id} className="bg-white shadow rounded-lg p-6">
            <div className="space-y-4">
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

              {/* Platform Statuses */}
              {post.platformStatuses && post.platformStatuses.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Posted to:</h4>
                  <div className="space-y-2">
                    {post.platformStatuses.map((status, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium capitalize">{status.platform}</span>
                          {status.subreddit && (
                            <span className="text-gray-500">r/{status.subreddit}</span>
                          )}
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status.status)}`}>
                            {status.status}
                          </span>
                          {status.postUrl && (
                            <a
                              href={status.postUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              View Post
                            </a>
                          )}
                          {status.errorMessage && (
                            <span className="text-red-600">{status.errorMessage}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Posted From Accounts */}
              {post.accounts && post.accounts.length > 0 && (
                <div className="mt-2">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Posted from accounts:</h4>
                  <div className="flex flex-wrap gap-2">
                    {post.accounts.map((account, index) => (
                      <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                        {account.account_name} ({account.platform})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 text-sm text-gray-500">
                {post.createdAt && formatDistanceToNow(parseISO(post.createdAt), { addSuffix: true })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
