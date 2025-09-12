'use client';

import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import React, { useState, useCallback, useEffect } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Link2,
  Image as ImageIcon,
  Video,
  List,
  ListOrdered,
  Code,
  Quote,
  MoreHorizontal,
  Type,
  Superscript as SuperscriptIcon,
} from 'lucide-react';
import { htmlToMarkdown, markdownToHtml } from '@/lib/markdown-utils';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  onImagesChange?: (images: File[]) => void;
  onVideosChange?: (videos: File[]) => void;
  placeholder?: string;
}

const MenuBar = ({ 
  editor, 
  images, 
  setImages, 
  onImagesChange,
  videos,
  setVideos,
  onVideosChange
}: { 
  editor: Editor | null;
  images: File[];
  setImages: React.Dispatch<React.SetStateAction<File[]>>;
  onImagesChange?: (images: File[]) => void;
  videos: File[];
  setVideos: React.Dispatch<React.SetStateAction<File[]>>;
  onVideosChange?: (videos: File[]) => void;
}) => {
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  if (!editor) {
    return null;
  }

  const addLink = () => {
    if (linkUrl && linkText) {
      editor
        .chain()
        .focus()
        .insertContent(`<a href="${linkUrl}">${linkText}</a>`)
        .run();
      setLinkUrl('');
      setLinkText('');
      setShowLinkDialog(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadingImage(true);
    try {
      // Add the file to our state
      const updatedImages = [...images, file];
      setImages(updatedImages);
      onImagesChange?.(updatedImages);
      
      // Add a placeholder text in the editor to indicate image was added
      const imagePlaceholder = `\n[📷 Image: ${file.name}]\n`;
      editor?.chain().focus().insertContent(imagePlaceholder).run();
      
      // The actual preview will be shown in the image preview section below
    } catch (error: any) {
      console.error('Error processing image:', error);
      alert(`Failed to process image: ${error.message}`);
    } finally {
      setUploadingImage(false);
      // Reset the input
      event.target.value = '';
    }
  };

  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadingVideo(true);
    try {
      // Create a preview URL for the video
      const previewUrl = URL.createObjectURL(file);
      
      // Add the video file to our videos state
      const updatedVideos = [...videos, file];
      setVideos(updatedVideos);
      onVideosChange?.(updatedVideos);
      
      // Add a placeholder text in the editor to indicate video was added
      const videoPlaceholder = `\n[📹 Video: ${file.name}]\n`;
      editor?.chain().focus().insertContent(videoPlaceholder).run();
      
      // The actual preview will be shown in the video preview section below
    } catch (error: any) {
      console.error('Error processing video:', error);
      alert(`Failed to process video: ${error.message}`);
    } finally {
      setUploadingVideo(false);
      // Reset the input
      event.target.value = '';
    }
  };

  return (
    <div className="border-b border-gray-200 bg-gray-50 p-1 flex items-center gap-0.5 flex-wrap">
      {/* Bold */}
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={`p-2 rounded hover:bg-gray-200 transition-colors text-gray-700 ${
          editor.isActive('bold') ? 'bg-gray-200' : ''
        }`}
        title="Bold (Ctrl+B)"
      >
        <Bold size={16} />
      </button>

      {/* Italic */}
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={`p-2 rounded hover:bg-gray-200 transition-colors text-gray-700 ${
          editor.isActive('italic') ? 'bg-gray-200' : ''
        }`}
        title="Italic (Ctrl+I)"
      >
        <Italic size={16} />
      </button>

      {/* Strikethrough */}
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        className={`p-2 rounded hover:bg-gray-200 transition-colors text-gray-700 ${
          editor.isActive('strike') ? 'bg-gray-200' : ''
        }`}
        title="Strikethrough"
      >
        <Strikethrough size={16} />
      </button>

      {/* Superscript */}
      <button
        onClick={() => editor.chain().focus().toggleSuperscript().run()}
        disabled={!editor.can().chain().focus().toggleSuperscript().run()}
        className={`p-2 rounded hover:bg-gray-200 transition-colors text-gray-700 ${
          editor.isActive('superscript') ? 'bg-gray-200' : ''
        }`}
        title="Superscript"
      >
        <span className="text-sm font-medium">X²</span>
      </button>

      {/* Heading */}
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`p-2 rounded hover:bg-gray-200 transition-colors text-gray-700 ${
          editor.isActive('heading', { level: 2 }) ? 'bg-gray-200' : ''
        }`}
        title="Heading"
      >
        <Type size={16} />
      </button>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      {/* Link */}
      <div className="relative">
        <button
          onClick={() => setShowLinkDialog(!showLinkDialog)}
          className={`p-2 rounded hover:bg-gray-200 transition-colors text-gray-700 ${
            editor.isActive('link') ? 'bg-gray-200' : ''
          }`}
          title="Add Link"
        >
          <Link2 size={16} />
        </button>
        {showLinkDialog && (
          <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg p-3 z-10 w-64">
            <input
              type="text"
              placeholder="Enter link text (what users will see)"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  document.getElementById('url-input')?.focus();
                }
              }}
              className="w-full px-2 py-1 border rounded mb-2"
              autoFocus
            />
            <input
              id="url-input"
              type="url"
              placeholder="Enter URL (https://example.com)"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addLink();
                }
              }}
              className="w-full px-2 py-1 border rounded mb-2"
            />
            <div className="flex gap-2">
              <button
                onClick={addLink}
                disabled={!linkText || !linkUrl}
                className={`px-3 py-1 rounded text-sm ${
                  linkText && linkUrl
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Add Link
              </button>
              <button
                onClick={() => {
                  setShowLinkDialog(false);
                  setLinkUrl('');
                  setLinkText('');
                }}
                className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Image */}
      <label className={`p-2 rounded hover:bg-gray-200 transition-colors text-gray-700 cursor-pointer ${
        uploadingImage ? 'opacity-50 cursor-not-allowed' : ''
      }`} title="Upload Image">
        {uploadingImage ? (
          <div className="w-4 h-4 border-2 border-gray-700 border-t-transparent rounded-full animate-spin" />
        ) : (
          <ImageIcon size={16} />
        )}
        <input
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
          onChange={handleImageUpload}
          disabled={uploadingImage}
          className="hidden"
        />
      </label>

      {/* Video */}
      <label className={`p-2 rounded hover:bg-gray-200 transition-colors text-gray-700 cursor-pointer ${
        uploadingVideo ? 'opacity-50 cursor-not-allowed' : ''
      }`} title="Upload Video">
        {uploadingVideo ? (
          <div className="w-4 h-4 border-2 border-gray-700 border-t-transparent rounded-full animate-spin" />
        ) : (
          <Video size={16} />
        )}
        <input
          type="file"
          accept="video/mp4,video/mov,video/avi,video/webm,video/quicktime"
          onChange={handleVideoUpload}
          disabled={uploadingVideo}
          className="hidden"
        />
      </label>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      {/* Bullet List */}
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`p-2 rounded hover:bg-gray-200 transition-colors text-gray-700 ${
          editor.isActive('bulletList') ? 'bg-gray-200' : ''
        }`}
        title="Bullet List"
      >
        <List size={16} />
      </button>

      {/* Numbered List */}
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`p-2 rounded hover:bg-gray-200 transition-colors text-gray-700 ${
          editor.isActive('orderedList') ? 'bg-gray-200' : ''
        }`}
        title="Numbered List"
      >
        <ListOrdered size={16} />
      </button>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      {/* Code Block */}
      <button
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={`p-2 rounded hover:bg-gray-200 transition-colors text-gray-700 ${
          editor.isActive('codeBlock') ? 'bg-gray-200' : ''
        }`}
        title="Code Block"
      >
        <Code size={16} />
      </button>

      {/* Quote */}
      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={`p-2 rounded hover:bg-gray-200 transition-colors text-gray-700 ${
          editor.isActive('blockquote') ? 'bg-gray-200' : ''
        }`}
        title="Quote"
      >
        <Quote size={16} />
      </button>

      {/* More options */}
      <button
        className="p-2 rounded hover:bg-gray-200 transition-colors text-gray-700"
        title="More Options"
      >
        <MoreHorizontal size={16} />
      </button>
    </div>
  );
};

export default function RichTextEditor({
  content,
  onChange,
  onImagesChange,
  onVideosChange,
  placeholder = 'Write your post content here...',
}: RichTextEditorProps) {
  const [isMarkdownMode, setIsMarkdownMode] = useState(false);
  const [markdownContent, setMarkdownContent] = useState(content);
  const [images, setImages] = useState<File[]>([]);
  const [videos, setVideos] = useState<File[]>([]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-500 underline',
        },
      }),
      Image,
      Underline,
      Placeholder.configure({
        placeholder,
      }),
      Superscript,
      Subscript,
    ],
    content: content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // Store HTML for rich text display, convert to markdown only when needed
      onChange(html);
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none focus:outline-none min-h-[200px] p-3 text-gray-900',
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const toggleMode = () => {
    if (isMarkdownMode) {
      // Switching from markdown to rich text mode
      const html = markdownToHtml(markdownContent);
      editor?.commands.setContent(html);
      onChange(html);
    } else {
      // Switching from rich text to markdown mode
      const html = editor?.getHTML() || '';
      const markdown = htmlToMarkdown(html);
      setMarkdownContent(markdown);
      onChange(markdown);
    }
    setIsMarkdownMode(!isMarkdownMode);
  };

  // Create preview URLs for images and videos
  const imagePreviews = React.useMemo(() => 
    images.map((image, index) => ({
      file: image,
      url: URL.createObjectURL(image),
      index
    })), [images]);

  const videoPreviews = React.useMemo(() =>
    videos.map((video, index) => ({
      file: video,
      url: URL.createObjectURL(video),
      index
    })), [videos]);

  return (
    <div>
      <div className="border border-gray-300 rounded-lg overflow-hidden">
        <div className="flex justify-between items-center px-3 py-2 bg-gray-50 border-b">
          <span className="text-sm text-gray-600">
            {isMarkdownMode ? 'Markdown Editor' : 'Rich Text Editor'}
          </span>
          <button
            onClick={toggleMode}
            className="text-sm text-blue-500 hover:text-blue-600 font-medium"
          >
            Switch to {isMarkdownMode ? 'Rich Text' : 'Markdown'} Editor
          </button>
        </div>

        {isMarkdownMode ? (
          <textarea
            value={markdownContent}
            onChange={(e) => {
              setMarkdownContent(e.target.value);
              onChange(e.target.value);
            }}
            className="w-full p-3 min-h-[200px] focus:outline-none resize-y font-mono text-sm"
            placeholder={placeholder}
          />
        ) : (
          <>
            <MenuBar 
              editor={editor} 
              images={images} 
              setImages={setImages} 
              onImagesChange={onImagesChange}
              videos={videos}
              setVideos={setVideos}
              onVideosChange={onVideosChange}
            />
            <EditorContent editor={editor} />
          </>
        )}
      </div>

      {/* Image Previews Section */}
      {imagePreviews.length > 0 && (
        <div className="mt-4 border border-gray-300 rounded-lg p-4 bg-gray-50">
          <h3 className="text-sm font-medium text-gray-700 mb-3">📷 Image Previews</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {imagePreviews.map(({ file, url, index }) => (
              <div key={index} className="relative group">
                <img 
                  src={url} 
                  alt={file.name}
                  className="w-full h-32 object-cover rounded-lg border border-gray-200"
                />
                <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                  <button
                    onClick={() => {
                      const newImages = images.filter((_, i) => i !== index);
                      setImages(newImages);
                      onImagesChange?.(newImages);
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                  >
                    Remove
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-1 truncate">{file.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Video Previews Section */}
      {videoPreviews.length > 0 && (
        <div className="mt-4 border border-gray-300 rounded-lg p-4 bg-gray-50">
          <h3 className="text-sm font-medium text-gray-700 mb-3">📹 Video Previews</h3>
          <div className="space-y-4">
            {videoPreviews.map(({ file, url, index }) => (
              <div key={index} className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="mb-2 flex justify-between items-center">
                  <span className="text-sm text-gray-600">{file.name}</span>
                  <button
                    onClick={() => {
                      const newVideos = videos.filter((_, i) => i !== index);
                      setVideos(newVideos);
                      onVideosChange?.(newVideos);
                    }}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Remove
                  </button>
                </div>
                <video 
                  controls 
                  className="w-full rounded-lg"
                  style={{ maxHeight: '300px' }}
                >
                  <source src={url} type={file.type} />
                  Your browser does not support the video tag.
                </video>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}