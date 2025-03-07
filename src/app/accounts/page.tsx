'use client';

import { useAuth } from '@/context/AuthContext';
import ConnectAccounts from '@/components/ConnectAccounts';

export default function AccountsPage() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">Connected Accounts</h1>
      <ConnectAccounts />
    </div>
  );
}
