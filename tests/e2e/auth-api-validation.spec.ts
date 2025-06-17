/**
 * E2E API Authentication Validation Tests
 * 
 * Tests for API endpoint authentication and authorization without browser UI.
 * Focused on API-level authentication validation for deployment verification.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3008';
const TEST_ENVIRONMENT = process.env.TEST_ENVIRONMENT || 'test';

test.describe('API Authentication Validation', () => {
  test.describe('Health Check Endpoints', () => {
    test('should have accessible auth health endpoint', async ({ request }) => {
      const response = await request.get('/api/health/auth');
      
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('auth_configured');
      expect(data).toHaveProperty('kinde_sdk_status');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('version');
      
      // Auth should be configured
      expect(data.auth_configured).toBe(true);
      expect(['healthy', 'warning', 'unhealthy']).toContain(data.status);
    });

    test('should validate environment configuration in health check', async ({ request }) => {
      const response = await request.get('/api/health/auth');
      const data = await response.json();
      
      expect(data.deployment_info?.environment).toBe(TEST_ENVIRONMENT);
      
      if (data.configuration_validation) {
        expect(data.configuration_validation).toHaveProperty('issuer_url_format');
        expect(data.configuration_validation).toHaveProperty('site_url_format');
        expect(data.configuration_validation).toHaveProperty('client_id_format');
      }
    });

    test('should return comprehensive configuration status', async ({ request }) => {
      const response = await request.get('/api/health/auth');
      const data = await response.json();
      
      // Should include environment variables check
      expect(data.environment_variables).toHaveProperty('total_required');
      expect(data.environment_variables).toHaveProperty('configured');
      expect(data.environment_variables).toHaveProperty('missing_count');
      
      // Should include deployment info
      expect(data.deployment_info).toHaveProperty('environment');
      expect(data.deployment_info).toHaveProperty('kinde_issuer_domain');
    });

    test('should handle concurrent health check requests', async ({ request }) => {
      const requests = Array(5).fill(null).map(() => 
        request.get('/api/health/auth')
      );
      
      const responses = await Promise.all(requests);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status()).toBe(200);
      });
      
      // All should return consistent data
      const dataPromises = responses.map(r => r.json());
      const allData = await Promise.all(dataPromises);
      
      const firstResponse = allData[0];
      allData.forEach(data => {
        expect(data.status).toBe(firstResponse.status);
        expect(data.auth_configured).toBe(firstResponse.auth_configured);
        expect(data.kinde_sdk_status).toBe(firstResponse.kinde_sdk_status);
      });
    });
  });

  test.describe('CORS and HTTP Methods', () => {
    test('should handle CORS preflight requests', async ({ request }) => {
      const response = await request.fetch('/api/health/auth', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'GET'
        }
      });
      
      expect(response.status()).toBe(200);
      
      const headers = response.headers();
      expect(headers['access-control-allow-origin']).toBeDefined();
      expect(headers['access-control-allow-methods']).toBeDefined();
    });

    test('should reject unsupported HTTP methods on auth endpoints', async ({ request }) => {
      const unsupportedMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
      
      for (const method of unsupportedMethods) {
        const response = await request.fetch('/api/health/auth', {
          method,
          headers: { 'Content-Type': 'application/json' },
          data: { test: 'data' }
        });
        
        expect(response.status()).toBe(405);
      }
    });

    test('should set appropriate response headers', async ({ request }) => {
      const response = await request.get('/api/health/auth');
      
      const headers = response.headers();
      expect(headers['content-type']).toContain('application/json');
      
      // Check for security headers in production
      if (TEST_ENVIRONMENT === 'production') {
        expect(headers['x-frame-options']).toBeDefined();
        expect(headers['x-content-type-options']).toBeDefined();
      }
    });
  });

  test.describe('Authentication API Endpoints', () => {
    test('should handle session endpoint appropriately', async ({ request }) => {
      const response = await request.get('/api/auth/session');
      
      // Should either return session data or redirect to auth
      const status = response.status();
      const isValidResponse = status === 200 || status === 401 || status === 403 || status === 302;
      
      expect(isValidResponse).toBe(true);
    });

    test('should handle login endpoint', async ({ request }) => {
      const response = await request.get('/api/auth/login');
      
      // Should redirect to Kinde or handle appropriately
      const status = response.status();
      const isValidResponse = status === 302 || status === 200 || status === 307;
      
      expect(isValidResponse).toBe(true);
    });

    test('should handle logout endpoint', async ({ request }) => {
      const response = await request.get('/api/auth/logout');
      
      // Should redirect appropriately
      const status = response.status();
      const isValidResponse = status === 302 || status === 200 || status === 307;
      
      expect(isValidResponse).toBe(true);
    });

    test('should protect callback endpoint from invalid requests', async ({ request }) => {
      // Test callback with missing parameters
      const response = await request.get('/api/auth/kinde_callback');
      
      // Should handle gracefully (not crash)
      const status = response.status();
      expect(status).toBeLessThan(500); // Should not be server error
    });
  });

  test.describe('Error Handling', () => {
    test('should handle malformed requests gracefully', async ({ request }) => {
      const response = await request.fetch('/api/health/auth', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'malformed-accept-header'
        }
      });
      
      // Should still work despite malformed headers
      expect(response.status()).toBe(200);
    });

    test('should handle requests with invalid authentication headers', async ({ request }) => {
      const response = await request.get('/api/auth/session', {
        headers: {
          'Authorization': 'Bearer invalid-token-12345',
          'X-Forwarded-For': '192.168.1.1'
        }
      });
      
      // Should handle invalid auth gracefully
      const status = response.status();
      expect(status).toBeLessThan(500);
    });

    test('should validate and sanitize query parameters', async ({ request }) => {
      const maliciousParams = [
        '?error=<script>alert("xss")</script>',
        '?code="; DROP TABLE users; --',
        '?state=' + 'A'.repeat(10000), // Very long parameter
      ];

      for (const params of maliciousParams) {
        const response = await request.get(`/api/auth/kinde_callback${params}`);
        
        // Should not crash with 500 error
        expect(response.status()).toBeLessThan(500);
      }
    });
  });

  test.describe('Performance and Reliability', () => {
    test('should respond to health checks within acceptable time', async ({ request }) => {
      const startTime = Date.now();
      
      const response = await request.get('/api/health/auth');
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(response.status()).toBe(200);
      expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
    });

    test('should handle high concurrency on auth endpoints', async ({ request }) => {
      // Create 20 concurrent requests
      const concurrentRequests = Array(20).fill(null).map(() => 
        request.get('/api/health/auth')
      );
      
      const responses = await Promise.all(concurrentRequests);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status()).toBe(200);
      });
      
      // No responses should take too long
      const startTime = Date.now();
      await Promise.all(responses.map(r => r.json()));
      const totalTime = Date.now() - startTime;
      
      expect(totalTime).toBeLessThan(5000); // All responses within 5 seconds
    });

    test('should be consistent across multiple rapid requests', async ({ request }) => {
      // Make 10 rapid sequential requests
      const responses = [];
      
      for (let i = 0; i < 10; i++) {
        const response = await request.get('/api/health/auth');
        responses.push(await response.json());
      }
      
      // All should have consistent status
      const firstStatus = responses[0].status;
      responses.forEach(data => {
        expect(data.status).toBe(firstStatus);
        expect(data.auth_configured).toBe(responses[0].auth_configured);
      });
    });
  });

  test.describe('Environment-Specific API Tests', () => {
    test('should validate staging API configuration', async ({ request }) => {
      test.skip(TEST_ENVIRONMENT !== 'staging', 'Staging-specific test');
      
      const response = await request.get('/api/health/auth');
      const data = await response.json();
      
      expect(data.deployment_info.environment).toBe('staging');
      expect(data.deployment_info.kinde_issuer_domain).toContain('staging');
    });

    test('should validate production API security', async ({ request }) => {
      test.skip(TEST_ENVIRONMENT !== 'production', 'Production-specific test');
      
      const response = await request.get('/api/health/auth');
      
      // Production should have security headers
      const headers = response.headers();
      expect(headers['strict-transport-security']).toBeDefined();
      expect(headers['x-frame-options']).toBeDefined();
    });

    test('should validate test environment isolation', async ({ request }) => {
      test.skip(TEST_ENVIRONMENT !== 'test', 'Test environment-specific test');
      
      const response = await request.get('/api/health/auth');
      const data = await response.json();
      
      expect(data.deployment_info.environment).toBe('test');
      expect(data.deployment_info.kinde_issuer_domain).toContain('test');
    });
  });
});