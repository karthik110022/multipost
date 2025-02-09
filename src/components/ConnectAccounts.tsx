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
    setError(null);
    // Store current timestamp to detect if we're returning from Reddit
    localStorage.setItem('lastRedditConnect', Date.now().toString());
    const authUrl = socialMediaService.getRedditAuthUrl();
    // Open Reddit auth in a new window
    window.open(authUrl, '_blank', 'width=600,height=800');
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

  const handleSetActiveAccount = async (accountId: string) => {
    try {
      setError(null);
      await socialMediaService.setActiveAccount(accountId);
      await loadAccounts(); // Reload to update UI
      toast.success('Active account updated successfully');
    } catch (error) {
      console.error('Error setting active account:', error);
      setError('Failed to set active account');
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
              Reddit Accounts ({accounts.filter(a => a.platform === 'reddit').length})
            </h2>
            <button
              onClick={handleRedditConnect}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
            >
              Connect New Account
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Connected Accounts</h2>
              <button
                onClick={handleRedditConnect}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
              >
                Connect New Account
              </button>
            </div>
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-md">
                {error}
              </div>
            )}
            <div className="bg-yellow-50 text-yellow-800 p-4 rounded-md mb-4">
              <p className="font-medium">To connect a different Reddit account:</p>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Log out of your current Reddit account in a new tab</li>
                <li>Click "Connect New Account" above</li>
                <li>Log in with the different Reddit account you want to connect</li>
              </ol>
            </div>

            {accounts.filter(account => account.platform === 'reddit').length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No Reddit accounts connected. Click the button above to connect one.
              </div>
            ) : (
              <div className="space-y-4">
                {accounts
                  .filter(account => account.platform === 'reddit')
                  .map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-[#FF4500] rounded-full flex items-center justify-center">
                            <span className="text-white font-bold">
                              {account.accountName?.[0]?.toUpperCase() || 'R'}
                            </span>
                          </div>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {account.accountName}
                            {account.isActive && (
                              <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            Connected {new Date(account.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleSetActiveAccount(account.id)}
                          className={`text-sm ${
                            account.isActive
                              ? 'text-green-600 cursor-default'
                              : 'text-blue-600 hover:text-blue-800'
                          }`}
                          disabled={account.isActive}
                        >
                          {account.isActive ? 'Active Account' : 'Set as Active'}
                        </button>
                        <div className="w-px h-4 bg-gray-300"></div>
                        <button
                          onClick={() => handleDisconnect(account.id)}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <RedditConnectModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
}
