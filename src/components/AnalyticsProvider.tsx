'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import PostAnalytics from './PostAnalytics';

interface AnalyticsContextType {
  setSelectedSubreddit: (subreddit: string | null) => void;
  setSelectedAccountId: (accountId: string | null) => void;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
}

interface AnalyticsProviderProps {
  children: ReactNode;
}

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  const [selectedSubreddit, setSelectedSubreddit] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // Create a portal target for the analytics
  useEffect(() => {
    const analyticsContainer = document.getElementById('analytics-container');
    if (analyticsContainer) {
      const analytics = document.createElement('div');
      analytics.id = 'analytics-portal';
      analyticsContainer.appendChild(analytics);

      // Render the PostAnalytics component into the portal
      const root = createRoot(analytics);
      root.render(
        <PostAnalytics
          subreddit={selectedSubreddit}
          accountId={selectedAccountId}
        />
      );

      return () => {
        root.unmount();
        analytics.remove();
      };
    }
  }, [selectedSubreddit, selectedAccountId]);

  return (
    <AnalyticsContext.Provider value={{ setSelectedSubreddit, setSelectedAccountId }}>
      {children}
    </AnalyticsContext.Provider>
  );
}
