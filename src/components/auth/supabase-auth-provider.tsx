"use client";

import type { AuthError, Session, User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { getSupabaseBrowserClient } from "@/src/lib/supabase-browser-client";

type SupabaseAuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<AuthError | null>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signInWithProvider: (
    provider: "google" | "github"
  ) => Promise<{ error: any }>;
};

const SupabaseAuthContext = createContext<SupabaseAuthContextType | undefined>(
  undefined
);

interface SupabaseAuthProviderProps {
  children: ReactNode;
}

export function SupabaseAuthProvider({ children }: SupabaseAuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    const getSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      } catch (error) {
        console.error("Error getting session:", error);
        setIsLoading(false);
      }
    };

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);

      if (event === "SIGNED_IN") {
        // Sync user with database when they sign in
        if (session?.user) {
          try {
            await fetch("/api/auth/supabase-session", {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
            });
          } catch (error) {
            console.warn("Failed to sync user with database:", error);
          }
        }
        router.refresh();
      } else if (event === "SIGNED_OUT") {
        router.push("/auth");
        router.refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return new Error("Supabase client not available (SSR environment)");
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out:", error);
    }
    return error;
  };

  const signIn = async (email: string, password: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return {
        error: new Error("Supabase client not available (SSR environment)"),
      };
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return {
        error: new Error("Supabase client not available (SSR environment)"),
      };
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback`
            : "/auth/callback",
      },
    });
    return { error };
  };

  const signInWithProvider = async (provider: "google" | "github") => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return {
        error: new Error("Supabase client not available (SSR environment)"),
      };
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback`
            : "/auth/callback",
      },
    });
    return { error };
  };

  const value = {
    user,
    session,
    isLoading,
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
    throw new Error(
      "useSupabaseAuth must be used within a SupabaseAuthProvider"
    );
  }
  return context;
}

// Alias for backward compatibility
export const useAuth = useSupabaseAuth;
