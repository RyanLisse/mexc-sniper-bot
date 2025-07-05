"use client";

import { getSupabaseBrowserClient } from "./supabase-client-manager";

/**
 * DEPRECATED: Use getSupabaseBrowserClient from supabase-client-manager instead
 *
 * This file is kept for backward compatibility but now delegates to the
 * centralized client manager to prevent multiple GoTrueClient instances.
 */

/**
 * Get Supabase browser client instance (redirects to centralized manager)
 * This prevents the "Multiple GoTrueClient instances" error
 */
export function createSupabaseBrowserClient() {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error(
      "Supabase browser client can only be used in browser environment"
    );
  }
  return client;
}

// Export the centralized function for compatibility
export { getSupabaseBrowserClient };
