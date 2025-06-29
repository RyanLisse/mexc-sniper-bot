"use client";

import { createClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from "react";

// Create Supabase client for browser-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    }
  }
);

interface AuthUser {
  id: string;
  email: string;
  name?: string;
  username?: string;
  picture?: string;
  emailVerified?: boolean;
}

interface AuthSession {
  user?: AuthUser;
  isAuthenticated: boolean;
  accessToken?: string;
}

interface AuthError extends Error {
  message: string;
}

/**
 * Custom hook for Supabase authentication
 */
export const useAuth = () => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isPending, setIsPending] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      setIsPending(true);
      setError(null);

      const { data: { session: supabaseSession }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(sessionError.message);
      }

      if (supabaseSession?.user) {
        const user = supabaseSession.user;
        const authUser: AuthUser = {
          id: user.id,
          email: user.email ?? "",
          name: user.user_metadata?.full_name || user.user_metadata?.name || user.email || "User",
          username: user.user_metadata?.username,
          picture: user.user_metadata?.picture || user.user_metadata?.avatar_url,
          emailVerified: !!user.email_confirmed_at,
        };

        setSession({
          user: authUser,
          isAuthenticated: true,
          accessToken: supabaseSession.access_token,
        });
      } else {
        setSession({
          isAuthenticated: false,
        });
      }
    } catch (err) {
      const error = err as AuthError;
      setError(error);
      setSession({
        isAuthenticated: false,
      });
    } finally {
      setIsPending(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await fetchSession();
      } else if (event === 'SIGNED_OUT') {
        setSession({
          isAuthenticated: false,
        });
        setIsPending(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchSession]);

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }, []);

  return {
    user: session?.user || null,
    isLoading: isPending,
    isAuthenticated: session?.isAuthenticated || false,
    isAnonymous: !session?.isAuthenticated && !isPending,
    session,
    error,
    refetch: fetchSession,
    getToken,
  };
};

/**
 * Hook for session data compatible with existing interface
 */
export const useSession = () => {
  const auth = useAuth();

  return {
    data: auth.session,
    isPending: auth.isLoading,
    error: auth.error,
    refetch: auth.refetch,
  };
};

/**
 * Sign in with email and password
 */
export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

/**
 * Sign up with email and password
 */
export const signUpWithEmail = async (email: string, password: string, options?: {
  name?: string;
  username?: string;
}) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: options?.name,
        username: options?.username,
      }
    }
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

/**
 * Sign in with OAuth providers
 */
export const signInWithOAuth = async (provider: 'google' | 'github' | 'discord') => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
    }
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

/**
 * Sign out
 */
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    throw new Error(error.message);
  }
};

/**
 * Reset password
 */
export const resetPassword = async (email: string) => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

/**
 * Update password
 */
export const updatePassword = async (newPassword: string) => {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

/**
 * Update user profile
 */
export const updateProfile = async (updates: {
  name?: string;
  username?: string;
  picture?: string;
}) => {
  const { data, error } = await supabase.auth.updateUser({
    data: {
      full_name: updates.name,
      username: updates.username,
      picture: updates.picture,
    }
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

// Export supabase client for direct access if needed
export { supabase };

// Export for compatibility with existing code
export { 
  signInWithEmail as signIn, 
  signUpWithEmail as signUp,
  signInWithEmail as login, 
  signUpWithEmail as register 
};