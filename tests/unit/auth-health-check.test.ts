import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET, OPTIONS } from '@/app/api/health/auth/route';

// Mock the Kinde server session
vi.mock('@kinde-oss/kinde-auth-nextjs/server', () => ({
  getKindeServerSession: vi.fn()
}));

describe('/api/health/auth', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables to a clean state
    process.env = {
      ...originalEnv,
      KINDE_CLIENT_ID: 'test-client-id',
      KINDE_CLIENT_SECRET: 'test-client-secret',
      KINDE_ISSUER_URL: 'https://test.kinde.com',
      KINDE_SITE_URL: 'http://localhost:3008',
      KINDE_POST_LOGOUT_REDIRECT_URL: 'http://localhost:3008',
      KINDE_POST_LOGIN_REDIRECT_URL: 'http://localhost:3008/dashboard',
      NODE_ENV: 'test'
    };

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('GET /api/health/auth', () => {
    it('should return healthy status with all environment variables configured', async () => {
      // Mock successful Kinde SDK
      const { getKindeServerSession } = await import('@kinde-oss/kinde-auth-nextjs/server');
      vi.mocked(getKindeServerSession).mockReturnValue({
        isAuthenticated: vi.fn().mockResolvedValue(false),
        getUser: vi.fn().mockResolvedValue(null),
        getPermissions: vi.fn().mockResolvedValue({ permissions: [] }),
        getPermission: vi.fn().mockResolvedValue({ isGranted: false }),
        getOrganization: vi.fn().mockResolvedValue(null),
        getUserOrganizations: vi.fn().mockResolvedValue({ orgCodes: [] }),
        getClaim: vi.fn().mockResolvedValue({ name: 'test', value: null }),
        getAccessToken: vi.fn().mockResolvedValue(null),
        refreshTokens: vi.fn().mockRejectedValue(new Error('Not authenticated')),
        getBooleanFlag: vi.fn().mockResolvedValue({ value: false, isDefault: true }),
        getFlag: vi.fn().mockResolvedValue({ value: null, isDefault: true }),
        getIdToken: vi.fn().mockResolvedValue(null),
        getIdTokenRaw: vi.fn().mockResolvedValue(null),
        getStringFlag: vi.fn().mockResolvedValue({ value: '', isDefault: true }),
        getIntegerFlag: vi.fn().mockResolvedValue({ value: 0, isDefault: true }),
        logout: vi.fn().mockResolvedValue(null),
        createOrg: vi.fn().mockResolvedValue(null)
      });

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
      // Remove required environment variables
      delete process.env.KINDE_CLIENT_ID;
      delete process.env.KINDE_CLIENT_SECRET;

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
      // Mock Kinde SDK to throw error
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
    });

    it('should validate configuration format correctly', async () => {
      // Set invalid configuration formats for all required variables
      process.env.KINDE_ISSUER_URL = 'invalid-url';
      process.env.KINDE_SITE_URL = 'also-invalid';
      process.env.KINDE_CLIENT_ID = '';
      process.env.KINDE_CLIENT_SECRET = 'invalid-secret';
      process.env.KINDE_POST_LOGOUT_REDIRECT_URL = 'http://localhost:3008';
      process.env.KINDE_POST_LOGIN_REDIRECT_URL = 'http://localhost:3008/dashboard';

      // Mock successful SDK (to isolate config validation)
      const { getKindeServerSession } = await import('@kinde-oss/kinde-auth-nextjs/server');
      vi.mocked(getKindeServerSession).mockReturnValue({
        isAuthenticated: vi.fn().mockResolvedValue(false),
        getUser: vi.fn().mockResolvedValue(null),
        getPermissions: vi.fn().mockResolvedValue({ permissions: [] }),
        getPermission: vi.fn().mockResolvedValue({ isGranted: false }),
        getOrganization: vi.fn().mockResolvedValue(null),
        getUserOrganizations: vi.fn().mockResolvedValue({ orgCodes: [] }),
        getClaim: vi.fn().mockResolvedValue({ name: 'test', value: null }),
        getAccessToken: vi.fn().mockResolvedValue(null),
        refreshTokens: vi.fn().mockRejectedValue(new Error('Not authenticated')),
        getBooleanFlag: vi.fn().mockResolvedValue({ value: false, isDefault: true }),
        getFlag: vi.fn().mockResolvedValue({ value: null, isDefault: true }),
        getIdToken: vi.fn().mockResolvedValue(null),
        getIdTokenRaw: vi.fn().mockResolvedValue(null),
        getStringFlag: vi.fn().mockResolvedValue({ value: '', isDefault: true }),
        getIntegerFlag: vi.fn().mockResolvedValue({ value: 0, isDefault: true }),
        logout: vi.fn().mockResolvedValue(null),
        createOrg: vi.fn().mockResolvedValue(null)
      });

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
      process.env.NODE_ENV = 'production';
      process.env.VERCEL = '1';

      // Mock successful SDK
      const { getKindeServerSession } = await import('@kinde-oss/kinde-auth-nextjs/server');
      vi.mocked(getKindeServerSession).mockReturnValue({
        isAuthenticated: vi.fn().mockResolvedValue(true),
        getUser: vi.fn().mockResolvedValue({ id: 'test-user' }),
        getPermissions: vi.fn().mockResolvedValue({ permissions: [] }),
        getPermission: vi.fn().mockResolvedValue({ isGranted: false }),
        getOrganization: vi.fn().mockResolvedValue(null),
        getUserOrganizations: vi.fn().mockResolvedValue({ orgCodes: [] }),
        getClaim: vi.fn().mockResolvedValue({ name: 'test', value: null }),
        getAccessToken: vi.fn().mockResolvedValue('mock-token'),
        refreshTokens: vi.fn().mockResolvedValue({ access_token: 'new-token' }),
        getBooleanFlag: vi.fn().mockResolvedValue({ value: false, isDefault: true }),
        getFlag: vi.fn().mockResolvedValue({ value: null, isDefault: true }),
        getIdToken: vi.fn().mockResolvedValue(null),
        getIdTokenRaw: vi.fn().mockResolvedValue(null),
        getStringFlag: vi.fn().mockResolvedValue({ value: '', isDefault: true }),
        getIntegerFlag: vi.fn().mockResolvedValue({ value: 0, isDefault: true }),
        logout: vi.fn().mockResolvedValue(null),
        createOrg: vi.fn().mockResolvedValue(null)
      });

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
      // Mock getKindeServerSession to throw during call
      const { getKindeServerSession } = await import('@kinde-oss/kinde-auth-nextjs/server');
      vi.mocked(getKindeServerSession).mockReturnValue({
        isAuthenticated: vi.fn().mockRejectedValue(new Error('Network timeout')),
        getUser: vi.fn().mockResolvedValue(null),
        getPermissions: vi.fn().mockResolvedValue({ permissions: [] }),
        getPermission: vi.fn().mockResolvedValue({ isGranted: false }),
        getOrganization: vi.fn().mockResolvedValue(null),
        getUserOrganizations: vi.fn().mockResolvedValue({ orgCodes: [] }),
        getClaim: vi.fn().mockResolvedValue({ name: 'test', value: null }),
        getAccessToken: vi.fn().mockResolvedValue(null),
        refreshTokens: vi.fn().mockRejectedValue(new Error('Not authenticated')),
        getBooleanFlag: vi.fn().mockResolvedValue({ value: false, isDefault: true }),
        getFlag: vi.fn().mockResolvedValue({ value: null, isDefault: true }),
        getIdToken: vi.fn().mockResolvedValue(null),
        getIdTokenRaw: vi.fn().mockResolvedValue(null),
        getStringFlag: vi.fn().mockResolvedValue({ value: '', isDefault: true }),
        getIntegerFlag: vi.fn().mockResolvedValue({ value: 0, isDefault: true }),
        logout: vi.fn().mockResolvedValue(null),
        createOrg: vi.fn().mockResolvedValue(null)
      });

      const response = await GET();
      const data = await response.json();

      expect(data.status).toBe('unhealthy');
      expect(data.kinde_sdk_status).toBe('error');
      expect(data.auth_test_result.error).toBe('Network timeout');
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