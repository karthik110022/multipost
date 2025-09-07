'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [displayChildren, setDisplayChildren] = useState(children);

  useEffect(() => {
    setLoading(true);
    
    const timer = setTimeout(() => {
      setDisplayChildren(children);
      setLoading(false);
    }, 150); // Smooth transition delay

    return () => clearTimeout(timer);
  }, [pathname, children]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
            <div className="animate-ping absolute top-0 left-0 rounded-full h-12 w-12 border-2 border-blue-400 opacity-30"></div>
          </div>
          <div className="text-center">
            <p className="text-lg font-medium text-gray-700 animate-pulse">Loading...</p>
            <p className="text-sm text-gray-500 mt-1">Please wait while we prepare your content</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {displayChildren}
    </div>
  );
}

// Button loading component
interface LoadingButtonProps {
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

export function LoadingButton({ 
  children, 
  loading = false, 
  disabled = false, 
  onClick, 
  className = '', 
  type = 'button'
}: LoadingButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        relative inline-flex items-center justify-center
        transition-all duration-200 transform
        ${loading || disabled ? 'opacity-70 cursor-not-allowed' : 'hover:scale-105 hover:shadow-lg active:scale-95'}
        ${className}
      `}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-current mr-2"></div>
          <span className="animate-pulse">Loading...</span>
        </div>
      )}
      <span className={loading ? 'opacity-0' : 'opacity-100'}>
        {children}
      </span>
    </button>
  );
}

// Analytics loading component
export function AnalyticsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex space-x-4 border-b border-gray-200">
        {['Best Times', 'Engagement', 'Keywords'].map((tab, index) => (
          <div key={index} className="pb-2 px-1">
            <div className="h-4 w-16 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
      
      <div className="space-y-4">
        <div className="h-6 w-32 bg-gray-200 rounded"></div>
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="p-4 rounded-lg bg-gray-50 border border-gray-100">
              <div className="space-y-2">
                <div className="h-4 w-20 bg-gray-200 rounded"></div>
                <div className="h-6 w-16 bg-gray-200 rounded"></div>
                <div className="h-3 w-24 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Chart placeholders */}
        <div className="space-y-4 mt-8">
          <div className="h-6 w-40 bg-gray-200 rounded"></div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <div className="h-4 w-48 bg-gray-200 rounded mb-4"></div>
            <div className="h-48 bg-gray-100 rounded animate-shimmer"></div>
          </div>
        </div>
      </div>
    </div>
  );
}