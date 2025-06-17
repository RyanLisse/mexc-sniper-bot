import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { 
  AuthEnvironmentManager, 
  authEnvironments, 
  testUserTemplates,
  authEnvManager,
  authEnvironmentSetup,
  authScenarios,
  environmentAwareUtils
} from '../setup/auth-environment-manager';

describe('Authentication Environment Management', () => {
  let envManager: AuthEnvironmentManager;

  beforeEach(() => {
    envManager = new AuthEnvironmentManager();
  });

  afterEach(async () => {
    await envManager.cleanupAllTestUsers();
    envManager.reset();
  });

  describe('Environment Switching', () => {
    it('should switch to different environments correctly', () => {
      // Start in test environment (default)
      expect(envManager.getCurrentEnvironment().name).toBe('test');

      // Switch to staging
      envManager.switchEnvironment('staging');
      expect(envManager.getCurrentEnvironment().name).toBe('staging');
      expect(process.env.KINDE_ISSUER_URL).toBe(authEnvironments.staging.kindeIssuerUrl);
      expect(process.env.KINDE_SITE_URL).toBe(authEnvironments.staging.kindeSiteUrl);

      // Switch to production
      envManager.switchEnvironment('production');
      expect(envManager.getCurrentEnvironment().name).toBe('production');
      expect(process.env.KINDE_ISSUER_URL).toBe(authEnvironments.production.kindeIssuerUrl);
    });

    it('should maintain environment history for rollback', () => {
      // Start fresh to ensure predictable history
      envManager.reset();
      
      envManager.switchEnvironment('staging');
      envManager.switchEnvironment('production');
      envManager.switchEnvironment('e2e');

      // Rollback should go to production
      envManager.rollbackEnvironment();
      expect(envManager.getCurrentEnvironment().name).toBe('production');

      // Another rollback should go to staging
      envManager.rollbackEnvironment();
      expect(envManager.getCurrentEnvironment().name).toBe('staging');

      // Another rollback should go to test (original)
      envManager.rollbackEnvironment();
      expect(envManager.getCurrentEnvironment().name).toBe('test');
    });

    it('should throw error for unknown environment', () => {
      expect(() => {
        envManager.switchEnvironment('unknown' as any);
      }).toThrow('Unknown environment: unknown');
    });

    it('should set all required environment variables', () => {
      envManager.switchEnvironment('staging');

      expect(process.env.KINDE_ISSUER_URL).toBe(authEnvironments.staging.kindeIssuerUrl);
      expect(process.env.KINDE_SITE_URL).toBe(authEnvironments.staging.kindeSiteUrl);
      expect(process.env.KINDE_CLIENT_ID).toBe(authEnvironments.staging.kindeClientId);
      expect(process.env.KINDE_CLIENT_SECRET).toBe(authEnvironments.staging.kindeClientSecret);
      expect(process.env.KINDE_POST_LOGIN_REDIRECT_URL).toBe(`${authEnvironments.staging.kindeSiteUrl}/dashboard`);
      expect(process.env.KINDE_POST_LOGOUT_REDIRECT_URL).toBe(authEnvironments.staging.kindeSiteUrl);
    });
  });

  describe('Test User Management', () => {
    it('should create test users with correct data', async () => {
      const user = await envManager.createTestUser('basicUser');

      expect(user).toMatchObject({
        email: testUserTemplates.basicUser.email,
        given_name: testUserTemplates.basicUser.given_name,
        family_name: testUserTemplates.basicUser.family_name,
        permissions: testUserTemplates.basicUser.permissions,
        organizations: testUserTemplates.basicUser.organizations,
        environment: 'test'
      });

      expect(user.id).toMatch(/^test_basicUser_\d+$/);
      expect(user.created_at).toBeDefined();
    });

    it('should create users with custom data overrides', async () => {
      const customUser = await envManager.createTestUser('basicUser', {
        email: 'custom.email@example.com',
        given_name: 'Custom',
        permissions: ['custom:permission']
      });

      expect(customUser.email).toBe('custom.email@example.com');
      expect(customUser.given_name).toBe('Custom');
      expect(customUser.permissions).toEqual(['custom:permission']);
      // Other fields should remain from template
      expect(customUser.family_name).toBe(testUserTemplates.basicUser.family_name);
    });

    it('should track created users by environment', async () => {
      // Create users in test environment
      await envManager.createTestUser('basicUser');
      await envManager.createTestUser('adminUser');

      // Switch to staging and create more users
      envManager.switchEnvironment('staging');
      await envManager.createTestUser('premiumUser');

      const stats = envManager.getUserStatistics();

      expect(stats.test.total_users).toBe(2);
      expect(stats.staging.total_users).toBe(1);
      expect(stats.test.user_types.basic).toBe(1);
      expect(stats.test.user_types.admin).toBe(1);
      expect(stats.staging.user_types.premium).toBe(1);
    });

    it('should cleanup users for specific environment', async () => {
      await envManager.createTestUser('basicUser');
      await envManager.createTestUser('adminUser');

      expect(envManager.getUserStatistics().test.total_users).toBe(2);

      await envManager.cleanupTestUsers('test');

      expect(envManager.getUserStatistics().test.total_users).toBe(0);
    });

    it('should cleanup all users across environments', async () => {
      // Create users in multiple environments
      await envManager.createTestUser('basicUser');
      envManager.switchEnvironment('staging');
      await envManager.createTestUser('premiumUser');
      envManager.switchEnvironment('e2e');
      await envManager.createTestUser('adminUser');

      const statsBefore = envManager.getUserStatistics();
      expect(Object.keys(statsBefore)).toHaveLength(3);

      await envManager.cleanupAllTestUsers();

      const statsAfter = envManager.getUserStatistics();
      Object.values(statsAfter).forEach(envStats => {
        expect(envStats.total_users).toBe(0);
      });
    });
  });

  describe('User Scenarios', () => {
    it('should create basic flow scenario', async () => {
      const users = await envManager.createUserScenario('basic-flow');

      expect(users).toHaveLength(1);
      expect(users[0].email).toBe(testUserTemplates.basicUser.email);
    });

    it('should create permission testing scenario', async () => {
      const users = await envManager.createUserScenario('permission-testing');

      expect(users).toHaveLength(4);
      const userTypes = users.map(u => u.email.split('.')[0]);
      expect(userTypes).toContain('basic');
      expect(userTypes).toContain('premium');
      expect(userTypes).toContain('admin');
      expect(userTypes).toContain('restricted');
    });

    it('should create onboarding flow scenario', async () => {
      const users = await envManager.createUserScenario('onboarding-flow');

      expect(users).toHaveLength(1);
      expect(users[0].email).toBe(testUserTemplates.newUser.email);
    });

    it('should create multi-org testing scenario', async () => {
      const users = await envManager.createUserScenario('multi-org-testing');

      expect(users).toHaveLength(3);
      const hasBasic = users.some(u => u.email === testUserTemplates.basicUser.email);
      const hasPremium = users.some(u => u.email === testUserTemplates.premiumUser.email);
      const hasAdmin = users.some(u => u.email === testUserTemplates.adminUser.email);

      expect(hasBasic).toBe(true);
      expect(hasPremium).toBe(true);
      expect(hasAdmin).toBe(true);
    });

    it('should create security testing scenario', async () => {
      const users = await envManager.createUserScenario('security-testing');

      expect(users).toHaveLength(2);
      const hasRestricted = users.some(u => u.email === testUserTemplates.restrictedUser.email);
      const hasAdmin = users.some(u => u.email === testUserTemplates.adminUser.email);

      expect(hasRestricted).toBe(true);
      expect(hasAdmin).toBe(true);
    });

    it('should throw error for unknown scenario', async () => {
      await expect(envManager.createUserScenario('unknown-scenario')).rejects.toThrow('Unknown scenario: unknown-scenario');
    });
  });

  describe('Environment Validation', () => {
    it('should validate complete environment configuration', () => {
      envManager.switchEnvironment('test');
      const validation = envManager.validateEnvironment();

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing environment variables', () => {
      envManager.switchEnvironment('test');
      
      // Remove required env var
      const originalValue = process.env.KINDE_CLIENT_ID;
      delete process.env.KINDE_CLIENT_ID;

      const validation = envManager.validateEnvironment();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Missing environment variable: KINDE_CLIENT_ID');

      // Restore env var
      process.env.KINDE_CLIENT_ID = originalValue;
    });

    it('should detect invalid URL formats', () => {
      envManager.switchEnvironment('test');
      
      // Set invalid URL that will definitely fail URL constructor
      const originalUrl = process.env.KINDE_ISSUER_URL;
      process.env.KINDE_ISSUER_URL = 'invalid-url-without-protocol';

      const validation = envManager.validateEnvironment();

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('Invalid KINDE_ISSUER_URL format'))).toBe(true);

      // Restore URL
      process.env.KINDE_ISSUER_URL = originalUrl;
    });
  });

  describe('Manager Reset', () => {
    it('should reset to initial state', async () => {
      // Make changes
      envManager.switchEnvironment('staging');
      await envManager.createTestUser('basicUser');
      await envManager.createTestUser('adminUser');

      // Verify changes
      expect(envManager.getCurrentEnvironment().name).toBe('staging');
      expect(envManager.getUserStatistics().staging.total_users).toBe(2);

      // Reset
      envManager.reset();

      // Verify reset
      expect(envManager.getCurrentEnvironment().name).toBe('test');
      expect(Object.keys(envManager.getUserStatistics())).toHaveLength(0);
    });
  });
});

