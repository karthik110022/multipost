'use client';

import { useAnalytics } from './AnalyticsProvider';
import PostAnalytics from './PostAnalytics';

export default function AnalyticsDisplay() {
  const { selectedSubreddit, selectedAccountId } = useAnalytics();

  if (!selectedSubreddit || !selectedAccountId) {
    return (
      <div className="text-center py-8 animate-fade-in">
        <div className="mx-auto h-12 w-12 text-gray-400 mb-4 animate-bounce">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M13 10V3L4 14h7v7l9-11h-7z" 
            />
          </svg>
        </div>
        <h3 className="text-sm font-medium text-gray-900 mb-2">No Analytics Yet</h3>
        <p className="text-sm text-gray-500">
          Select a subreddit to view real-time performance insights
        </p>
        <div className="mt-4 animate-pulse">
          <div className="h-2 bg-gray-200 rounded-full w-3/4 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PostAnalytics 
        subreddit={selectedSubreddit} 
        accountId={selectedAccountId} 
      />
    </div>
  );
}