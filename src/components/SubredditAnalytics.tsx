'use client';

import { useEffect, useState } from 'react';
import { socialMediaService } from '@/lib/social-media-service';
import { format } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { AnalyticsLoading } from './ui/PageTransition';

interface BestTimeRecommendation {
  dayOfWeek: string;
  hour: number;
  engagement: number;
}

interface TimeDataPoint {
  hour: number;
  value: number;
}

interface EngagementMetrics {
  avgScore: number;
  avgComments: number;
  peakHours: Array<{
    hour: number;
    engagement: number;
  }>;
  topKeywords: Array<{
    keyword: string;
    frequency: number;
  }>;
  upvotesByTime: Array<{
    hour: number;
    upvotes: number;
  }>;
  commentsByTime: Array<{
    hour: number;
    comments: number;
  }>;
  awardsByTime: Array<{
    hour: number;
    awards: number;
  }>;
}

interface SubredditAnalyticsProps {
  subreddit: string;
  accountId: string;
}

export default function SubredditAnalytics({ subreddit, accountId }: SubredditAnalyticsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'timing' | 'engagement' | 'keywords'>('timing');
  const [bestTimes, setBestTimes] = useState<BestTimeRecommendation[]>([]);
  const [engagement, setEngagement] = useState<EngagementMetrics | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!subreddit || !accountId) {
        setError('Missing subreddit or account information');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const [activity, bestTimesData, engagementMetrics] = await Promise.all([
          socialMediaService.getSubredditActivity(accountId, subreddit),
          socialMediaService.analyzeBestPostingTime(accountId, subreddit),
          socialMediaService.analyzeSubredditEngagement(accountId, subreddit)
        ]);

        // Transform bestTimes data to match our component's type
        const transformedBestTimes: BestTimeRecommendation[] = bestTimesData.map(time => ({
          dayOfWeek: time.dayOfWeek,
          hour: time.hourOfDay,
          engagement: time.score
        }));

        setBestTimes(transformedBestTimes);
        setEngagement(engagementMetrics);
      } catch (err) {
        console.error('Analytics fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [subreddit, accountId]);

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="relative">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-600"></div>
            <div className="animate-ping absolute top-0 left-0 rounded-full h-6 w-6 border-2 border-blue-400 opacity-30"></div>
          </div>
          <div>
            <span className="text-sm font-medium text-blue-800">Loading analytics for r/{subreddit}</span>
            <p className="text-xs text-blue-600 mt-1">Fetching real-time Reddit data...</p>
          </div>
        </div>
        <AnalyticsLoading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium text-red-800">Analytics Failed to Load</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
            <p className="text-xs text-red-600 mt-2">
              This might be due to Reddit API limitations or account permissions.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex space-x-4 border-b border-gray-200">
        <button
          onClick={() => setSelectedTab('timing')}
          className={`pb-2 px-1 ${
            selectedTab === 'timing'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500'
          }`}
        >
          Best Times
        </button>
        <button
          onClick={() => setSelectedTab('engagement')}
          className={`pb-2 px-1 ${
            selectedTab === 'engagement'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500'
          }`}
        >
          Engagement
        </button>
        <button
          onClick={() => setSelectedTab('keywords')}
          className={`pb-2 px-1 ${
            selectedTab === 'keywords'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500'
          }`}
        >
          Keywords
        </button>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {selectedTab === 'timing' && bestTimes.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Best Times to Post</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {bestTimes.map((time, index) => (
                <div
                  key={index}
                  className="p-4 rounded-lg bg-gray-50 border border-gray-100"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-500">{time.dayOfWeek}</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {format(new Date().setHours(time.hour), 'ha')}
                      </p>
                    </div>
                    <div className="text-sm text-gray-500">
                      Engagement: {time.engagement.toFixed(1)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedTab === 'engagement' && engagement && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Engagement Analysis</h3>
            
            {/* Upvotes Graph */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
              <h4 className="text-sm font-medium text-gray-700 mb-4">Average Upvotes by Time</h4>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={engagement.upvotesByTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="hour" 
                      tickFormatter={(hour: number) => format(new Date().setHours(hour), 'ha')}
                      fontSize={12}
                      tickMargin={8}
                    />
                    <YAxis 
                      fontSize={12}
                      tickMargin={8}
                      tickFormatter={(value: number) => value.toLocaleString()}
                    />
                    <Tooltip
                      formatter={(value: number) => [value.toLocaleString(), 'Upvotes']}
                      labelFormatter={(hour: number) => format(new Date().setHours(hour), 'ha')}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="upvotes" 
                      stroke="#4f46e5" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Comments Graph */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
              <h4 className="text-sm font-medium text-gray-700 mb-4">Average Comments by Time</h4>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={engagement.commentsByTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="hour" 
                      tickFormatter={(hour: number) => format(new Date().setHours(hour), 'ha')}
                      fontSize={12}
                      tickMargin={8}
                    />
                    <YAxis 
                      fontSize={12}
                      tickMargin={8}
                      tickFormatter={(value: number) => value.toLocaleString()}
                    />
                    <Tooltip
                      formatter={(value: number) => [value.toLocaleString(), 'Comments']}
                      labelFormatter={(hour: number) => format(new Date().setHours(hour), 'ha')}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="comments" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Awards Graph */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
              <h4 className="text-sm font-medium text-gray-700 mb-4">Average Awards by Time</h4>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={engagement.awardsByTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="hour" 
                      tickFormatter={(hour: number) => format(new Date().setHours(hour), 'ha')}
                      fontSize={12}
                      tickMargin={8}
                    />
                    <YAxis 
                      fontSize={12}
                      tickMargin={8}
                      tickFormatter={(value: number) => value.toLocaleString()}
                    />
                    <Tooltip
                      formatter={(value: number) => [value.toLocaleString(), 'Awards']}
                      labelFormatter={(hour: number) => format(new Date().setHours(hour), 'ha')}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="awards" 
                      stroke="#f59e0b" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'keywords' && engagement?.topKeywords && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Top Keywords</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {engagement.topKeywords.map((keyword, index) => (
                <div
                  key={index}
                  className="p-4 rounded-lg bg-gray-50 border border-gray-100"
                >
                  <h4 className="text-sm font-medium text-gray-500">#{index + 1}</h4>
                  <p className="text-lg font-semibold text-gray-900">{keyword.keyword}</p>
                  <p className="text-sm text-gray-500">
                    Used {keyword.frequency} times
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
