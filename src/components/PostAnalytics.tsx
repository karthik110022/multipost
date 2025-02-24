'use client';

import { useEffect, useState } from 'react';
import { socialMediaService } from '@/lib/social-media-service';
import { format } from 'date-fns';
import SubredditAnalytics from './SubredditAnalytics';

interface PostAnalyticsProps {
  subreddit: string | null;
  accountId: string | null;
}

export default function PostAnalytics({ subreddit, accountId }: PostAnalyticsProps) {
  if (!subreddit || !accountId) {
    return (
      <div className="text-center py-12">
        <svg 
          className="mx-auto h-12 w-12 text-gray-400" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M13 10V3L4 14h7v7l9-11h-7z" 
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No Analytics Yet</h3>
        <p className="mt-1 text-sm text-gray-500">
          Select a subreddit to view performance insights
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SubredditAnalytics 
        subreddit={subreddit} 
        accountId={accountId} 
      />
    </div>
  );
}