describe('Global Auth Environment Manager', () => {
  afterEach(async () => {
    await authEnvManager.cleanupAllTestUsers();
    authEnvManager.reset();
  });

  afterAll(async () => {
    await authEnvironmentSetup.afterAll();
  });

  describe('Shared Instance', () => {
    it('should provide global instance', () => {
      expect(authEnvManager).toBeInstanceOf(AuthEnvironmentManager);
    });

    it('should maintain state across different imports', async () => {
      authEnvManager.switchEnvironment('staging');
      await authEnvManager.createTestUser('basicUser');

      const stats = authEnvManager.getUserStatistics();
      expect(stats.staging.total_users).toBe(1);
    });
  });

  describe('Environment Setup Hooks', () => {
    it('should setup test environment with beforeEach', () => {
      authEnvironmentSetup.beforeEach('e2e');
      
      expect(authEnvManager.getCurrentEnvironment().name).toBe('e2e');
      expect(process.env.KINDE_ISSUER_URL).toBe(authEnvironments.e2e.kindeIssuerUrl);
    });

    it('should cleanup after each test', async () => {
      await authEnvManager.createTestUser('basicUser');
      expect(authEnvManager.getUserStatistics().test.total_users).toBe(1);

      await authEnvironmentSetup.afterEach();
      expect(authEnvManager.getUserStatistics().test.total_users).toBe(0);
    });
  });

  describe('Auth Scenarios Helpers', () => {
    it('should setup permission test scenario', async () => {
      const users = await authScenarios.setupPermissionTest();
      
      expect(users).toHaveLength(4);
      expect(users.map(u => u.email.split('.')[0])).toEqual(
        expect.arrayContaining(['basic', 'premium', 'admin', 'restricted'])
      );
    });

    it('should setup onboarding test scenario', async () => {
      const users = await authScenarios.setupOnboardingTest();
      
      expect(users).toHaveLength(1);
      expect(users[0].email).toBe(testUserTemplates.newUser.email);
    });

    it('should setup basic auth test scenario', async () => {
      const users = await authScenarios.setupBasicAuthTest();
      
      expect(users).toHaveLength(1);
      expect(users[0].email).toBe(testUserTemplates.basicUser.email);
    });

    it('should setup multi-org test scenario', async () => {
      const users = await authScenarios.setupMultiOrgTest();
      
      expect(users).toHaveLength(3);
    });

    it('should setup security test scenario', async () => {
      const users = await authScenarios.setupSecurityTest();
      
      expect(users).toHaveLength(2);
    });
  });

  describe('Environment-Aware Utilities', () => {
    it('should check current environment correctly', () => {
      authEnvManager.switchEnvironment('staging');
      
      expect(environmentAwareUtils.isEnvironment('staging')).toBe(true);
      expect(environmentAwareUtils.isEnvironment('test')).toBe(false);
    });

    it('should run test in specific environment temporarily', async () => {
      authEnvManager.switchEnvironment('test');
      
      await environmentAwareUtils.runInEnvironment('staging', async () => {
        expect(environmentAwareUtils.isEnvironment('staging')).toBe(true);
        expect(process.env.KINDE_ISSUER_URL).toBe(authEnvironments.staging.kindeIssuerUrl);
      });

      // Should return to original environment
      expect(environmentAwareUtils.isEnvironment('test')).toBe(true);
      expect(process.env.KINDE_ISSUER_URL).toBe(authEnvironments.test.kindeIssuerUrl);
    });
  });
});