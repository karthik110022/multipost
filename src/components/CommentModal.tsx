'use client';

import { useEffect, useState } from 'react';
import { Comment, socialMediaService } from '@/lib/social-media-service';
import Comments from './Comments';

interface CommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  accountId: string;
}

export default function CommentModal({ isOpen, onClose, postId, accountId }: CommentModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen && postId && accountId) {
      setIsLoading(true);
      socialMediaService.getPostComments(accountId, postId)
        .then(fetchedComments => {
          setComments(fetchedComments);
          setIsLoading(false);
        })
        .catch(error => {
          console.error('Error fetching comments:', error);
          setIsLoading(false);
        });
    }
  }, [isOpen, postId, accountId]);

  if (!isOpen) return null;

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
          <Comments comments={comments} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
