import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { RedditService } from '@/lib/reddit-service';

export async function DELETE(request: Request) {
  try {
    console.log('🚀 Starting Reddit post deletion process...');
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      console.log('❌ Unauthorized: No session found');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');
    const platformPostId = searchParams.get('platformPostId');
    const socialAccountId = searchParams.get('socialAccountId');

    console.log('📝 Deletion request details:', {
      postId,
      platformPostId,
      socialAccountId,
      userId: session.user.id
    });

    if (!postId || !platformPostId || !socialAccountId) {
      console.log('❌ Missing required parameters');
      return NextResponse.json(
        { error: 'Post ID, Platform Post ID, and Social Account ID are required' },
        { status: 400 }
      );
    }

    // Get the social account with access token
    console.log('🔑 Fetching social account details...');
    const { data: account, error: accountError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('id', socialAccountId)
      .eq('user_id', session.user.id)
      .single();

    if (accountError || !account) {
      console.log('❌ Social account not found:', accountError);
      return NextResponse.json(
        { error: 'Social account not found or not authorized' },
        { status: 404 }
      );
    }

    console.log('✅ Social account found:', {
      accountId: account.id,
      platform: account.platform,
      hasAccessToken: !!account.access_token,
      accessTokenLength: account.access_token?.length
    });

    // Delete the post from Reddit
    console.log('🗑️ Attempting to delete post from Reddit...');
    const redditService = new RedditService();
    let redditDeletionSuccess = false;
    let redditError = null;

    try {
      await redditService.deletePost(account.access_token, platformPostId);
      redditDeletionSuccess = true;
      console.log('✅ Successfully deleted post from Reddit');
    } catch (error: any) {
      redditError = error.message;
      console.error('❌ Error deleting post from Reddit:', {
        error: error.message,
        stack: error.stack,
        platformPostId,
        response: error.response?.data
      });

      // If it's a rate limit error, return a specific status
      if (error.message === 'RATE_LIMITED') {
        return NextResponse.json(
          { error: 'Rate limited by Reddit. Please try again later.' },
          { status: 429 }
        );
      }
    }

    // Delete associated post_platforms first (due to foreign key constraints)
    console.log('🗑️ Deleting post platforms from database...');
    const { error: deletePlatformsError } = await supabase
      .from('post_platforms')
      .delete()
      .eq('post_id', postId);

    if (deletePlatformsError) {
      console.error('❌ Error deleting post platforms:', deletePlatformsError);
      throw deletePlatformsError;
    }
    console.log('✅ Successfully deleted post platforms');

    // Delete the post from our database
    console.log('🗑️ Deleting post from database...');
    const { error: deleteError } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', session.user.id);

    if (deleteError) {
      console.error('❌ Error deleting post:', deleteError);
      throw deleteError;
    }
    console.log('✅ Successfully deleted post from database');

    console.log('🎉 Post deletion process completed successfully');
    return NextResponse.json({ 
      success: true,
      redditDeletionSuccess,
      redditError,
      message: redditDeletionSuccess 
        ? 'Post deleted successfully from both Reddit and database' 
        : `Post deleted from database but failed to delete from Reddit: ${redditError}`
    });
  } catch (error: any) {
    console.error('❌ Error in delete-reddit-post:', {
      error: error.message,
      stack: error.stack
    });
    return NextResponse.json(
      { error: error.message || 'Failed to delete post' },
      { status: 500 }
    );
  }
} 