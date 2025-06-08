"use client";

import type { ReactNode } from "react";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Just a simple provider wrapper for now
  // Better-auth handles session management automatically
  return <>{children}</>;
}
