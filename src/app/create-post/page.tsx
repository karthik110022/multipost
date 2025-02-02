import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import PostForm from '@/components/PostForm';

export default async function CreatePost() {
  const cookieStore = cookies();
  const supabase = createServerComponentClient({ cookies: () => cookieStore });

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/auth/signin');
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">Create Post</h1>
      <PostForm user={session.user} />
    </div>
  );
}
