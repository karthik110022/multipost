'use client';

import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname === path;
  };

  const linkClass = (path: string) =>
    `px-3 py-2 rounded-md text-sm font-medium ${
      isActive(path)
        ? 'bg-[#FF4500] text-white'
        : 'text-gray-700 hover:bg-[#FF4500] hover:text-white'
    }`;

  if (!user) return null;

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/dashboard" className="text-2xl font-bold text-[#FF4500] mr-8">
              MultiPost
            </Link>
            <div className="flex space-x-4">
              <Link href="/dashboard" className={linkClass('/dashboard')}>
                Dashboard
              </Link>
              <Link href="/create-post" className={linkClass('/create-post')}>
                Create Post
              </Link>
              <Link href="/history" className={linkClass('/history')}>
                Post History
              </Link>
              <Link href="/scheduled" className={linkClass('/scheduled')}>
                Scheduled Posts
              </Link>
              <Link href="/accounts" className={linkClass('/accounts')}>
                Connected Accounts
              </Link>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={signOut}
              className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
