'use client';

import { Comment } from '@/lib/social-media-service';
import { formatDistanceToNow } from 'date-fns';

interface CommentsProps {
  comments: Comment[];
  isLoading?: boolean;
}

function CommentComponent({ comment }: { comment: Comment }) {
  return (
    <div className="border-l-2 border-gray-200 pl-4 mb-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-medium text-gray-900">{comment.author}</span>
        <span className="text-sm text-gray-500">
          {formatDistanceToNow(comment.createdAt * 1000, { addSuffix: true })}
        </span>
        <span className="text-sm text-gray-500">• {comment.score} points</span>
      </div>
      <p className="text-gray-700 mb-2">{comment.content}</p>
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-4">
          {comment.replies.map((reply) => (
            <CommentComponent key={reply.id} comment={reply} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Comments({ comments, isLoading }: CommentsProps) {
  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex space-x-4">
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!comments || comments.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No comments yet
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {comments.map((comment) => (
        <CommentComponent key={comment.id} comment={comment} />
      ))}
    </div>
  );
}
