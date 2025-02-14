import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { createServerClient } from '@supabase/ssr';
import { SocialMediaService } from '@/lib/social-media-service';

// Mock the required modules
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn()
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
  }))
}));

vi.mock('@/lib/social-media-service', () => ({
  SocialMediaService: vi.fn()
}));

describe('POST /api/social/create-post', () => {
  let mockRequest: Request;
  const mockUser = { id: 'test-user-id' };
  const mockSupabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null })
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createServerClient as any).mockReturnValue(mockSupabase);
  });

  it('should validate required fields', async () => {
    // Test missing fields
    mockRequest = new Request('http://localhost:3000/api/social/create-post', {
      method: 'POST',
      body: JSON.stringify({})
    });

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Missing required fields');
  });

  it('should validate post configurations', async () => {
    // Test invalid post configuration
    mockRequest = new Request('http://localhost:3000/api/social/create-post', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Post',
        content: 'Test Content',
        posts: [{ accountId: 'test-account' }] // Missing subreddit
      })
    });

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Each post configuration must include accountId and subreddit');
  });

  it('should successfully create posts', async () => {
    // Mock successful post creation
    const mockCreatePost = vi.fn().mockResolvedValue([
      { success: true, platformPostId: 'test-post-1' },
      { success: true, platformPostId: 'test-post-2' }
    ]);
    (SocialMediaService as any).mockImplementation(() => ({
      createPost: mockCreatePost
    }));

    mockRequest = new Request('http://localhost:3000/api/social/create-post', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Post',
        content: 'Test Content',
        posts: [
          { accountId: 'account-1', subreddit: 'subreddit1', flairId: 'flair1' },
          { accountId: 'account-2', subreddit: 'subreddit2' }
        ]
      })
    });

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockCreatePost).toHaveBeenCalledWith(
      'Test Content',
      'Test Post',
      [
        { accountId: 'account-1', subreddit: 'subreddit1', flairId: 'flair1' },
        { accountId: 'account-2', subreddit: 'subreddit2' }
      ]
    );
    expect(data).toEqual([
      { success: true, platformPostId: 'test-post-1' },
      { success: true, platformPostId: 'test-post-2' }
    ]);
  });

  it('should handle unauthorized requests', async () => {
    // Mock unauthorized user
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    mockRequest = new Request('http://localhost:3000/api/social/create-post', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Post',
        content: 'Test Content',
        posts: [{ accountId: 'test-account', subreddit: 'test-subreddit' }]
      })
    });

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });
});
