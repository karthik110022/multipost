'use client';

import { User } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';
import { SocialMediaService, SocialAccount } from '@/lib/social-media-service';

interface SettingsClientProps {
  user: User;
}

export default function SettingsClient({ user }: SettingsClientProps) {
  const [connectedAccounts, setConnectedAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConnectedAccounts();
  }, []);

  const loadConnectedAccounts = async () => {
    try {
      const service = new SocialMediaService();
      const accounts = await service.getConnectedAccounts();
      setConnectedAccounts(accounts);
    } catch (error) {
      console.error('Error loading connected accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectAccount = async (accountId: string) => {
    try {
      setLoading(true);
      const service = new SocialMediaService();
      await service.disconnectAccount(accountId);
      await loadConnectedAccounts();
    } catch (error) {
      console.error('Error disconnecting account:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      {/* Profile Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Profile Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account Created</label>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {new Date(user.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Connected Accounts Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Connected Social Media Accounts</h2>
        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          </div>
        ) : connectedAccounts.length > 0 ? (
          <div className="space-y-4">
            {connectedAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div>
                  <p className="font-medium">{account.platform}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {account.accountName}
                  </p>
                </div>
                <button
                  onClick={() => handleDisconnectAccount(account.id)}
                  className="px-4 py-2 text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                >
                  Disconnect
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 dark:text-gray-400">
            No social media accounts connected. Connect accounts from the dashboard to start posting.
          </p>
        )}
      </div>
    </div>
  );
}
