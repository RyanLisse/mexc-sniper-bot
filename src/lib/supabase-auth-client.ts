"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "./supabase-browser-client";
import {
  bypassRateLimitInDev,
  type RateLimitInfo,
  type RetryConfig,
  SupabaseRateLimitHandler,
  withRateLimitHandling,
} from "./supabase-rate-limit-handler";

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
  rateLimitInfo?: RateLimitInfo;
}

interface AuthOptions {
  retryConfig?: Partial<RetryConfig>;
  enableRateLimitHandling?: boolean;
  bypassInDevelopment?: boolean;
  onRateLimit?: (rateLimitInfo: RateLimitInfo) => void;
  onRetry?: (attempt: number, delay: number) => void;
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

      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        throw new Error("Supabase client not available (SSR environment)");
      }

      const {
        data: { session: supabaseSession },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(sessionError.message);
      }

      if (supabaseSession?.user) {
        const user = supabaseSession.user;
        const authUser: AuthUser = {
          id: user.id,
          email: user.email ?? "",
          name:
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email ||
            "User",
          username: user.user_metadata?.username,
          picture:
            user.user_metadata?.picture || user.user_metadata?.avatar_url,
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
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setSession({ isAuthenticated: false });
      setIsPending(false);
      return () => {};
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, _session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        await fetchSession();

        // CRITICAL FIX: Sync user with database on client-side auth state changes
        if (event === "SIGNED_IN" && _session?.user) {
          try {
            // Call the session API which now includes user sync
            await fetch("/api/auth/session", {
              method: "GET",
              credentials: "include",
            });
          } catch (syncError) {
            console.error("Failed to trigger user sync on client:", syncError);
          }
        }
      } else if (event === "SIGNED_OUT") {
        setSession({
          isAuthenticated: false,
        });
        setIsPending(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchSession]);

  const getToken = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return null;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
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
 * Enhanced sign in with email and password with rate limit handling
 */
export const signInWithEmail = async (
  email: string,
  password: string,
  options: AuthOptions = {}
) => {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase client not available (SSR environment)");
  }

  const enableRateLimitHandling = options.enableRateLimitHandling !== false;

  const operation = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const authError = new Error(error.message) as AuthError;

      // Analyze rate limit info
      const rateLimitInfo =
        SupabaseRateLimitHandler.analyzeRateLimitError(error);
      if (rateLimitInfo.isRateLimited) {
        authError.rateLimitInfo = rateLimitInfo;
      }

      throw authError;
    }

    return data;
  };

  if (enableRateLimitHandling) {
    return withRateLimitHandling(operation, {
      config: options.retryConfig,
      onRateLimit: options.onRateLimit,
      onRetry: options.onRetry,
      onFailure: async (error) => {
        // Try bypass in development if enabled
        if (options.bypassInDevelopment && error.rateLimitInfo) {
          const bypassSuccess = await bypassRateLimitInDev(email);
          if (bypassSuccess) {
            // Retry the operation after bypass
            return operation();
          }
        }
      },
    });
  }

  return operation();
};

/**
 * Enhanced sign up with email and password with rate limit handling
 */
export const signUpWithEmail = async (
  email: string,
  password: string,
  userOptions?: {
    name?: string;
    username?: string;
  },
  authOptions: AuthOptions = {}
) => {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase client not available (SSR environment)");
  }

  const enableRateLimitHandling = authOptions.enableRateLimitHandling !== false;

  const operation = async () => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: userOptions?.name,
          username: userOptions?.username,
        },
      },
    });

    if (error) {
      const authError = new Error(error.message) as AuthError;

      // Analyze rate limit info
      const rateLimitInfo =
        SupabaseRateLimitHandler.analyzeRateLimitError(error);
      if (rateLimitInfo.isRateLimited) {
        authError.rateLimitInfo = rateLimitInfo;
      }

      throw authError;
    }

    return data;
  };

  if (enableRateLimitHandling) {
    return withRateLimitHandling(operation, {
      config: authOptions.retryConfig,
      onRateLimit: authOptions.onRateLimit,
      onRetry: authOptions.onRetry,
      onFailure: async (error) => {
        // Try bypass in development if enabled
        if (authOptions.bypassInDevelopment && error.rateLimitInfo) {
          const bypassSuccess = await bypassRateLimitInDev(email);
          if (bypassSuccess) {
            // Retry the operation after bypass
            return operation();
          }
        }
      },
    });
  }

  return operation();
};

/**
 * Enhanced sign in with OAuth providers with rate limit handling
 */
export const signInWithOAuth = async (
  provider: "google" | "github" | "discord",
  authOptions: AuthOptions = {}
) => {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase client not available (SSR environment)");
  }

  const enableRateLimitHandling = authOptions.enableRateLimitHandling !== false;

  const operation = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      const authError = new Error(error.message) as AuthError;

      // Analyze rate limit info
      const rateLimitInfo =
        SupabaseRateLimitHandler.analyzeRateLimitError(error);
      if (rateLimitInfo.isRateLimited) {
        authError.rateLimitInfo = rateLimitInfo;
      }

      throw authError;
    }

    return data;
  };

  if (enableRateLimitHandling) {
    return withRateLimitHandling(operation, {
      config: authOptions.retryConfig,
      onRateLimit: authOptions.onRateLimit,
      onRetry: authOptions.onRetry,
    });
  }

  return operation();
};

