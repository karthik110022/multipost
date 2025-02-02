'use client';

import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { toast } from 'react-hot-toast';
import { socialMediaService } from '@/lib/social-media-service';
import type { SocialAccount } from '@/lib/social-media-service';

interface PostFormData {
  content: string;
  title: string;
  selectedAccounts: string[];
  subreddit: string;
}

interface Props {
  user: User | null;
}

export default function PostForm({ user }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState<PostFormData>({
    content: '',
    title: '',
    selectedAccounts: [],
    subreddit: ''
  });
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [subreddits, setSubreddits] = useState<Array<{ name: string; displayName: string }>>([]);
  const [loadingSubreddits, setLoadingSubreddits] = useState(false);
  const [flairs, setFlairs] = useState<Array<{ id: string; text: string }>>([]);
  const [selectedFlair, setSelectedFlair] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingFlairs, setLoadingFlairs] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    const redditAccount = accounts.find(
      account => account.platform === 'reddit' && formData.selectedAccounts.includes(account.id)
    );

    if (redditAccount) {
      loadSubreddits(redditAccount.id);
    }
  }, [formData.selectedAccounts, accounts]);

  useEffect(() => {
    const loadFlairs = async () => {
      if (!formData.subreddit || !formData.selectedAccounts.some(id => 
        accounts.find(acc => acc.id === id && acc.platform === 'reddit')
      )) {
        setFlairs([]);
        return;
      }

      setLoadingFlairs(true);
      try {
        const redditAccount = accounts.find(a => a.platform === 'reddit' && formData.selectedAccounts.includes(a.id));
        if (!redditAccount) return;

        const flairOptions = await socialMediaService.getSubredditFlairs(
          redditAccount.id,
          formData.subreddit
        );
        setFlairs(flairOptions);
        
        // Auto-select first flair if only one option
        if (flairOptions.length === 1) {
          setSelectedFlair(flairOptions[0].id);
        }
      } catch (error) {
        console.error('Error loading flairs:', error);
      } finally {
        setLoadingFlairs(false);
      }
    };

    loadFlairs();
  }, [formData.subreddit, accounts, formData.selectedAccounts]);

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

  const loadSubreddits = async (accountId: string) => {
    setLoadingSubreddits(true);
    try {
      const fetchedSubreddits = await socialMediaService.getSubreddits(accountId);
      setSubreddits(fetchedSubreddits);
    } catch (error) {
      console.error('Error loading subreddits:', error);
      setError('Failed to load subreddits');
    } finally {
      setLoadingSubreddits(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/social/create-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountIds: formData.selectedAccounts,
          content: formData.content,
          title: formData.title,
          subreddit: formData.subreddit,
          flairId: selectedFlair || undefined
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create post');
      }

      // Reset form
      setFormData({
        content: '',
        title: '',
        subreddit: '',
        selectedAccounts: []
      });
      setSelectedFlair('');
      toast.success('Post created successfully!');
    } catch (error: any) {
      console.error('Error creating post:', error);
      setError(error.message || 'Failed to create post');
      toast.error(error.message || 'Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Subreddit
            </label>
            <select
              value={formData.subreddit}
              onChange={e => setFormData(prev => ({ ...prev, subreddit: e.target.value }))}
              className="w-full p-2 border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
              required
            >
              <option value="">Select a subreddit</option>
              {loadingSubreddits ? (
                <option value="" disabled>Loading subreddits...</option>
              ) : (
                subreddits.map(subreddit => (
                  <option key={subreddit.name} value={subreddit.name}>
                    {subreddit.displayName || subreddit.name}
                  </option>
                ))
              )}
            </select>
            {loadingSubreddits && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Loading your subreddits...</p>
            )}
            {!loadingSubreddits && subreddits.length === 0 && (
              <p className="mt-1 text-sm text-red-500 dark:text-red-400">
                No subreddits found. Please make sure you're subscribed to some subreddits.
              </p>
            )}
          </div>

          {formData.subreddit && flairs.length > 0 && (
            <div>
              <label htmlFor="flair" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Post Flair <span className="text-red-500">*</span>
              </label>
              <select
                id="flair"
                value={selectedFlair}
                onChange={(e) => setSelectedFlair(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="">Select a flair</option>
                {flairs.map((flair) => (
                  <option key={flair.id} value={flair.id}>
                    {flair.text}
                  </option>
                ))}
              </select>
            </div>
          )}

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

      {error && (
        <div className="text-red-500 dark:text-red-400 mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="text-green-500 dark:text-green-400 mb-4">
          Post created successfully!
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
        {isSubmitting ? 'Creating Post...' : 'Create Post'}
      </button>
    </form>
  );
}
