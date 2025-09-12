'use client';

import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { toast } from 'react-hot-toast';
import { socialMediaService } from '@/lib/social-media-service';
import type { SocialAccount } from '@/lib/social-media-service';
import { useAnalytics } from './AnalyticsProvider';
import { LoadingButton } from './ui/PageTransition';
import RichTextEditorWrapper from './RichTextEditorWrapper';
import { htmlToMarkdown } from '@/lib/markdown-utils';

interface PostFormData {
  content: string;
  title: string;
  selectedAccounts: string[];
  subreddits: Array<{
    accountId: string;
    subreddit: string;
    flairId?: string;
  }>;
  scheduledFor?: string;
  images?: File[];
  videos?: File[];
}

interface Props {
  user: User | null;
  isScheduled?: boolean;
  onPostCreated?: () => void;
}

interface PostResult {
  success: boolean;
  platformPostId?: string;
  error?: string;
  accountId?: string;
  subreddit?: string;
}

export default function PostForm({ user, isScheduled = false, onPostCreated }: Props) {
  const { setSelectedSubreddit, setSelectedAccountId } = useAnalytics();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState<PostFormData>({
    content: '',
    title: '',
    selectedAccounts: [],
    subreddits: [],
    images: [],
    videos: []
  });
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [subredditsByAccount, setSubredditsByAccount] = useState<Record<string, Array<{ name: string; displayName: string }>>>({});
  const [flairsBySubreddit, setFlairsBySubreddit] = useState<Record<string, Array<{ id: string; text: string }>>>({});
  const [loadingSubreddits, setLoadingSubreddits] = useState<Record<string, boolean>>({});
  const [loadingFlairs, setLoadingFlairs] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [postResults, setPostResults] = useState<PostResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    const loadSubredditsForAccount = async (accountId: string) => {
      setLoadingSubreddits(prev => ({ ...prev, [accountId]: true }));
      try {
        const fetchedSubreddits = await socialMediaService.getSubreddits(accountId);
        setSubredditsByAccount(prev => ({
          ...prev,
          [accountId]: fetchedSubreddits
        }));
      } catch (error) {
        console.error('Error loading subreddits:', error);
        setError('Failed to load subreddits');
      } finally {
        setLoadingSubreddits(prev => ({ ...prev, [accountId]: false }));
      }
    };

    // Load subreddits for each selected Reddit account
    formData.selectedAccounts.forEach(accountId => {
      const account = accounts.find(acc => acc.id === accountId);
      if (account?.platform === 'reddit') {
        loadSubredditsForAccount(accountId);
      }
    });

    // Remove subreddit selections for unselected accounts
    setFormData(prev => ({
      ...prev,
      subreddits: prev.subreddits.filter(sub => 
        formData.selectedAccounts.includes(sub.accountId)
      )
    }));
  }, [formData.selectedAccounts, accounts]);

  const loadFlairsForSubreddit = async (accountId: string, subreddit: string) => {
    setLoadingFlairs(prev => ({ ...prev, [`${accountId}-${subreddit}`]: true }));
    try {
      const redditAccount = accounts.find(a => a.id === accountId && a.platform === 'reddit');
      if (!redditAccount) return;

      const flairOptions = await socialMediaService.getSubredditFlairs(
        accountId,
        subreddit
      );
      setFlairsBySubreddit(prev => ({
        ...prev,
        [`${accountId}-${subreddit}`]: flairOptions
      }));
    } catch (error) {
      console.error('Error loading flairs:', error);
    } finally {
      setLoadingFlairs(prev => ({ ...prev, [`${accountId}-${subreddit}`]: false }));
    }
  };

  const handleSubredditChange = async (accountId: string, subreddit: string) => {
    setFormData(prev => ({
      ...prev,
      subreddits: [
        ...prev.subreddits.filter(s => s.accountId !== accountId),
        { accountId, subreddit }
      ]
    }));

    // Update analytics
    setSelectedSubreddit(subreddit);
    setSelectedAccountId(accountId);

    // Load flairs
    loadFlairsForSubreddit(accountId, subreddit);
  };

  const handleFlairChange = (accountId: string, flairId: string) => {
    setFormData(prev => ({
      ...prev,
      subreddits: prev.subreddits.map(sub =>
        sub.accountId === accountId
          ? { ...sub, flairId }
          : sub
      )
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setShowResults(false);
    setPostResults([]);

    try {
      // Convert HTML content to markdown for Reddit
      const markdownContent = htmlToMarkdown(formData.content);
      
      const endpoint = isScheduled ? '/api/social/schedule-post' : '/api/social/create-post';
      
      // Use FormData if we have media files, otherwise use JSON
      let body: string | FormData;
      let headers: Record<string, string> = {};
      
      const hasMedia = (formData.images && formData.images.length > 0) || 
                       (formData.videos && formData.videos.length > 0);
      
      if (hasMedia) {
        // Use FormData for media uploads
        const formDataBody = new FormData();
        formDataBody.append('content', markdownContent);
        formDataBody.append('title', formData.title);
        formDataBody.append('posts', JSON.stringify(formData.subreddits.map(sub => ({
          accountId: sub.accountId,
          subreddit: sub.subreddit,
          flairId: sub.flairId
        }))));
        if (formData.scheduledFor) {
          formDataBody.append('scheduledFor', formData.scheduledFor);
        }
        
        // Combine images and videos into media files
        const allMedia = [...(formData.images || []), ...(formData.videos || [])];
        
        // Append each media file
        allMedia.forEach((file, index) => {
          formDataBody.append(`media_${index}`, file);
        });
        formDataBody.append('mediaCount', allMedia.length.toString());
        
        body = formDataBody;
        // Don't set Content-Type header - let browser set it with boundary for FormData
      } else {
        // Use JSON for text-only posts
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({
          content: markdownContent,
          title: formData.title,
          posts: formData.subreddits.map(sub => ({
            accountId: sub.accountId,
            subreddit: sub.subreddit,
            flairId: sub.flairId
          })),
          scheduledFor: formData.scheduledFor
        });
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body,
      });

      const results = await response.json();

      if (!response.ok) {
        throw new Error(results.error || 'Failed to create posts');
      }

      // Map results to include account and subreddit info
      const enhancedResults = results.map((result: PostResult, index: number) => ({
        ...result,
        accountId: formData.subreddits[index].accountId,
        subreddit: formData.subreddits[index].subreddit
      }));

      setPostResults(enhancedResults);
      setShowResults(true);

      // Only reset form if all posts were successful
      if (enhancedResults.every((r: PostResult) => r.success)) {
        resetForm();
        toast.success(isScheduled ? 'Posts scheduled successfully!' : 'All posts created successfully!');
        onPostCreated?.();
      } else {
        // If some posts failed, show a warning
        toast.error('Some posts failed. Check the results below.');
      }
    } catch (error: any) {
      console.error('Error creating posts:', error);
      setError(error.message || 'Failed to create posts');
      toast.error(error.message || 'Failed to create posts');
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const fetchedAccounts = await socialMediaService.getConnectedAccounts();
      console.log('Loaded accounts:', fetchedAccounts);
      setAccounts(fetchedAccounts);
    } catch (error) {
      console.error('Error loading accounts:', error);
      toast.error('Failed to load connected accounts');
    }
  };

  const handleAccountSelection = (accountId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedAccounts: prev.selectedAccounts.includes(accountId)
        ? prev.selectedAccounts.filter(id => id !== accountId)
        : [...prev.selectedAccounts, accountId]
    }));
  };

  const resetForm = () => {
    setFormData({
      content: '',
      title: '',
      selectedAccounts: [],
      subreddits: [],
      scheduledFor: undefined,
      images: [],
      videos: []
    });
    setSelectedSubreddit(null);
    setSelectedAccountId(null);
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <form onSubmit={handleSubmit} className="space-y-6 animate-slide-up">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Accounts
          </label>
          <div className="space-y-2">
            {accounts.map(account => (
              <label key={account.id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.selectedAccounts.includes(account.id)}
                  onChange={(e) => {
                    setFormData(prev => ({
                      ...prev,
                      selectedAccounts: e.target.checked
                        ? [...prev.selectedAccounts, account.id]
                        : prev.selectedAccounts.filter(id => id !== account.id)
                    }));
                  }}
                  className="rounded border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                />
                <span>{account.accountName} ({account.platform})</span>
              </label>
            ))}
          </div>
        </div>

        {isScheduled && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Schedule For
            </label>
            <input
              type="datetime-local"
              value={formData.scheduledFor ? new Date(formData.scheduledFor).toLocaleString('sv-SE').slice(0, 16) : ''}
              onChange={e => {
                // Create date in local timezone
                const date = new Date(e.target.value);
                setFormData(prev => ({ ...prev, scheduledFor: date.toISOString() }));
              }}
              className="w-full p-2 border rounded bg-white text-gray-900 border-gray-300"
              required
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>
        )}

        {formData.selectedAccounts.some(id => 
          accounts.find(acc => acc.id === id && acc.platform === 'reddit')
        ) && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title (Required for Reddit)
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full p-3 border rounded-lg bg-white text-gray-900 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-400"
                required
              />
            </div>

            {formData.selectedAccounts.map(accountId => {
              const account = accounts.find(acc => acc.id === accountId);
              if (account?.platform !== 'reddit') return null;

              const subreddits = subredditsByAccount[accountId] || [];
              const selectedSubreddit = formData.subreddits.find(s => s.accountId === accountId);

              return (
                <div key={accountId} className="mb-6 p-4 border rounded">
                  <h3 className="font-medium mb-3">{account.accountName}</h3>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subreddit
                    </label>
                    <select
                      value={selectedSubreddit?.subreddit || ''}
                      onChange={e => handleSubredditChange(accountId, e.target.value)}
                      className="w-full p-3 border rounded-lg bg-white text-gray-900 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-400"
                      required
                    >
                      <option value="">Select a subreddit</option>
                      {loadingSubreddits[accountId] ? (
                        <option value="" disabled>Loading subreddits...</option>
                      ) : (
                        subreddits.map(subreddit => (
                          <option key={subreddit.name} value={subreddit.name}>
                            {subreddit.displayName || subreddit.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {selectedSubreddit?.subreddit && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Post Flair
                      </label>
                      <select
                        value={selectedSubreddit.flairId || ''}
                        onChange={e => handleFlairChange(accountId, e.target.value)}
                        className="w-full p-3 border rounded-lg bg-white text-gray-900 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-400"
                      >
                        <option value="">No flair</option>
                        {loadingFlairs[`${accountId}-${selectedSubreddit.subreddit}`] ? (
                          <option value="" disabled>Loading flairs...</option>
                        ) : (
                          (flairsBySubreddit[`${accountId}-${selectedSubreddit.subreddit}`] || []).map(flair => (
                            <option key={flair.id} value={flair.id}>
                              {flair.text}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content
              </label>
              <RichTextEditorWrapper
                content={formData.content}
                onChange={(content) => setFormData(prev => ({ ...prev, content }))}
                onImagesChange={(images) => setFormData(prev => ({ ...prev, images }))}
                onVideosChange={(videos) => setFormData(prev => ({ ...prev, videos }))}
                placeholder="Write your post content here..."
              />
            </div>
          </>
        )}

        {showResults && postResults.length > 0 && (
          <div className="mt-6 space-y-4 animate-slide-up">
            <h3 className="text-lg font-medium text-gray-900">Post Results:</h3>
            <div className="divide-y divide-gray-200 bg-gray-50 rounded-lg p-4">
              {postResults.map((result, index) => {
                const account = accounts.find(acc => acc.id === result.accountId);
                return (
                  <div key={index} className={`py-4 first:pt-0 last:pb-0 animate-slide-up-delay-${Math.min(index + 1, 4)}`}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${result.success ? 'bg-green-500 animate-pulse' : 'bg-red-500'} shadow-sm`} />
                      <span className="font-medium text-gray-900">
                        {account?.accountName}
                      </span>
                      <span className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded-full">
                        {account?.platform}
                      </span>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="text-gray-700 font-mono text-sm">
                        r/{result.subreddit}
                      </span>
                    </div>
                    {result.success ? (
                      <div className="mt-2 flex items-center space-x-2">
                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <p className="text-sm text-green-600 font-medium">
                          Post created successfully
                        </p>
                      </div>
                    ) : (
                      <div className="mt-2 flex items-start space-x-2">
                        <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <p className="text-sm text-red-600">
                          {result.error === 'INSUFFICIENT_KARMA' 
                            ? `Not enough karma to post in r/${result.subreddit}`
                            : result.error || 'Failed to create post'}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <div className="text-red-500 mb-4">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-3 px-6 rounded-lg font-medium transition-all duration-300 transform btn-ripple ${
            isSubmitting
              ? 'bg-gray-400 cursor-not-allowed opacity-70'
              : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]'
          } text-white`}
        >
          {isSubmitting ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
              <span>Creating Posts...</span>
            </div>
          ) : (
            <span className="flex items-center justify-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <span>{isScheduled ? 'Schedule Posts' : 'Create Posts'}</span>
            </span>
          )}
        </button>
      </form>
    </div>
  );
}