/**
 * Sign out
 */
export const signOut = async () => {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase client not available (SSR environment)");
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
};

/**
 * Enhanced reset password with rate limit handling
 */
export const resetPassword = async (
  email: string,
  authOptions: AuthOptions = {}
) => {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase client not available (SSR environment)");
  }

  const enableRateLimitHandling = authOptions.enableRateLimitHandling !== false;

  const operation = async () => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) {
      const authError = new Error(error.message) as AuthError;

      // Analyze rate limit info
      const rateLimitInfo =
        SupabaseRateLimitHandler.analyzeRateLimitError(error);
      if (rateLimitInfo.isRateLimited) {
        authError.rateLimitInfo = rateLimitInfo;
      }

      throw authError;
    }

    return data;
  };

  if (enableRateLimitHandling) {
    return withRateLimitHandling(operation, {
      config: authOptions.retryConfig,
      onRateLimit: authOptions.onRateLimit,
      onRetry: authOptions.onRetry,
      onFailure: async (error) => {
        // Try bypass in development if enabled
        if (authOptions.bypassInDevelopment && error.rateLimitInfo) {
          const bypassSuccess = await bypassRateLimitInDev(email);
          if (bypassSuccess) {
            // Retry the operation after bypass
            return operation();
          }
        }
      },
    });
  }

  return operation();
};

/**
 * Enhanced update password with rate limit handling
 */
export const updatePassword = async (
  newPassword: string,
  authOptions: AuthOptions = {}
) => {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase client not available (SSR environment)");
  }

  const enableRateLimitHandling = authOptions.enableRateLimitHandling !== false;

  const operation = async () => {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      const authError = new Error(error.message) as AuthError;

      // Analyze rate limit info
      const rateLimitInfo =
        SupabaseRateLimitHandler.analyzeRateLimitError(error);
      if (rateLimitInfo.isRateLimited) {
        authError.rateLimitInfo = rateLimitInfo;
      }

      throw authError;
    }

    return data;
  };

  if (enableRateLimitHandling) {
    return withRateLimitHandling(operation, {
      config: authOptions.retryConfig,
      onRateLimit: authOptions.onRateLimit,
      onRetry: authOptions.onRetry,
    });
  }

  return operation();
};

/**
 * Enhanced update user profile with rate limit handling
 */
export const updateProfile = async (
  updates: {
    name?: string;
    username?: string;
    picture?: string;
  },
  authOptions: AuthOptions = {}
) => {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase client not available (SSR environment)");
  }

  const enableRateLimitHandling = authOptions.enableRateLimitHandling !== false;

  const operation = async () => {
    const { data, error } = await supabase.auth.updateUser({
      data: {
        full_name: updates.name,
        username: updates.username,
        picture: updates.picture,
      },
    });

    if (error) {
      const authError = new Error(error.message) as AuthError;

      // Analyze rate limit info
      const rateLimitInfo =
        SupabaseRateLimitHandler.analyzeRateLimitError(error);
      if (rateLimitInfo.isRateLimited) {
        authError.rateLimitInfo = rateLimitInfo;
      }

      throw authError;
    }

    return data;
  };

  if (enableRateLimitHandling) {
    return withRateLimitHandling(operation, {
      config: authOptions.retryConfig,
      onRateLimit: authOptions.onRateLimit,
      onRetry: authOptions.onRetry,
    });
  }

  return operation();
};

// Export supabase client for direct access if needed
export const supabase = getSupabaseBrowserClient();

/**
 * Enhanced auth hook with rate limit monitoring
 */
export const useAuthWithRateLimit = () => {
  const auth = useAuth();
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitInfo | null>(
    null
  );
  const [isRetrying, setIsRetrying] = useState(false);

  const authWithRateLimit = useCallback(
    (operation: string) => ({
      onRateLimit: (rateLimitInfo: RateLimitInfo) => {
        setRateLimitStatus(rateLimitInfo);
        console.warn(`Rate limit detected for ${operation}:`, rateLimitInfo);
      },
      onRetry: (attempt: number, delay: number) => {
        setIsRetrying(true);
        console.info(
          `Retrying ${operation} (attempt ${attempt}) after ${delay}ms`
        );
      },
      onSuccess: () => {
        setRateLimitStatus(null);
        setIsRetrying(false);
      },
      onFailure: () => {
        setIsRetrying(false);
      },
    }),
    []
  );

  return {
    ...auth,
    rateLimitStatus,
    isRetrying,
    authWithRateLimit,
    metrics: SupabaseRateLimitHandler.getMetrics(),
    circuitBreakerState: SupabaseRateLimitHandler.getCircuitBreakerState(),
  };
};

/**
 * Get rate limit status for monitoring dashboards
 */
export const useRateLimitStatus = () => {
  const [status, setStatus] = useState(() =>
    SupabaseRateLimitHandler.getMetrics()
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(SupabaseRateLimitHandler.getMetrics());
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return status;
};

// Export for compatibility with existing code
export {
  signInWithEmail as signIn,
  signUpWithEmail as signUp,
  signInWithEmail as login,
  signUpWithEmail as register,
};

// Export rate limit utilities
export {
  SupabaseRateLimitHandler,
  withRateLimitHandling,
  bypassRateLimitInDev,
  type RateLimitInfo,
  type AuthOptions,
  type AuthError,
};
