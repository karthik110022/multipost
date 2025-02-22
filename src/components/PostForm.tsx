'use client';

import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { toast } from 'react-hot-toast';
import { socialMediaService } from '@/lib/social-media-service';
import type { SocialAccount } from '@/lib/social-media-service';
import SubredditAnalytics from './SubredditAnalytics';

interface PostFormData {
  content: string;
  title: string;
  selectedAccounts: string[];
  subreddits: Array<{
    accountId: string;
    subreddit: string;
    flairId?: string;
  }>;
}

interface Props {
  user: User | null;
}

interface PostResult {
  success: boolean;
  platformPostId?: string;
  error?: string;
  accountId?: string;
  subreddit?: string;
}

export default function PostForm({ user }: Props) {
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

  const handleSubredditChange = (accountId: string, subreddit: string) => {
    setFormData(prev => {
      const existingIndex = prev.subreddits.findIndex(s => s.accountId === accountId);
      const newSubreddits = [...prev.subreddits];
      
      if (existingIndex >= 0) {
        newSubreddits[existingIndex] = { accountId, subreddit };
      } else {
        newSubreddits.push({ accountId, subreddit });
      }

      return {
        ...prev,
        subreddits: newSubreddits
      };
    });

    // Load flairs for the selected subreddit
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
      const response = await fetch('/api/social/create-post', {
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
          }))
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
        setFormData({
          content: '',
          title: '',
          selectedAccounts: [],
          subreddits: []
        });
        toast.success('All posts created successfully!');
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

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Create Post</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                      className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                    />
                    <span className="dark:text-gray-300">{account.accountName} ({account.platform})</span>
                  </label>
                ))}
              </div>
            </div>

            {formData.selectedAccounts.some(id => 
              accounts.find(acc => acc.id === id && acc.platform === 'reddit')
            ) && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Title (Required for Reddit)
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full p-2 border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
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
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Subreddit
                        </label>
                        <select
                          value={selectedSubreddit?.subreddit || ''}
                          onChange={e => handleSubredditChange(accountId, e.target.value)}
                          className="w-full p-2 border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
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
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Post Flair
                          </label>
                          <select
                            value={selectedSubreddit.flairId || ''}
                            onChange={e => handleFlairChange(accountId, e.target.value)}
                            className="w-full p-2 border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Content
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    className="w-full p-2 border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
                    rows={4}
                    required
                  />
                </div>
              </>
            )}

            {showResults && postResults.length > 0 && (
              <div className="mt-6 space-y-4">
                <h3 className="text-lg font-medium">Post Results:</h3>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
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
                          <span className="text-gray-700 dark:text-gray-300">
                            r/{result.subreddit}
                          </span>
                        </div>
                        {result.success ? (
                          <p className="mt-1 text-sm text-green-600 dark:text-green-400">
                            Post created successfully
                          </p>
                        ) : (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
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
              <div className="text-red-500 dark:text-red-400 mb-4">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-2 px-4 rounded ${
                isSubmitting
                  ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700'
              } text-white`}
            >
              {isSubmitting ? 'Creating Posts...' : 'Create Posts'}
            </button>
          </form>
        </div>

        <div className="space-y-6">
          {formData.subreddits.map((subredditData) => (
            <SubredditAnalytics
              key={`${subredditData.accountId}-${subredditData.subreddit}`}
              subreddit={subredditData.subreddit}
              accountId={subredditData.accountId}
            />
          ))}
        </div>
      </div>

    </div>
  );
}
