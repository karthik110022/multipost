import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import PostForm from '@/components/PostForm';
import { AnalyticsProvider } from '@/components/AnalyticsProvider';

export default async function CreatePost() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set(name, '', options);
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/signin');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Content - Post Form */}
          <div className="lg:w-[60%]">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-100">
                <h1 className="text-2xl font-bold text-gray-900">Create Post</h1>
                <p className="text-gray-600 mt-1">Share your content across multiple subreddits</p>
              </div>
              <div className="p-6">
                <AnalyticsProvider>
                  <PostForm user={user} />
                </AnalyticsProvider>
              </div>
            </div>
          </div>

          {/* Sidebar - Analytics */}
          <div className="lg:w-[40%] lg:sticky lg:top-8 self-start">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-xl font-semibold text-gray-900">Post Analytics</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Get insights to optimize your post's performance
                </p>
              </div>
              <div className="p-6" id="analytics-container">
                {/* Analytics content will be dynamically rendered by PostForm */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
