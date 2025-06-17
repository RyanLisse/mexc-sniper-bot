import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { authTestSetup, envTestUtils, mockKindeSDK } from '../setup/auth-test-utils';

// Mock the Kinde server session at module level
const mockSession = mockKindeSDK.createSuccessfulMock();

vi.mock('@kinde-oss/kinde-auth-nextjs/server', () => ({
  getKindeServerSession: vi.fn(() => mockSession)
}));

// MSW server for API mocking
const server = setupServer();

describe('/api/health/auth Integration Tests', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    authTestSetup.beforeEach();
    server.resetHandlers();
  });

  afterEach(() => {
    authTestSetup.afterEach();
  });

  describe('Health Check API Integration', () => {
    it('should return comprehensive health data with all systems operational', async () => {
      // Setup successful external service mocks
      server.use(
        http.get('https://test.kinde.com/.well-known/jwks.json', () => {
          return HttpResponse.json({ keys: [] });
        })
      );

      const response = await fetch('http://localhost:3008/api/health/auth');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        status: 'healthy',
        message: 'Authentication system fully operational',
        auth_configured: true,
        kinde_sdk_status: 'initialized',
        version: '1.0.0',
        timestamp: expect.any(String)
      });

      // Verify configuration validation
      expect(data.configuration_validation).toEqual({
        issuer_url_format: true,
        site_url_format: true,
        client_id_format: true,
        redirect_urls_configured: true
      });

      // Verify environment variables check
      expect(data.environment_variables).toEqual({
        total_required: 6,
        configured: 6,
        missing_count: 0
      });

      // Verify deployment info
      expect(data.deployment_info).toMatchObject({
        environment: 'test',
        is_vercel: false,
        is_production: false,
        kinde_issuer_domain: 'test.kinde.com'
      });
    });

    it('should handle network connectivity issues gracefully', async () => {
      // Mock network timeout for external services
      server.use(
        http.get('https://test.kinde.com/.well-known/jwks.json', () => {
          return HttpResponse.error();
        })
      );

      // Test should still pass as our health check doesn't directly call external services
      const response = await fetch('http://localhost:3008/api/health/auth');
      expect(response.status).toBe(200);
    });

    it('should validate environment variables in different configurations', async () => {
      // Test with staging-like configuration
      envTestUtils.setupTestEnv();
      process.env.KINDE_ISSUER_URL = 'https://staging-mexcsniper.kinde.com';
      process.env.KINDE_SITE_URL = 'https://staging.mexcsniper.com';
      process.env.NODE_ENV = 'staging';

      const response = await fetch('http://localhost:3008/api/health/auth');
      const data = await response.json();

      expect(data.deployment_info).toMatchObject({
        environment: 'staging',
        kinde_issuer_domain: 'staging-mexcsniper.kinde.com'
      });
    });

    it('should handle partial configuration correctly', async () => {
      // Setup environment with missing non-critical variables
      envTestUtils.setupMissingEnv(['KINDE_POST_LOGOUT_REDIRECT_URL']);

      const response = await fetch('http://localhost:3008/api/health/auth');
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.status).toBe('error');
      expect(data.missing_env_vars).toContain('KINDE_POST_LOGOUT_REDIRECT_URL');
    });

    it('should validate URL formats correctly', async () => {
      // Test with invalid URL formats
      envTestUtils.setupTestEnv();
      process.env.KINDE_ISSUER_URL = 'not-a-valid-url';
      process.env.KINDE_SITE_URL = 'also-invalid';

      const response = await fetch('http://localhost:3008/api/health/auth');
      const data = await response.json();

      expect(data.configuration_validation.issuer_url_format).toBe(false);
      expect(data.configuration_validation.site_url_format).toBe(false);
      expect(data.status).toBe('unhealthy');
    });
  });

  describe('CORS and HTTP Methods', () => {
    it('should handle OPTIONS requests for CORS', async () => {
      const response = await fetch('http://localhost:3008/api/health/auth', {
        method: 'OPTIONS'
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Allow')).toBe('GET, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
    });

    it('should reject unsupported HTTP methods', async () => {
      const response = await fetch('http://localhost:3008/api/health/auth', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' })
      });

      expect(response.status).toBe(405);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle Kinde SDK initialization failures', async () => {
      // Mock Kinde SDK to throw during initialization
      const { getKindeServerSession } = await import('@kinde-oss/kinde-auth-nextjs/server');
      vi.mocked(getKindeServerSession).mockImplementation(() => {
        throw new Error('Kinde initialization failed');
      });

      const response = await fetch('http://localhost:3008/api/health/auth');
      const data = await response.json();

      expect(data.status).toBe('unhealthy');
      expect(data.kinde_sdk_status).toBe('error');
      expect(data.auth_test_result.error).toBe('Kinde initialization failed');
    });

    it('should handle async Kinde operations failures', async () => {
      // Mock successful initialization but failed async operations
      const { getKindeServerSession } = await import('@kinde-oss/kinde-auth-nextjs/server');
      vi.mocked(getKindeServerSession).mockReturnValue({
        ...mockKindeSDK.createFailedMock('Async operation timeout'),
        // Override isAuthenticated to throw
        isAuthenticated: vi.fn().mockRejectedValue(new Error('Async operation timeout'))
      });

      const response = await fetch('http://localhost:3008/api/health/auth');
      const data = await response.json();

      expect(data.status).toBe('unhealthy');
      expect(data.kinde_sdk_status).toBe('error');
      expect(data.auth_test_result.error).toBe('Async operation timeout');
    });

    it('should handle malformed environment variables', async () => {
      // Test with empty but defined environment variables
      envTestUtils.setupTestEnv();
      process.env.KINDE_CLIENT_ID = '';
      process.env.KINDE_ISSUER_URL = '';

      const response = await fetch('http://localhost:3008/api/health/auth');
      const data = await response.json();

      expect(data.configuration_validation.client_id_format).toBe(false);
      expect(data.configuration_validation.issuer_url_format).toBe(false);
      expect(data.status).toBe('unhealthy');
    });

    it('should provide detailed error information for debugging', async () => {
      envTestUtils.setupMissingEnv(['KINDE_CLIENT_ID', 'KINDE_CLIENT_SECRET']);

      const response = await fetch('http://localhost:3008/api/health/auth');
      const data = await response.json();

      expect(data).toHaveProperty('missing_env_vars');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('environment_variables');
      expect(data.missing_env_vars).toEqual(['KINDE_CLIENT_ID', 'KINDE_CLIENT_SECRET']);
    });
  });

  describe('Performance and Reliability', () => {
    it('should respond within acceptable time limits', async () => {
      const startTime = Date.now();
      
      const response = await fetch('http://localhost:3008/api/health/auth');
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should be idempotent across multiple calls', async () => {
      const responses = await Promise.all([
        fetch('http://localhost:3008/api/health/auth'),
        fetch('http://localhost:3008/api/health/auth'),
        fetch('http://localhost:3008/api/health/auth')
      ]);

      const dataPromises = responses.map(r => r.json());
      const allData = await Promise.all(dataPromises);

      // All responses should have the same status
      allData.forEach(data => {
        expect(data.status).toBe(allData[0].status);
        expect(data.auth_configured).toBe(allData[0].auth_configured);
        expect(data.kinde_sdk_status).toBe(allData[0].kinde_sdk_status);
      });

      // All responses should be successful
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should handle concurrent requests properly', async () => {
      // Test with 10 concurrent requests
      const concurrentRequests = Array(10).fill(null).map(() => 
        fetch('http://localhost:3008/api/health/auth')
      );

      const responses = await Promise.all(concurrentRequests);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Verify data consistency
      const allData = await Promise.all(
        responses.map(r => r.json())
      );

      allData.forEach(data => {
        expect(data).toHaveProperty('status');
        expect(data).toHaveProperty('timestamp');
        expect(data.version).toBe('1.0.0');
      });
    });
  });
});