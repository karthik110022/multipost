'use client';

import { useAuth } from '@/context/AuthContext';
import ConnectAccounts from '@/components/ConnectAccounts';
import Sidebar from '@/components/Sidebar';

export default function AccountsPage() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <ConnectAccounts />
      </main>
    </div>
  );
}
