'use client';

import { useEffect, useState } from 'react';
import { RedditService } from '@/lib/reddit-service';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'react-hot-toast';

interface Comment {
  id: string;
  author: string;
  body: string;
  created_utc: number;
  score: number;
  replies?: Comment[];
}

interface CommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  accountId: string;
}

export default function CommentModal({ isOpen, onClose, postId, accountId }: CommentModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function fetchComments() {
      if (!isOpen || !postId || !accountId) return;

      setIsLoading(true);
      setError(null);

      try {
        // Get the access token from the social account
        const { data: account, error: accountError } = await supabase
          .from('social_accounts')
          .select('access_token')
          .eq('id', accountId)
          .single();

        if (accountError || !account?.access_token) {
          throw new Error('Failed to get access token');
        }

        // Fetch comments using RedditService
        const redditService = new RedditService();
        const fetchedComments = await redditService.getPostComments(account.access_token, postId);
        setComments(fetchedComments);
      } catch (error: any) {
        console.error('Error fetching comments:', error);
        setError(error.message || 'Failed to load comments');
      } finally {
        setIsLoading(false);
      }
    }

    fetchComments();
  }, [isOpen, postId, accountId, supabase]);

  const handleReply = async (parentId: string) => {
    if (!replyContent.trim()) {
      toast.error('Please enter a reply');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: account, error: accountError } = await supabase
        .from('social_accounts')
        .select('access_token')
        .eq('id', accountId)
        .single();

      if (accountError || !account?.access_token) {
        throw new Error('Failed to get access token');
      }

      const redditService = new RedditService();
      const newReply = await redditService.postCommentReply(
        account.access_token,
        parentId,
        replyContent
      );

      // Update the comments state with the new reply
      const updateCommentsWithReply = (comments: Comment[]): Comment[] => {
        return comments.map(comment => {
          if (comment.id === parentId) {
            return {
              ...comment,
              replies: [...(comment.replies || []), newReply]
            };
          }
          if (comment.replies) {
            return {
              ...comment,
              replies: updateCommentsWithReply(comment.replies)
            };
          }
          return comment;
        });
      };

      setComments(updateCommentsWithReply(comments));
      setReplyContent('');
      setReplyingTo(null);
      toast.success('Reply posted successfully');
    } catch (error: any) {
      console.error('Error posting reply:', error);
      toast.error(error.message || 'Failed to post reply');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const renderComment = (comment: Comment) => (
    <div key={comment.id} className="border-b border-gray-200 p-4">
      <div className="flex items-start space-x-3">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <span className="font-medium text-gray-900">u/{comment.author}</span>
            <span className="text-sm text-gray-500">
              {formatDate(comment.created_utc)}
            </span>
          </div>
          <p className="mt-1 text-gray-700 whitespace-pre-wrap">{comment.body}</p>
          <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
            <span>Score: {comment.score}</span>
            <button
              onClick={() => setReplyingTo(comment.id)}
              className="text-blue-600 hover:text-blue-800"
            >
              Reply
            </button>
          </div>
          {replyingTo === comment.id && (
            <div className="mt-4 space-y-2">
              <Textarea
                value={replyContent}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReplyContent(e.target.value)}
                placeholder="Write your reply..."
                className="w-full"
                rows={3}
              />
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setReplyingTo(null);
                    setReplyContent('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleReply(comment.id)}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Posting...' : 'Post Reply'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-8 mt-4 space-y-4">
          {comment.replies.map(reply => renderComment(reply))}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Comments</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto max-h-[calc(80vh-4rem)]">
          {isLoading ? (
            <div className="p-4 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading comments...</p>
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-600">
              {error}
            </div>
          ) : comments.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No comments yet
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {comments.map(comment => renderComment(comment))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
