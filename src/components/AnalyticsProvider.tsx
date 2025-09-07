'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface AnalyticsContextType {
  selectedSubreddit: string | null;
  selectedAccountId: string | null;
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

  return (
    <AnalyticsContext.Provider value={{ 
      selectedSubreddit,
      selectedAccountId,
      setSelectedSubreddit, 
      setSelectedAccountId 
    }}>
      {children}
    </AnalyticsContext.Provider>
  );
}
