'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useAuth } from '@/context/AuthContext';
import { socialMediaService } from '@/lib/social-media-service';
import type { SocialAccount } from '@/lib/social-media-service';
import RedditConnectModal from './RedditConnectModal';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import toast from 'react-hot-toast'; // Assuming you have react-hot-toast installed

export default function ConnectAccounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    if (user) {
      loadAccounts();
    }
  }, [user]);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const accounts = await socialMediaService.getConnectedAccounts();
      setAccounts(accounts);
    } catch (error) {
      console.error('Error loading accounts:', error);
      setError('Failed to load connected accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleRedditConnect = () => {
    try {
      const authUrl = socialMediaService.getRedditAuthUrl();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Error connecting to Reddit:', error);
      toast.error('Reddit configuration is missing. Please contact support.');
    }
  };

  const handleDisconnect = async (accountId: string) => {
    try {
      setError(null);
      await socialMediaService.disconnectAccount(accountId);
      await loadAccounts();
    } catch (error) {
      console.error('Error disconnecting account:', error);
      setError('Failed to disconnect account');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#FF4500]"></div>
      </div>
    );
  }

  const success = searchParams.get('success') === 'connected';

  return (
    <div className="max-w-4xl mx-auto">
      {error && (
        <div className="mb-4 p-4 text-red-700 bg-red-100 rounded-md">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-md">
          Successfully connected your Reddit account!
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Reddit Accounts ({accounts.length})
            </h2>
            <button
              onClick={handleRedditConnect}
              className="px-4 py-2 bg-[#FF4500] text-white rounded-md hover:bg-[#FF5722] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FF4500]"
            >
              Connect New Account
            </button>
          </div>

          {accounts.length === 0 ? (
            <div className="text-center py-6">
              <div className="mb-4">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
              <p className="text-gray-500">No Reddit accounts connected yet.</p>
              <p className="text-sm text-gray-400 mt-1">
                Click the button above to connect your first account.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-[#FF4500]" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 0C4.478 0 0 4.478 0 10c0 5.523 4.478 10 10 10 5.523 0 10-4.477 10-10 0-5.522-4.477-10-10-10z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">u/{account.accountName}</p>
                      <p className="text-sm text-gray-500">Reddit Account</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDisconnect(account.id)}
                    className="px-3 py-1 text-sm text-red-600 hover:text-red-800 focus:outline-none"
                  >
                    Disconnect
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <RedditConnectModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
}
