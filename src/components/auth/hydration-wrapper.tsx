"use client";

import { useEffect, useState } from "react";

interface HydrationWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Wrapper component to prevent hydration mismatches
 * Only renders children after client-side hydration is complete
 */
export function HydrationWrapper({
  children,
  fallback = null,
}: HydrationWrapperProps) {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  if (!isHydrated) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
