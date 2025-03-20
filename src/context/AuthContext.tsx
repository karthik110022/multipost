'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import type { User, AuthError, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signUp: async () => ({ error: new Error('Not implemented') as AuthError }),
  signIn: async () => ({ error: new Error('Not implemented') as AuthError }),
  signOut: async () => {},
});

export const useAuth = () => {
  return useContext(AuthContext);
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          setSession(session);
        });
      }
      setLoading(false);
    });

    // Listen for changes in auth state
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    console.log('Starting signup process...', { email });
    
    // Get the correct site URL
    const siteUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : process.env.NEXT_PUBLIC_APP_URL || 'https://multpost.netlify.app';
    
    console.log('Site URL for redirect:', siteUrl);
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${siteUrl}/auth/callback`,
          data: {
            email: email,
          }
        }
      });

      console.log('Signup response:', { data, error });
      
      if (error) {
        console.error('Signup error:', error);
      } else if (data) {
        console.log('Signup successful:', data);
      }

      return { error };
    } catch (err) {
      console.error('Unexpected error during signup:', err);
      return {
        error: new Error('An unexpected error occurred during signup') as AuthError
      };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('Sign in error:', error);
      } else if (data?.user) {
        router.push('/dashboard');
      }
      
      return { error };
    } catch (err) {
      console.error('Unexpected error during sign in:', err);
      return { 
        error: new Error('An unexpected error occurred during sign in') as AuthError 
      };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth/signin');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signUp,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
