"use client";

import type { AuthError, Session, User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/src/lib/supabase-browser-client';

type SupabaseAuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isHydrated: boolean;
  signOut: () => Promise<AuthError | null>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signInWithProvider: (provider: 'google' | 'github') => Promise<{ error: any }>;
};

const SupabaseAuthContext = createContext<SupabaseAuthContextType | undefined>(undefined);

interface SupabaseAuthProviderProps {
  children: ReactNode;
  initialSession?: Session | null;
}

export function SupabaseAuthProvider({ children, initialSession = null }: SupabaseAuthProviderProps) {
  const [user, setUser] = useState<User | null>(initialSession?.user ?? null);
  const [session, setSession] = useState<Session | null>(initialSession);
  const [isLoading, setIsLoading] = useState(!initialSession);
  const [isHydrated, setIsHydrated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Mark as hydrated after first render to prevent hydration mismatch
    setIsHydrated(true);

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          setSession(null);
          setUser(null);
        } else {
          setSession(session);
          setUser(session?.user ?? null);
        }
      } catch (error) {
        console.error('Session fetch error:', error);
        setSession(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    // Only fetch session if we don't have an initial session
    if (!initialSession) {
      getSession();
    } else {
      setIsLoading(false);
    }

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);

        if (event === 'SIGNED_IN' && session?.user) {
          // Sync user with database when they sign in
          try {
            const response = await fetch('/api/auth/supabase-session', {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
            });
            
            if (!response.ok) {
              console.warn('Failed to sync user with database:', response.statusText);
            }
          } catch (error) {
            console.warn('Failed to sync user with database:', error);
          }
          
          router.refresh();
        } else if (event === 'SIGNED_OUT') {
          router.push('/auth');
          router.refresh();
        } else if (event === 'TOKEN_REFRESHED') {
          router.refresh();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router, initialSession]);

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return new Error('Supabase client not available (SSR environment)') as AuthError;
    }
    
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
        return error;
      }
      return null;
    } catch (error) {
      console.error('Unexpected error during sign out:', error);
      return error as AuthError;
    }
  };

  const signIn = async (email: string, password: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { error: new Error('Supabase client not available (SSR environment)') };
    }
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error };
    }
  };

  const signUp = async (email: string, password: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { error: new Error('Supabase client not available (SSR environment)') };
    }
    
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '/auth/callback',
        },
      });
      return { error };
    } catch (error) {
      return { error };
    }
  };

  const signInWithProvider = async (provider: 'google' | 'github') => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { error: new Error('Supabase client not available (SSR environment)') };
    }
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '/auth/callback',
        },
      });
      return { error };
    } catch (error) {
      return { error };
    }
  };

  const value = {
    user,
    session,
    isLoading,
    isHydrated,
    signOut,
    signIn,
    signUp,
    signInWithProvider,
  };

  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const context = useContext(SupabaseAuthContext);
  if (context === undefined) {
    throw new Error('useSupabaseAuth must be used within a SupabaseAuthProvider');
  }
  return context;
}

// Alias for backward compatibility
export const useAuth = useSupabaseAuth;