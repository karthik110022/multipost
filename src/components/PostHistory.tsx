'use client';

import { useState, useEffect } from 'react';
import { SocialMediaService } from '@/lib/social-media-service';
import { useAuth } from '@/context/AuthContext';

function PostHistory() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const socialMediaService = new SocialMediaService();

  useEffect(() => {
    if (user) {
      loadPosts();
    }
  }, [user]);

  const loadPosts = async () => {
    try {
      const posts = await socialMediaService.getPostHistory();
      console.log('Posts with account details:', posts);
      setPosts(posts);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!user) {
    return <div className="text-center p-4">Please log in to view your post history.</div>;
  }

  if (loading) {
    return <div className="text-center p-4">Loading...</div>;
  }

  if (posts.length === 0) {
    return (
      <div className="text-center p-4 text-gray-500">
        No posts found. Create a new post to get started!
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {posts.map((post) => {
        // Debug log for each post
        console.log('Post details:', {
          id: post.id,
          title: post.title,
          platforms: post.platforms?.map((p: any) => ({
            subreddit: p.subreddit,
            accountName: p.account?.accountName,
            accountId: p.account?.accountId
          }))
        });

        return (
          <div key={post.id} className="bg-white rounded-lg shadow-md p-6">
            {/* Post Header with Title and Time */}
            <div className="mb-4">
              <h2 className="text-xl font-semibold">{post.title}</h2>
              <div className="text-sm text-gray-500 mt-1">
                Created {formatDate(post.created_at)}
              </div>
            </div>

            {/* Post Content */}
            <div className="whitespace-pre-wrap text-gray-700 mb-4">
              {post.content}
            </div>

            {/* Media Display */}
            {post.media_urls && post.media_urls.length > 0 && (
              <div className="mb-6 border-t pt-4">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Media</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {post.media_urls.map((mediaUrl: string, index: number) => {
                    const isVideo = mediaUrl.includes('v.redd.it');
                    const mediaKey = `${post.id}-${index}`;
                    
                    return (
                      <div key={mediaKey} className="rounded-lg overflow-hidden bg-gray-100">
                        {isVideo ? (
                          <video 
                            controls 
                            className="w-full h-48 object-cover"
                            poster={`${mediaUrl}/DASH_720.mp4`}
                          >
                            <source src={`${mediaUrl}/DASH_720.mp4`} type="video/mp4" />
                            <source src={`${mediaUrl}/DASH_480.mp4`} type="video/mp4" />
                            Your browser does not support the video tag.
                          </video>
                        ) : (
                          <img 
                            src={mediaUrl} 
                            alt={`Media ${index + 1}`}
                            className="w-full h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(mediaUrl, '_blank')}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        )}
                        <div className="p-2 text-xs text-gray-600">
                          <span className="font-medium">
                            {isVideo ? 'Video' : 'Image'} {index + 1}
                          </span>
                          <span className="mx-2">•</span>
                          <span>From Reddit</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            <div className="border-b pb-4 mb-6"></div>
            
            {/* Reddit Account Details */}
            <div className="space-y-4">
              {post.platforms?.map((platform: any) => {
                // Debug log for each platform
                console.log('Platform details:', {
                  id: platform.id,
                  subreddit: platform.subreddit,
                  account: platform.account
                });

                return (
                  <div 
                    key={platform.id} 
                    className="bg-gray-50 rounded-lg p-4 border"
                  >
                    {/* Account Details Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className="bg-[#FF4500] text-white p-1 rounded">
                          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 0C4.478 0 0 4.478 0 10c0 5.523 4.478 10 10 10 5.523 0 10-4.477 10-10 0-5.522-4.477-10-10-10z"/>
                          </svg>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {platform.account?.account_id || 'Unknown Account'}
                          </div>
                          <div className="text-sm text-gray-600">
                            u/{platform.account?.account_name || 'unknown'}
                          </div>
                        </div>
                      </div>
                      {platform.subreddit && (
                        <div className="text-right">
                          <div className="text-blue-600 font-medium">
                            r/{platform.subreddit}
                          </div>
                          <div className="text-sm text-gray-500">
                            {platform.published_at && `Posted ${formatDate(platform.published_at)}`}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Status and Actions */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center space-x-3">
                        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                          platform.status === 'success' 
                            ? 'bg-green-100 text-green-800'
                            : platform.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {platform.status === 'success' ? 'Posted Successfully' : 
                           platform.status === 'failed' ? 'Failed to Post' : 
                           'Pending'}
                        </div>
                      </div>

                      {/* View on Reddit Button */}
                      {platform.status === 'success' && platform.platform_post_id && (
                        <a
                          href={`https://reddit.com/${platform.platform_post_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-[#FF4500] hover:bg-[#FF5700] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FF4500]"
                        >
                          View on Reddit
                        </a>
                      )}
                    </div>

                    {/* Error Message */}
                    {platform.status === 'failed' && platform.error_message && (
                      <div className="mt-3 text-sm text-red-600 bg-red-50 p-3 rounded">
                        Error: {platform.error_message}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default PostHistory;
