'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@supabase/auth-helpers-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'react-hot-toast';
import { createClient } from '@supabase/supabase-js';
import { SocialMediaService } from '@/lib/social-media-service';
import type { PostHistory as PostHistoryType } from '@/lib/social-media-service';

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function PostHistory() {
  const user = useUser();
  const [posts, setPosts] = useState<PostHistoryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedSubreddit, setSelectedSubreddit] = useState('');
  const [selectedFlair, setSelectedFlair] = useState<{ id: string; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  const socialMediaService = new SocialMediaService();

  useEffect(() => {
    if (user) {
      loadPosts();
    }
  }, [user]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      setSelectedImage(imageFile);
      const previewUrl = URL.createObjectURL(imageFile);
      setImagePreview(previewUrl);
    }
  }, []);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview('');
  };

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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title || !content || !selectedSubreddit) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      let imageUrl;
      if (selectedImage) {
        // Upload to Supabase Storage
        const fileExt = selectedImage.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('media')
          .upload(fileName, selectedImage);

        if (uploadError) throw uploadError;

        // Get the public URL
        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(fileName);

        imageUrl = publicUrl;
      }

      const result = await socialMediaService.createPost(
        [user!.id],
        content,
        title,
        selectedSubreddit,
        selectedFlair?.id,
        imageUrl
      );

      if (result[0].success) {
        toast.success('Post created successfully!');
        setContent('');
        setTitle('');
        setSelectedSubreddit('');
        setSelectedFlair(null);
        setSelectedImage(null);
        setImagePreview('');
        loadPosts();
      } else if (result[0].requiresFlair) {
        setSelectedFlair(null);
        toast.error(result[0].error || 'A flair is required for this subreddit');
      } else {
        toast.error(result[0].error || 'Failed to create post');
      }
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error('Failed to create post');
    } finally {
      setIsSubmitting(false);
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
        <p className="mt-1 text-sm text-gray-500">Get started by creating your first post!</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <form onSubmit={handleSubmit} className="mb-8 space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
            Title
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>

        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-700">
            Content
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>

        <div>
          <label htmlFor="subreddit" className="block text-sm font-medium text-gray-700">
            Subreddit
          </label>
          <input
            type="text"
            id="subreddit"
            value={selectedSubreddit}
            onChange={(e) => setSelectedSubreddit(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Image (optional)
          </label>
          <div
            className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-300 hover:border-indigo-500'
            }`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="space-y-1 text-center">
              {!imagePreview ? (
                <>
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                    aria-hidden="true"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div className="flex text-sm text-gray-600">
                    <label
                      htmlFor="image-upload"
                      className="relative cursor-pointer rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                    >
                      <span>Upload a file</span>
                      <input
                        id="image-upload"
                        name="image-upload"
                        type="file"
                        className="sr-only"
                        accept="image/*"
                        onChange={handleImageChange}
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                </>
              ) : (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-48 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute -top-2 -right-2 rounded-full bg-red-500 text-white p-1 hover:bg-red-600"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={isSubmitting}
            className={`inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
              isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isSubmitting ? 'Creating Post...' : 'Create Post'}
          </button>
        </div>
      </form>

      <div className="space-y-6">
        {posts.map((post) => (
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
                {post.errorMessage && (
                  <span className="text-xs text-red-600">{post.errorMessage}</span>
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-between items-center text-sm text-gray-500">
              <div>
                Posted {formatDistanceToNow(new Date(post.createdAt))} ago
              </div>
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
        ))}
      </div>
    </div>
  );
}
