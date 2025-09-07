'use client';

import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DashboardSkeleton } from '../ui/LoadingSkeleton';
import AnalyticsCard from './AnalyticsCard';

export default function DashboardClient() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin');
    }
    if (!loading && user) {
      // Delay showing content for smooth animation
      setTimeout(() => setShowContent(true), 100);
    }
  }, [user, loading, router]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className={`container mx-auto px-4 py-8 transition-all duration-700 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      <h1 className="text-3xl font-bold mb-8 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent animate-slide-up">Welcome to MultiPost</h1>
      
      {/* Analytics Card */}
      <div className="mb-8">
        <AnalyticsCard />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link 
          href="/create-post"
          className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] hover:-translate-y-1 animate-slide-up-delay-2 group btn-ripple"
        >
          <div className="flex items-start space-x-4">
            <div className="p-2 bg-[#FF4500] bg-opacity-20 rounded-lg group-hover:bg-opacity-30 transition-all duration-300">
              <svg className="w-6 h-6 text-[#FF4500] group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 group-hover:text-[#FF4500] transition-colors duration-300">Create Post</h2>
              <p className="mt-1 text-gray-600 group-hover:text-gray-700 transition-colors duration-300">Create and share content on Reddit</p>
            </div>
          </div>
        </Link>

        <Link 
          href="/accounts"
          className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] hover:-translate-y-1 animate-slide-up-delay-2 group btn-ripple"
        >
          <div className="flex items-start space-x-4">
            <div className="p-2 bg-[#FF4500] bg-opacity-20 rounded-lg group-hover:bg-opacity-30 transition-all duration-300">
              <svg className="w-6 h-6 text-[#FF4500] group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 group-hover:text-[#FF4500] transition-colors duration-300">Manage Accounts</h2>
              <p className="mt-1 text-gray-600 group-hover:text-gray-700 transition-colors duration-300">Connect and manage your Reddit account</p>
            </div>
          </div>
        </Link>

        <Link 
          href="/history"
          className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] hover:-translate-y-1 animate-slide-up-delay-3 group btn-ripple"
        >
          <div className="flex items-start space-x-4">
            <div className="p-2 bg-[#FF4500] bg-opacity-20 rounded-lg group-hover:bg-opacity-30 transition-all duration-300">
              <svg className="w-6 h-6 text-[#FF4500] group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 group-hover:text-[#FF4500] transition-colors duration-300">Post History</h2>
              <p className="mt-1 text-gray-600 group-hover:text-gray-700 transition-colors duration-300">View and manage your posts</p>
            </div>
          </div>
        </Link>

        <Link 
          href="/settings"
          className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] hover:-translate-y-1 animate-slide-up-delay-4 group btn-ripple"
        >
          <div className="flex items-start space-x-4">
            <div className="p-2 bg-gradient-to-r from-[#FF4500] to-[#FF6B35] bg-opacity-10 rounded-lg group-hover:bg-opacity-20 transition-all duration-300">
              <svg className="w-6 h-6 text-[#FF4500] group-hover:scale-110 group-hover:rotate-180 transition-all duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 group-hover:text-[#FF4500] transition-colors duration-300">Settings</h2>
              <p className="mt-1 text-gray-600 group-hover:text-gray-700 transition-colors duration-300">Configure your account settings</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
