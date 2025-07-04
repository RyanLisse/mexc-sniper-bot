"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, useContext, type ReactNode } from "react";

// Mock test user data
const mockTestUser: User = {
  id: "test-user-123",
  aud: "authenticated",
  role: "authenticated", 
  email: "ryan@ryanlisse.com",
  email_confirmed_at: new Date().toISOString(),
  phone: "",
  confirmation_sent_at: new Date().toISOString(),
  confirmed_at: new Date().toISOString(),
  last_sign_in_at: new Date().toISOString(),
  app_metadata: {},
  user_metadata: {
    full_name: "Test User",
    name: "Test User",
  },
  identities: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

type TestAuthContextType = {
  user: User | null;
  session: any;
  isLoading: boolean;
  signOut: () => Promise<any>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signInWithProvider: (provider: "google" | "github") => Promise<{ error: any }>;
};

const TestAuthContext = createContext<TestAuthContextType | undefined>(undefined);

interface TestAuthProviderProps {
  children: ReactNode;
}

export function TestAuthProvider({ children }: TestAuthProviderProps) {
  const authValue: TestAuthContextType = {
    user: mockTestUser,
    session: {
      access_token: "mock-access-token",
      refresh_token: "mock-refresh-token",
      expires_in: 3600,
      user: mockTestUser,
    },
    isLoading: false,
    signOut: async () => ({ error: null }),
    signIn: async () => ({ error: null }),
    signUp: async () => ({ error: null }),
    signInWithProvider: async () => ({ error: null }),
  };

  return (
    <TestAuthContext.Provider value={authValue}>
      {children}
    </TestAuthContext.Provider>
  );
}

export function useTestAuth() {
  const context = useContext(TestAuthContext);
  if (context === undefined) {
    throw new Error("useTestAuth must be used within a TestAuthProvider");
  }
  return context;
}

// Export as useAuth for compatibility
export const useAuth = useTestAuth;