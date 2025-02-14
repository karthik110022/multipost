import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SocialMediaService } from '../social-media-service';
import { RedditService } from '../reddit-service';

vi.mock('../reddit-service');

describe('SocialMediaService', () => {
  let service: SocialMediaService;
  const mockSupabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null })
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SocialMediaService(mockSupabase);
  });

  describe('createPost', () => {
    it('should create posts for multiple subreddits', async () => {
      // Mock database responses
      mockSupabase.single
        // First call - create post
        .mockResolvedValueOnce({ data: { id: 'post-1' }, error: null })
        // Second call - get first account
        .mockResolvedValueOnce({ 
          data: { 
            id: 'account-1',
            platform: 'reddit',
            access_token: 'token-1',
            refresh_token: 'refresh-1'
          },
          error: null
        })
        // Third call - get second account
        .mockResolvedValueOnce({
          data: {
            id: 'account-2',
            platform: 'reddit',
            access_token: 'token-2',
            refresh_token: 'refresh-2'
          },
          error: null
        });

      // Mock Reddit service methods
      (RedditService as any).mockImplementation(() => ({
        validateAccessToken: vi.fn().mockResolvedValue(true),
        submitPost: vi.fn()
          .mockResolvedValueOnce('reddit-post-1')
          .mockResolvedValueOnce('reddit-post-2'),
        getFlairOptions: vi.fn().mockResolvedValue([])
      }));

      const result = await service.createPost(
        'Test content',
        'Test title',
        [
          { accountId: 'account-1', subreddit: 'subreddit1', flairId: 'flair1' },
          { accountId: 'account-2', subreddit: 'subreddit2' }
        ]
      );

      expect(result).toHaveLength(2);
      expect(result[0].success).toBe(true);
      expect(result[0].platformPostId).toBe('reddit-post-1');
      expect(result[1].success).toBe(true);
      expect(result[1].platformPostId).toBe('reddit-post-2');
    });

    it('should handle required flairs', async () => {
      // Mock database responses
      mockSupabase.single
        .mockResolvedValueOnce({ data: { id: 'post-1' }, error: null })
        .mockResolvedValueOnce({ 
          data: { 
            id: 'account-1',
            platform: 'reddit',
            access_token: 'token-1'
          },
          error: null
        });

      // Mock Reddit service methods
      const mockFlairs = [
        { id: 'flair1', text: 'Required Flair' }
      ];
      
      (RedditService as any).mockImplementation(() => ({
        validateAccessToken: vi.fn().mockResolvedValue(true),
        getFlairOptions: vi.fn().mockResolvedValue(mockFlairs)
      }));

      const result = await service.createPost(
        'Test content',
        'Test title',
        [
          { accountId: 'account-1', subreddit: 'subreddit1' } // No flair provided
        ]
      );

      expect(result).toHaveLength(1);
      expect(result[0].success).toBe(false);
      expect(result[0].requiresFlair).toBe(true);
      expect(result[0].availableFlairs).toEqual(mockFlairs);
    });

    it('should handle token refresh', async () => {
      // Mock database responses
      mockSupabase.single
        .mockResolvedValueOnce({ data: { id: 'post-1' }, error: null })
        .mockResolvedValueOnce({ 
          data: { 
            id: 'account-1',
            platform: 'reddit',
            access_token: 'old-token',
            refresh_token: 'refresh-token'
          },
          error: null
        });

      // Mock Reddit service methods
      (RedditService as any).mockImplementation(() => ({
        validateAccessToken: vi.fn().mockResolvedValue(false),
        refreshToken: vi.fn().mockResolvedValue('new-token'),
        submitPost: vi.fn().mockResolvedValue('reddit-post-1'),
        getFlairOptions: vi.fn().mockResolvedValue([])
      }));

      const result = await service.createPost(
        'Test content',
        'Test title',
        [
          { accountId: 'account-1', subreddit: 'subreddit1' }
        ]
      );

      expect(result).toHaveLength(1);
      expect(result[0].success).toBe(true);
      expect(mockSupabase.update).toHaveBeenCalledWith({ access_token: 'new-token' });
    });

    it('should handle errors gracefully', async () => {
      // Mock database error
      mockSupabase.single
        .mockResolvedValueOnce({ data: { id: 'post-1' }, error: null })
        .mockRejectedValueOnce(new Error('Database error'));

      const result = await service.createPost(
        'Test content',
        'Test title',
        [
          { accountId: 'account-1', subreddit: 'subreddit1' }
        ]
      );

      expect(result).toHaveLength(1);
      expect(result[0].success).toBe(false);
      expect(result[0].error).toBe('Failed to fetch account');
    });
  });
});
