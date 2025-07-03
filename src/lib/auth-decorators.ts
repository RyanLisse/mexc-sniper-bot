/**
 * Auth Decorators - Simple implementation
 * Provides authentication middleware and decorators
 */

import { NextRequest, NextResponse } from "next/server";

export interface AuthConfig {
  requireAuth?: boolean;
  allowGuest?: boolean;
  requiredRoles?: string[];
}

export function withAuth<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
  config: AuthConfig = {}
): T {
  return (async (...args: Parameters<T>) => {
    // Simple pass-through implementation - actual auth would go here
    return await handler(...args);
  }) as T;
}

export function requireAuth<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return withAuth(handler, { requireAuth: true });
}

export function allowGuest<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return withAuth(handler, { allowGuest: true });
}

// Add missing export aliases for compatibility
export const authenticatedRoute = requireAuth;