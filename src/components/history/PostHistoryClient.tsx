'use client';

import { User } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { format, parseISO } from 'date-fns';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

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
}

interface PostHistoryClientProps {
  user: User;
  initialPosts: Post[];
}

export default function PostHistoryClient({ user, initialPosts }: PostHistoryClientProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [loading, setLoading] = useState(false);
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
    const postsSubscription = supabase
      .channel('posts-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: RealtimePostgresChangesPayload<Post>) => {
          if (payload.eventType === 'INSERT') {
            setPosts((current) => [payload.new as Post, ...current]);
          } else if (payload.eventType === 'DELETE') {
            setPosts((current) =>
              current.filter((post) => post.id !== (payload.old as Post).id)
            );
          } else if (payload.eventType === 'UPDATE') {
            setPosts((current) =>
              current.map((post) =>
                post.id === (payload.new as Post).id ? (payload.new as Post) : post
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      postsSubscription.unsubscribe();
    };
  }, [supabase, user.id]);

  const filteredPosts = posts.filter((post) =>
    filter === 'all' ? true : post.platform === filter
  );

  const getPlatformColor = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'reddit':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
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
      ) : filteredPosts.length > 0 ? (
        <div className="space-y-4">
          {filteredPosts.map((post) => (
            <div
              key={post.id}
              className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-semibold">{post.title || 'Untitled Post'}</h2>
                <div className="flex space-x-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getPlatformColor(
                      post.platform
                    )}`}
                  >
                    {post.platform}
                  </span>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                      post.status
                    )}`}
                  >
                    {post.status}
                  </span>
                </div>
              </div>
              <p className="text-gray-600 mb-4">{post.content}</p>
              <div className="flex justify-between items-center text-sm text-gray-500">
                <div>
                  <p>Created: {formatDate(post.created_at)}</p>
                  {post.scheduled_for && (
                    <p>Scheduled for: {formatDate(post.scheduled_for)}</p>
                  )}
                </div>
                {post.url && (
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-800"
                  >
                    View Post →
                  </a>
                )}
              </div>
              {post.subreddit && (
                <div className="mt-2 text-sm text-gray-500">
                  Posted to r/{post.subreddit}
                </div>
              )}
              {post.media_urls && post.media_urls.length > 0 && (
                <div className="mt-4 flex gap-2 flex-wrap">
                  {post.media_urls.map((url, index) => (
                    <a
                      key={index}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-indigo-600 hover:text-indigo-800"
                    >
                      Media {index + 1}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No posts found. Start creating posts to see them here!
        </div>
      )}
    </div>
  );
}
