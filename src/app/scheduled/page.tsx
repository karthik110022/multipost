'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { format } from 'date-fns';
import PostForm from '@/components/PostForm';
import { useAuth } from '@/context/AuthContext';

interface ScheduledPost {
  id: string;
  title: string;
  content: string;
  scheduled_for: string;
  status: string;
  created_at: string;
}

export default function ScheduledPosts() {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const { user } = useAuth();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    fetchScheduledPosts();
  }, []);

  const fetchScheduledPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .in('status', ['scheduled'])
        .order('scheduled_for', { ascending: true });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error fetching scheduled posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Scheduled Posts</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          {showForm ? 'Hide Form' : 'Create Scheduled Post'}
        </button>
      </div>

      {showForm && (
        <div className="mb-8 p-6 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Create Scheduled Post</h2>
          <PostForm user={user} isScheduled={true} onPostCreated={() => {
            setShowForm(false);
            fetchScheduledPosts();
          }} />
        </div>
      )}

      {posts.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600">No scheduled posts found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className="border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-xl font-semibold">{post.title}</h2>
                <span
                  className={`px-2 py-1 rounded-full text-sm ${getStatusColor(
                    post.status
                  )}`}
                >
                  {post.status}
                </span>
              </div>
              <p className="text-gray-600 mb-4 line-clamp-2">{post.content}</p>
              <div className="flex justify-between items-center text-sm text-gray-500">
                <span>
                  Scheduled for:{' '}
                  {format(
                    // Convert UTC to local time
                    new Date(post.scheduled_for),
                    'MMM d, yyyy h:mm a (O)'
                  )}
                </span>
                <span>
                  Created:{' '}
                  {format(
                    new Date(post.created_at),
                    'MMM d, yyyy h:mm a (O)'
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
