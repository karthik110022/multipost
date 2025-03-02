'use client';

import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { toast } from 'react-hot-toast';
import { socialMediaService } from '@/lib/social-media-service';
import type { SocialAccount } from '@/lib/social-media-service';
import { useAnalytics } from './AnalyticsProvider';

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
    subreddits: []
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
      const endpoint = isScheduled ? '/api/social/schedule-post' : '/api/social/create-post';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: formData.content,
          title: formData.title,
          posts: formData.subreddits.map(sub => ({
            accountId: sub.accountId,
            subreddit: sub.subreddit,
            flairId: sub.flairId
          })),
          scheduledFor: formData.scheduledFor
        }),
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
      scheduledFor: undefined
    });
    setSelectedSubreddit(null);
    setSelectedAccountId(null);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
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
                  className="rounded border-gray-300"
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
                className="w-full p-2 border rounded bg-white text-gray-900 border-gray-300"
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
                      className="w-full p-2 border rounded bg-white text-gray-900 border-gray-300"
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
                        className="w-full p-2 border rounded bg-white text-gray-900 border-gray-300"
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
              <textarea
                value={formData.content}
                onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
                className="w-full p-2 border rounded bg-white text-gray-900 border-gray-300"
                rows={4}
                required
              />
            </div>
          </>
        )}

        {showResults && postResults.length > 0 && (
          <div className="mt-6 space-y-4">
            <h3 className="text-lg font-medium">Post Results:</h3>
            <div className="divide-y divide-gray-200">
              {postResults.map((result, index) => {
                const account = accounts.find(acc => acc.id === result.accountId);
                return (
                  <div key={index} className="py-4">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${result.success ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="font-medium">
                        {account?.accountName} ({account?.platform})
                      </span>
                      <span className="text-gray-500">→</span>
                      <span className="text-gray-700">
                        r/{result.subreddit}
                      </span>
                    </div>
                    {result.success ? (
                      <p className="mt-1 text-sm text-green-600">
                        Post created successfully
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-red-600">
                        {result.error === 'INSUFFICIENT_KARMA' 
                          ? `Not enough karma to post in r/${result.subreddit}`
                          : result.error || 'Failed to create post'}
                      </p>
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
          className={`w-full py-2 px-4 rounded ${
            isSubmitting
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600'
          } text-white`}
        >
          {isSubmitting ? 'Creating Posts...' : isScheduled ? 'Schedule Posts' : 'Create Posts'}
        </button>
      </form>
    </div>
  );
}
