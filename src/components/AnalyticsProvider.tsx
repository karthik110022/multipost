'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
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
  const rootRef = useRef<ReturnType<typeof createRoot> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Create a portal target for the analytics
  useEffect(() => {
    const analyticsContainer = document.getElementById('analytics-container');
    if (!analyticsContainer) return;

    // Create container if it doesn't exist
    if (!containerRef.current) {
      const analytics = document.createElement('div');
      analytics.id = 'analytics-portal';
      analyticsContainer.appendChild(analytics);
      containerRef.current = analytics;
    }

    // Create root if it doesn't exist
    if (!rootRef.current && containerRef.current) {
      rootRef.current = createRoot(containerRef.current);
    }

    // Render analytics
    if (rootRef.current) {
      rootRef.current.render(
        <PostAnalytics
          subreddit={selectedSubreddit}
          accountId={selectedAccountId}
        />
      );
    }

    // Cleanup function
    return () => {
      if (rootRef.current) {
        // Use requestAnimationFrame to ensure we're not unmounting during render
        requestAnimationFrame(() => {
          rootRef.current?.unmount();
          rootRef.current = null;
        });
      }
      if (containerRef.current) {
        requestAnimationFrame(() => {
          containerRef.current?.remove();
          containerRef.current = null;
        });
      }
    };
  }, [selectedSubreddit, selectedAccountId]);

  return (
    <AnalyticsContext.Provider value={{ setSelectedSubreddit, setSelectedAccountId }}>
      {children}
    </AnalyticsContext.Provider>
  );
}
