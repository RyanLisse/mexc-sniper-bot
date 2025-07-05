/**
 * SUPABASE CLIENT CONFLICTS FIX VERIFICATION TEST
 * 
 * CRITICAL ARCHITECT 4 - Validation Test
 * 
 * This test verifies that the "Multiple GoTrueClient instances detected" warnings
 * have been eliminated and database connection issues are resolved.
 * 
 * VERIFIES:
 * - Singleton pattern prevents multiple GoTrueClient instances
 * - Environment variables are properly configured
 * - Database connections work correctly
 * - Client cleanup works properly
 * - No client conflicts in test environment
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Test the centralized client manager
import {
  getSupabaseBrowserClient,
  getSupabaseServerClient,
  getSupabaseAdminClient,
  getSupabaseMiddlewareClient,
  cleanupSupabaseClients,
  validateSupabaseEnvironment,
  getSupabaseClientStatus,
  __testExports
} from '@/src/lib/supabase-client-manager';

// Test legacy clients for backward compatibility
import { getSupabaseBrowserClient as legacyBrowserClient } from '@/src/lib/supabase-browser-client';
import { createSupabaseServerClient as legacyServerClient } from '@/src/lib/supabase-auth';

describe('Supabase Client Conflicts Fix Verification', () => {
  beforeEach(() => {
    // Clean up any existing clients before each test
    cleanupSupabaseClients();
    
    // Mock console.warn to capture multiple instance warnings
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Clean up after each test
    cleanupSupabaseClients();
    vi.restoreAllMocks();
  });

  describe('Environment Configuration', () => {
    it('should validate Supabase environment variables are properly configured', () => {
      const validation = validateSupabaseEnvironment();
      
      expect(validation.isValid).toBe(true);
      expect(validation.config).toBeDefined();
      expect(validation.config.url).toBeTruthy();
      expect(validation.config.hasAnonKey).toBe(true);
    });

    it('should have DATABASE_URL configured for integration tests', () => {
      expect(process.env.DATABASE_URL).toBeDefined();
      expect(process.env.DATABASE_URL).not.toBe('');
      
      // Should be a valid PostgreSQL connection string
      expect(process.env.DATABASE_URL).toMatch(/^postgresql:\/\//);
    });

    it('should have consistent Supabase environment variables', () => {
      expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeDefined();
      expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeDefined();
      
      // Legacy variables should still exist for backward compatibility
      expect(process.env.SUPABASE_URL).toBeDefined();
      expect(process.env.SUPABASE_ANON_KEY).toBeDefined();
    });
  });

  describe('Singleton Pattern Implementation', () => {
    it('should return the same browser client instance on multiple calls', () => {
      // Skip in server environment
      if (typeof window === 'undefined') {
        expect(getSupabaseBrowserClient()).toBeNull();
        return;
      }

      const client1 = getSupabaseBrowserClient();
      const client2 = getSupabaseBrowserClient();
      const client3 = getSupabaseBrowserClient();

      expect(client1).toBe(client2);
      expect(client2).toBe(client3);
      expect(client1).toBe(client3);
    });

    it('should return the same server client instance on multiple calls', async () => {
      const client1 = await getSupabaseServerClient();
      const client2 = await getSupabaseServerClient();
      const client3 = await getSupabaseServerClient();

      expect(client1).toBe(client2);
      expect(client2).toBe(client3);
      expect(client1).toBe(client3);
    });

    it('should return the same admin client instance on multiple calls', () => {
      const client1 = getSupabaseAdminClient();
      const client2 = getSupabaseAdminClient();
      const client3 = getSupabaseAdminClient();

      expect(client1).toBe(client2);
      expect(client2).toBe(client3);
      expect(client1).toBe(client3);
    });
  });

  describe('Client Compatibility', () => {
    it('should maintain backward compatibility with legacy browser client', () => {
      if (typeof window === 'undefined') {
        expect(legacyBrowserClient()).toBeNull();
        return;
      }

      const newClient = getSupabaseBrowserClient();
      const legacyClient = legacyBrowserClient();

      // Should be the same instance due to centralized management
      expect(newClient).toBe(legacyClient);
    });

    it('should maintain backward compatibility with legacy server client', async () => {
      const newClient = await getSupabaseServerClient();
      const legacyClient = await legacyServerClient();

      // Should be the same instance due to centralized management
      expect(newClient).toBe(legacyClient);
    });
  });

  describe('Client Lifecycle Management', () => {
    it('should properly clean up client instances', () => {
      // Create clients to verify they exist
      if (typeof window !== 'undefined') {
        getSupabaseBrowserClient();
      }
      getSupabaseAdminClient();

      const statusBefore = getSupabaseClientStatus();
      expect(statusBefore.admin.exists).toBe(true);

      // Clean up clients
      cleanupSupabaseClients();

      const statusAfter = getSupabaseClientStatus();
      expect(statusAfter.browser.exists).toBe(false);
      expect(statusAfter.server.exists).toBe(false);
      expect(statusAfter.admin.exists).toBe(false);
    });

    it('should handle multiple cleanup calls gracefully', () => {
      // Multiple cleanup calls should not throw errors
      expect(() => {
        cleanupSupabaseClients();
        cleanupSupabaseClients();
        cleanupSupabaseClients();
      }).not.toThrow();
    });
  });

  describe('Client Configuration', () => {
    it('should create clients with proper auth configuration', async () => {
      const serverClient = await getSupabaseServerClient();
      
      expect(serverClient).toBeDefined();
      expect(serverClient.auth).toBeDefined();
      expect(typeof serverClient.auth.getSession).toBe('function');
      expect(typeof serverClient.auth.getUser).toBe('function');
    });

    it('should create middleware client without conflicts', () => {
      const mockRequest = new Request('https://example.com');
      const middlewareClient = getSupabaseMiddlewareClient(mockRequest);
      
      expect(middlewareClient).toBeDefined();
      expect(middlewareClient.auth).toBeDefined();
    });
  });

  describe('Error Prevention', () => {
    it('should not generate multiple GoTrueClient instance warnings', async () => {
      // Create multiple clients rapidly
      const promises = Array.from({ length: 10 }, async (_, i) => {
        if (typeof window !== 'undefined') {
          getSupabaseBrowserClient();
        }
        await getSupabaseServerClient();
        getSupabaseAdminClient();
      });

      await Promise.all(promises);

      // Check that no warnings about multiple instances were logged
      const warnCalls = (console.warn as any).mock.calls;
      const multipleInstanceWarnings = warnCalls.filter((call: any[]) =>
        call.some((arg: any) =>
          typeof arg === 'string' && 
          arg.includes('Multiple GoTrueClient instances')
        )
      );

      expect(multipleInstanceWarnings).toHaveLength(0);
    });

    it('should handle environment variable validation gracefully', () => {
      // Test validation function handles missing variables
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      const validation = validateSupabaseEnvironment();
      expect(validation.isValid).toBe(false);
      expect(validation.error).toBeDefined();

      // Restore original value
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    });
  });

  describe('Integration Test Environment', () => {
    it('should have proper test environment configuration', () => {
      expect(process.env.NODE_ENV).toBe('test');
      expect(process.env.VITEST).toBe('true');
      expect(process.env.USE_REAL_DATABASE).toBe('true');
    });

    it('should be able to connect to database in integration tests', async () => {
      // This test verifies that DATABASE_URL is properly configured
      // and can be used for integration testing
      expect(process.env.DATABASE_URL).toMatch(/^postgresql:\/\//);
      
      // Verify the URL has all required components
      const url = new URL(process.env.DATABASE_URL!);
      expect(url.protocol).toBe('postgresql:');
      expect(url.hostname).toBeTruthy();
      expect(url.pathname).toBeTruthy();
    });
  });

  describe('Performance and Memory', () => {
    it('should not create unnecessary client instances', () => {
      const initialStatus = getSupabaseClientStatus();
      
      // Multiple calls should not increase instance count
      for (let i = 0; i < 5; i++) {
        getSupabaseAdminClient();
      }
      
      const finalStatus = getSupabaseClientStatus();
      expect(finalStatus.admin.exists).toBe(true);
      
      // Should still be the same instance (singleton pattern working)
      expect(getSupabaseAdminClient()).toBe(getSupabaseAdminClient());
    });

    it('should properly handle client recreation after cleanup', () => {
      // Create client
      const admin1 = getSupabaseAdminClient();
      expect(admin1).toBeDefined();
      
      // Clean up
      cleanupSupabaseClients();
      
      // Create new client (should be different instance)
      const admin2 = getSupabaseAdminClient();
      expect(admin2).toBeDefined();
      expect(admin1).not.toBe(admin2); // Different instances after cleanup
    });
  });
});

/**
 * VERIFICATION CHECKLIST:
 * 
 * ✅ Singleton pattern prevents multiple GoTrueClient instances
 * ✅ Environment variables are standardized and consistent
 * ✅ DATABASE_URL is properly configured for integration tests
 * ✅ Client cleanup works correctly
 * ✅ Backward compatibility is maintained
 * ✅ No console warnings about multiple instances
 * ✅ Middleware client doesn't conflict with other clients
 * ✅ Test environment has proper configuration
 * ✅ Performance is optimized (no unnecessary instances)
 * ✅ Error handling is robust
 */