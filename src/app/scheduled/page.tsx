'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { format } from 'date-fns';
import PostForm from '@/components/PostForm';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'react-hot-toast';
import NoAccountsMessage from '@/components/NoAccountsMessage';
import { useRouter } from 'next/navigation';
import { AnalyticsProvider } from '@/components/AnalyticsProvider';
import AnalyticsDisplay from '@/components/AnalyticsDisplay';
import { LoadingButton } from '@/components/ui/PageTransition';

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
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [hasAccounts, setHasAccounts] = useState<boolean | null>(null);
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    if (!user) {
      router.push('/auth/signin');
      return;
    }
    checkAccounts();
    fetchScheduledPosts();
  }, [user]);

  const checkAccounts = async () => {
    if (!user) return;
    
    const { data: accounts } = await supabase
      .from('social_accounts')
      .select('id')
      .eq('user_id', user.id);

    setHasAccounts(accounts && accounts.length > 0);
  };

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
      toast.error('Failed to fetch scheduled posts');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this scheduled post?')) {
      return;
    }

    setDeletingPostId(postId);
    try {
      const response = await fetch(`/api/social/delete-scheduled?postId=${postId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete post');
      }

      toast.success('Post deleted successfully');
      setPosts(posts.filter(post => post.id !== postId));
    } catch (error: any) {
      console.error('Error deleting post:', error);
      toast.error(error.message || 'Failed to delete post');
    } finally {
      setDeletingPostId(null);
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

  if (loading || hasAccounts === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!hasAccounts) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <NoAccountsMessage />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Scheduled Posts</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 font-medium transition-all duration-200 hover:scale-105 active:scale-95"
        >
          {showForm ? 'Hide Form' : 'Create Scheduled Post'}
        </button>
      </div>

      {showForm && (
        <div className="mb-8">
          <AnalyticsProvider>
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Main Content - Post Form */}
              <div className="lg:w-[60%]">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="p-6 border-b border-gray-100">
                    <h2 className="text-2xl font-bold text-gray-900">Create Scheduled Post</h2>
                    <p className="text-gray-600 mt-1">Schedule your content for later posting</p>
                  </div>
                  <div className="p-6">
                    <PostForm user={user} isScheduled={true} onPostCreated={() => {
                      setShowForm(false);
                      fetchScheduledPosts();
                    }} />
                  </div>
                </div>
              </div>

              {/* Sidebar - Analytics */}
              <div className="lg:w-[40%] lg:sticky lg:top-8 self-start">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="p-6 border-b border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-900">Post Analytics</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Get insights to optimize your post's performance
                    </p>
                  </div>
                  <div className="p-6">
                    <AnalyticsDisplay />
                  </div>
                </div>
              </div>
            </div>
          </AnalyticsProvider>
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
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2 py-1 rounded-full text-sm ${getStatusColor(
                      post.status
                    )}`}
                  >
                    {post.status}
                  </span>
                  <LoadingButton
                    onClick={() => handleDeletePost(post.id)}
                    loading={deletingPostId === post.id}
                    className="p-2 rounded-full hover:bg-red-100 transition-colors text-red-500 hover:text-red-700"
                    disabled={deletingPostId !== null}
                  >
                    {deletingPostId === post.id ? (
                      <div className="h-5 w-5 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-red-500"></div>
                      </div>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </LoadingButton>
                </div>
              </div>
              <p className="text-gray-600 mb-4 line-clamp-2">{post.content}</p>
              <div className="flex justify-between items-center text-sm text-gray-500">
                <span>
                  Scheduled for:{' '}
                  {format(
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
