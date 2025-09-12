'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const RichTextEditor = dynamic(() => import('./RichTextEditor'), {
  ssr: false,
  loading: () => (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <div className="border-b border-gray-200 bg-gray-50 p-1 flex items-center gap-0.5">
        <div className="animate-pulse flex space-x-1">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="w-8 h-8 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
      <div className="p-3 min-h-[200px] flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading editor...</div>
      </div>
    </div>
  ),
});

interface RichTextEditorWrapperProps {
  content: string;
  onChange: (content: string) => void;
  onImagesChange?: (images: File[]) => void;
  onVideosChange?: (videos: File[]) => void;
  placeholder?: string;
}

export default function RichTextEditorWrapper(props: RichTextEditorWrapperProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="border border-gray-300 rounded-lg overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 p-1 flex items-center gap-0.5">
          <div className="animate-pulse flex space-x-1">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="w-8 h-8 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
        <div className="p-3 min-h-[200px] flex items-center justify-center bg-gray-50">
          <div className="text-gray-500">Loading editor...</div>
        </div>
      </div>
    );
  }

  return <RichTextEditor {...props} />;
}