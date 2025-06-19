import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET, OPTIONS } from '../../app/api/health/auth/route';
import { authTestSetup, mockKindeSDK, envTestUtils } from '../setup/auth-test-utils';

// Mock the Kinde server session at module level to prevent real network calls
vi.mock('@kinde-oss/kinde-auth-nextjs/server', () => ({
  getKindeServerSession: vi.fn()
}));

describe('/api/health/auth', () => {
  beforeEach(() => {
    // Use standardized auth test setup
    authTestSetup.beforeEach();
  });

  afterEach(() => {
    // Use standardized auth test cleanup
    authTestSetup.afterEach();
  });

  describe('GET /api/health/auth', () => {
    it('should return healthy status with all environment variables configured', async () => {
      // Mock successful Kinde SDK using standardized mock
      const { getKindeServerSession } = await import('@kinde-oss/kinde-auth-nextjs/server');
      vi.mocked(getKindeServerSession).mockReturnValue(mockKindeSDK.createSuccessfulMock());

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        status: 'healthy',
        message: 'Authentication system fully operational',
        auth_configured: true,
        kinde_sdk_status: 'initialized',
        timestamp: expect.any(String),
        version: '1.0.0'
      });

      expect(data.configuration_validation).toEqual({
        issuer_url_format: true,
        site_url_format: true,
        client_id_format: true,
        redirect_urls_configured: true
      });

      expect(data.auth_test_result).toEqual({
        sdk_accessible: true,
        session_check_working: true,
        auth_status: false
      });

      expect(data.environment_variables).toEqual({
        total_required: 6,
        configured: 6,
        missing_count: 0
      });
    });

    it('should return error status when required environment variables are missing', async () => {
      // Use standardized environment setup for missing variables
      envTestUtils.setupMissingEnv(['KINDE_CLIENT_ID', 'KINDE_CLIENT_SECRET']);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toMatchObject({
        status: 'error',
        error: 'Missing required environment variables',
        missing_env_vars: ['KINDE_CLIENT_ID', 'KINDE_CLIENT_SECRET'],
        timestamp: expect.any(String)
      });
    });

    it('should return unhealthy status when Kinde SDK throws error', async () => {
      // Mock console.error to suppress expected error messages during test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock Kinde SDK to throw error during initialization
      const { getKindeServerSession } = await import('@kinde-oss/kinde-auth-nextjs/server');
      vi.mocked(getKindeServerSession).mockImplementation(() => {
        throw new Error('Kinde SDK connection failed');
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('unhealthy');
      expect(data.message).toBe('Authentication system has critical issues');
      expect(data.kinde_sdk_status).toBe('error');
      expect(data.auth_test_result).toEqual({
        sdk_accessible: false,
        error: 'Kinde SDK connection failed'
      });
      
      // Restore console.error
      consoleSpy.mockRestore();
    });

    it('should validate configuration format correctly', async () => {
      // Setup test environment first, then override specific values with invalid formats
      envTestUtils.setupTestEnv();
      process.env.KINDE_ISSUER_URL = 'invalid-url';
      process.env.KINDE_SITE_URL = 'also-invalid';
      process.env.KINDE_CLIENT_ID = '';
      process.env.KINDE_CLIENT_SECRET = 'invalid-secret';
      process.env.KINDE_POST_LOGOUT_REDIRECT_URL = 'http://localhost:3008';
      process.env.KINDE_POST_LOGIN_REDIRECT_URL = 'http://localhost:3008/dashboard';

      // Mock successful SDK (to isolate config validation)
      const { getKindeServerSession } = await import('@kinde-oss/kinde-auth-nextjs/server');
      vi.mocked(getKindeServerSession).mockReturnValue(mockKindeSDK.createSuccessfulMock());

      const response = await GET();
      const data = await response.json();

      expect(data.status).toBe('unhealthy');
      expect(data.auth_configured).toBe(false);
      expect(data.configuration_validation).toEqual({
        issuer_url_format: false,
        site_url_format: false,
        client_id_format: false,
        redirect_urls_configured: true
      });
    });

    it('should include deployment information', async () => {
      // Setup test environment and override specific deployment settings
      envTestUtils.setupTestEnv();
      process.env.NODE_ENV = 'production';
      process.env.VERCEL = '1';

      // Mock successful SDK with authenticated user
      const { getKindeServerSession } = await import('@kinde-oss/kinde-auth-nextjs/server');
      const authenticatedMock = mockKindeSDK.createSuccessfulMock();
      // Override specific methods to simulate authenticated state
      authenticatedMock.isAuthenticated.mockResolvedValue(true);
      authenticatedMock.getUser.mockResolvedValue({ id: 'test-user' });
      authenticatedMock.getAccessToken.mockResolvedValue('mock-token');
      authenticatedMock.refreshTokens.mockResolvedValue({ access_token: 'new-token' });
      
      vi.mocked(getKindeServerSession).mockReturnValue(authenticatedMock);

      const response = await GET();
      const data = await response.json();

      expect(data.deployment_info).toEqual({
        environment: 'production',
        is_vercel: true,
        is_production: true,
        kinde_issuer_domain: 'test.kinde.com'
      });

      expect(data.auth_test_result).toEqual({
        sdk_accessible: true,
        session_check_working: true,
        auth_status: true
      });
    });

    it('should handle unexpected errors gracefully', async () => {
      // Mock console.error to suppress expected error messages during test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock Kinde SDK to fail during async operations (not initialization)
      const { getKindeServerSession } = await import('@kinde-oss/kinde-auth-nextjs/server');
      vi.mocked(getKindeServerSession).mockReturnValue(mockKindeSDK.createFailedMock('Network timeout'));

      const response = await GET();
      const data = await response.json();

      expect(data.status).toBe('unhealthy');
      expect(data.kinde_sdk_status).toBe('error');
      expect(data.auth_test_result.error).toBe('Network timeout');
      
      // Restore console.error
      consoleSpy.mockRestore();
    });

    it('should ensure no real network connections are attempted', async () => {
      // This test verifies that all Kinde SDK calls are properly mocked
      const { getKindeServerSession } = await import('@kinde-oss/kinde-auth-nextjs/server');
      const mockSession = mockKindeSDK.createSuccessfulMock();
      vi.mocked(getKindeServerSession).mockReturnValue(mockSession);
      
      const response = await GET();
      const data = await response.json();

      // Verify the mock was called
      expect(vi.mocked(getKindeServerSession)).toHaveBeenCalled();
      expect(mockSession.isAuthenticated).toHaveBeenCalled();
      
      // Verify successful response (indicates mocks worked)
      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.kinde_sdk_status).toBe('initialized');
      
      // Verify fetch was not called with real Kinde URLs (would indicate network attempt)
      const fetchCalls = vi.mocked(global.fetch).mock.calls;
      const kindeNetworkCalls = fetchCalls.filter(call => {
        const url = typeof call[0] === 'string' ? call[0] : call[0]?.toString() || '';
        return url.includes('kinde.com') && !url.includes('localhost');
      });
      expect(kindeNetworkCalls).toHaveLength(0);
    });
  });

  describe('OPTIONS /api/health/auth', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await OPTIONS();

      expect(response.status).toBe(200);
      expect(response.headers.get('Allow')).toBe('GET, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
    });
  });
});