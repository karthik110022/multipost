'use client';

import { useEffect, useState } from 'react';
import { socialMediaService } from '@/lib/social-media-service';
import { format } from 'date-fns';

interface BestTimeRecommendation {
  dayOfWeek: string;
  hourOfDay: number;
  score: number;
  activeUsers: number;
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
}

interface SubredditAnalyticsProps {
  subreddit: string;
  accountId: string;
}

export default function SubredditAnalytics({ subreddit, accountId }: SubredditAnalyticsProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<BestTimeRecommendation[]>([]);
  const [activeUsers, setActiveUsers] = useState(0);
  const [engagement, setEngagement] = useState<EngagementMetrics | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Fetching analytics for subreddit:', subreddit);

        // Fetch all analytics data in parallel
        const [activity, bestTimes, engagementMetrics] = await Promise.all([
          socialMediaService.getSubredditActivity(accountId, subreddit),
          socialMediaService.analyzeBestPostingTime(accountId, subreddit),
          socialMediaService.analyzeSubredditEngagement(accountId, subreddit)
        ]);

        console.log('Analytics data received:', {
          activeUsers: activity.activeUsers,
          numberOfRecommendations: bestTimes.length,
          engagementMetrics: {
            avgScore: engagementMetrics?.avgScore,
            avgComments: engagementMetrics?.avgComments,
            numberOfPeakHours: engagementMetrics?.peakHours.length,
            numberOfKeywords: engagementMetrics?.topKeywords.length
          }
        });

        setActiveUsers(activity.activeUsers);
        setRecommendations(bestTimes);
        setEngagement(engagementMetrics);
      } catch (err) {
        console.error('Error in fetchAnalytics:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
      } finally {
        setLoading(false);
      }
    };

    if (subreddit && accountId) {
      fetchAnalytics();
    }
  }, [subreddit, accountId]);

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">
        Error: {error}
      </div>
    );
  }

  const formatHour = (hour: number) => {
    const date = new Date();
    date.setHours(hour, 0, 0, 0);
    return format(date, 'h:00 a');
  };

  const capitalizeDay = (day: string) => {
    return day.charAt(0).toUpperCase() + day.slice(1);
  };

  return (
    <div className="p-4 space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">r/{subreddit} Analytics</h2>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <div className="text-sm text-gray-600 mb-2">Current Active Users</div>
            <div className="text-2xl font-bold text-[#FF4500]">{activeUsers.toLocaleString()}</div>
          </div>
          {engagement && (
            <div>
              <div className="text-sm text-gray-600 mb-2">Avg. Engagement</div>
              <div className="text-md">
                <span className="font-medium">{Math.round(engagement.avgScore).toLocaleString()}</span>
                <span className="text-gray-500"> points</span>
                <br />
                <span className="font-medium">{Math.round(engagement.avgComments).toLocaleString()}</span>
                <span className="text-gray-500"> comments</span>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-4">Best Times to Post</h3>
            <div className="grid gap-4">
              {recommendations.map((rec, index) => (
                <div 
                  key={`${rec.dayOfWeek}-${rec.hourOfDay}`}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 bg-[#FF4500] bg-opacity-10 rounded-full flex items-center justify-center">
                      <span className="text-[#FF4500] font-medium">{index + 1}</span>
                    </div>
                    <div>
                      <div className="font-medium">{capitalizeDay(rec.dayOfWeek)}</div>
                      <div className="text-sm text-gray-600">{formatHour(rec.hourOfDay)}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">Expected Score</div>
                    <div className="text-[#FF4500]">{Math.round(rec.score).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {engagement && engagement.topKeywords.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-4">Popular Keywords</h3>
              <div className="flex flex-wrap gap-2">
                {engagement.topKeywords.map(({ keyword, frequency }) => (
                  <span
                    key={keyword}
                    className="px-3 py-1 bg-[#FF4500] bg-opacity-10 text-[#FF4500] rounded-full text-sm"
                  >
                    {keyword}
                    <span className="ml-1 text-xs">({frequency})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {engagement && engagement.peakHours.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-4">Peak Activity Hours</h3>
              <div className="grid grid-cols-3 gap-2">
                {engagement.peakHours.map(({ hour, engagement: engagementScore }) => (
                  <div
                    key={hour}
                    className="p-2 text-center bg-gray-50 rounded"
                  >
                    <div className="font-medium">{formatHour(hour)}</div>
                    <div className="text-sm text-gray-600">
                      Score: {Math.round(engagementScore).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
