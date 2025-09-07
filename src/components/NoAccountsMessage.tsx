'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function NoAccountsMessage() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="min-h-[60vh] flex items-center justify-center animate-fade-in">
      <div className="max-w-md mx-auto text-center p-8 animate-slide-up">
        <div className="mb-6 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-[#FF4500]/20 to-[#FF6B35]/20 rounded-full blur-2xl animate-pulse-slow"></div>
          <svg 
            className="w-20 h-20 mx-auto text-gray-400 relative z-10 animate-bounce-subtle"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-3 animate-slide-up-delay-1">
          No Connected Accounts
        </h2>
        
        <p className="text-gray-600 mb-8 animate-slide-up-delay-2">
          You need to connect at least one Reddit account before you can create posts. 
          Connect your account to get started!
        </p>
        
        <Link
          href="/accounts"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-[#FF4500] to-[#FF6B35] text-white font-medium rounded-lg hover:from-[#FF5722] hover:to-[#FF7043] transition-all duration-300 transform hover:scale-105 hover:shadow-lg animate-slide-up-delay-3 group"
        >
          <svg 
            className={`w-5 h-5 mr-2 transition-transform duration-300 ${isHovered ? 'rotate-90' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 6v6m0 0v6m0-6h6m-6 0H6" 
            />
          </svg>
          <span className="relative">
            Connect Reddit Account
            <span className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 rounded transition-opacity duration-300"></span>
          </span>
        </Link>
        
        <div className="mt-6 animate-slide-up-delay-4">
          <Link
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-gray-700 underline hover:no-underline transition-all duration-200 hover:bg-gray-100 px-3 py-1 rounded"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}