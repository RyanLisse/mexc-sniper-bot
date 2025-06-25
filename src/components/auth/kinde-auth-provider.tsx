"use client";

import type { ReactNode } from "react";

interface KindeAuthProviderProps {
  children: ReactNode;
}

export function KindeAuthProvider({ children }: KindeAuthProviderProps) {
  // Simple fallback provider until auth is properly configured
  // This prevents client-side errors from missing Kinde configuration
  return <>{children}</>;
}
