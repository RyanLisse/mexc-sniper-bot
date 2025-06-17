/**
 * Authentication Environment Manager
 * 
 * Manages different authentication environments and user lifecycle for testing.
 * Provides utilities for creating, managing, and cleaning up test users across
 * different Kinde applications (test, staging, production).
 */

import { beforeEach, afterEach, vi } from 'vitest';

/**
 * Environment-specific configurations for different testing contexts
 */
export const authEnvironments = {
  test: {
    name: 'test',
    kindeIssuerUrl: 'https://test-mexcsniper.kinde.com',
    kindeSiteUrl: 'http://localhost:3008',
    kindeClientId: 'test_client_id_12345',
    kindeClientSecret: 'test_client_secret_67890',
    description: 'Isolated test environment for unit and integration tests'
  },
  staging: {
    name: 'staging',
    kindeIssuerUrl: 'https://staging-mexcsniper.kinde.com', 
    kindeSiteUrl: 'https://staging.mexcsniper.com',
    kindeClientId: 'staging_client_id_abcde',
    kindeClientSecret: 'staging_client_secret_fghij',
    description: 'Staging environment for pre-production testing'
  },
  production: {
    name: 'production',
    kindeIssuerUrl: 'https://mexcsniper.kinde.com',
    kindeSiteUrl: 'https://mexcsniper.com',
    kindeClientId: 'prod_client_id_real',
    kindeClientSecret: 'prod_client_secret_real',
    description: 'Production environment (read-only for testing)'
  },
  e2e: {
    name: 'e2e',
    kindeIssuerUrl: 'https://e2e-mexcsniper.kinde.com',
    kindeSiteUrl: 'http://localhost:3008',
    kindeClientId: 'e2e_client_id_xyz',
    kindeClientSecret: 'e2e_client_secret_abc',
    description: 'Dedicated E2E testing environment with real auth flows'
  }
};

/**
 * Test user templates for different scenarios
 */
export const testUserTemplates = {
  basicUser: {
    email: 'basic.user@mexcsniper.test',
    given_name: 'Basic',
    family_name: 'User',
    permissions: ['read:dashboard'],
    organizations: ['mexc-basic']
  },
  premiumUser: {
    email: 'premium.user@mexcsniper.test',
    given_name: 'Premium',
    family_name: 'User',
    permissions: ['read:dashboard', 'read:metrics', 'read:analytics'],
    organizations: ['mexc-premium']
  },
  adminUser: {
    email: 'admin.user@mexcsniper.test',
    given_name: 'Admin',
    family_name: 'User',
    permissions: ['read:dashboard', 'read:metrics', 'write:admin', 'manage:users', 'manage:system'],
    organizations: ['mexc-admin']
  },
  newUser: {
    email: 'new.user@mexcsniper.test',
    given_name: 'New',
    family_name: 'User',
    permissions: ['read:dashboard'],
    organizations: []
  },
  restrictedUser: {
    email: 'restricted.user@mexcsniper.test',
    given_name: 'Restricted',
    family_name: 'User',
    permissions: [],
    organizations: ['mexc-restricted']
  }
};

/**
 * Environment Manager Class
 */
export class AuthEnvironmentManager {
  private currentEnvironment: string = 'test';
  private createdUsers: Map<string, any[]> = new Map();
  private environmentHistory: string[] = [];

  /**
   * Switch to a specific authentication environment
   */
  switchEnvironment(environmentName: keyof typeof authEnvironments): void {
    const env = authEnvironments[environmentName];
    if (!env) {
      throw new Error(`Unknown environment: ${environmentName}`);
    }

    // Store previous environment for rollback
    this.environmentHistory.push(this.currentEnvironment);
    this.currentEnvironment = environmentName;

    // Update environment variables
    process.env.KINDE_ISSUER_URL = env.kindeIssuerUrl;
    process.env.KINDE_SITE_URL = env.kindeSiteUrl;
    process.env.KINDE_CLIENT_ID = env.kindeClientId;
    process.env.KINDE_CLIENT_SECRET = env.kindeClientSecret;
    process.env.KINDE_POST_LOGIN_REDIRECT_URL = `${env.kindeSiteUrl}/dashboard`;
    process.env.KINDE_POST_LOGOUT_REDIRECT_URL = env.kindeSiteUrl;

    console.log(`🔄 Switched to ${env.name} environment: ${env.description}`);
  }

  /**
   * Get current environment configuration
   */
  getCurrentEnvironment(): typeof authEnvironments[keyof typeof authEnvironments] {
    return authEnvironments[this.currentEnvironment as keyof typeof authEnvironments];
  }

  /**
   * Rollback to previous environment
   */
  rollbackEnvironment(): void {
    const previousEnv = this.environmentHistory.pop();
    if (previousEnv) {
      this.switchEnvironment(previousEnv as keyof typeof authEnvironments);
    }
  }

  /**
   * Create a test user in the current environment
   */
  async createTestUser(
    userTemplate: keyof typeof testUserTemplates,
    customData: Partial<any> = {}
  ): Promise<any> {
    const template = testUserTemplates[userTemplate];
    if (!template) {
      throw new Error(`Unknown user template: ${userTemplate}`);
    }

    const userData = {
      ...template,
      ...customData,
      id: `${this.currentEnvironment}_${userTemplate}_${Date.now()}`,
      environment: this.currentEnvironment,
      created_at: new Date().toISOString()
    };

    // Store created user for cleanup
    if (!this.createdUsers.has(this.currentEnvironment)) {
      this.createdUsers.set(this.currentEnvironment, []);
    }
    this.createdUsers.get(this.currentEnvironment)!.push(userData);

    console.log(`👤 Created test user: ${userData.email} in ${this.currentEnvironment} environment`);
    return userData;
  }

  /**
   * Create multiple test users for complex scenarios
   */
  async createUserScenario(scenario: string): Promise<any[]> {
    const scenarios = {
      'basic-flow': ['basicUser'],
      'permission-testing': ['basicUser', 'premiumUser', 'adminUser', 'restrictedUser'],
      'onboarding-flow': ['newUser'],
      'multi-org-testing': ['basicUser', 'premiumUser', 'adminUser'],
      'security-testing': ['restrictedUser', 'adminUser']
    };

    const userTemplates = scenarios[scenario as keyof typeof scenarios];
    if (!userTemplates) {
      throw new Error(`Unknown scenario: ${scenario}`);
    }

    const createdUsers = [];
    for (const template of userTemplates) {
      const user = await this.createTestUser(template as keyof typeof testUserTemplates);
      createdUsers.push(user);
    }

    console.log(`🎭 Created scenario: ${scenario} with ${createdUsers.length} users`);
    return createdUsers;
  }

  /**
   * Clean up test users in the current environment
   */
  async cleanupTestUsers(environmentName?: string): Promise<void> {
    const env = environmentName || this.currentEnvironment;
    const users = this.createdUsers.get(env) || [];

    for (const user of users) {
      console.log(`🧹 Cleaning up test user: ${user.email} from ${env} environment`);
      // In a real implementation, this would call Kinde Management API to delete users
    }

    this.createdUsers.set(env, []);
    console.log(`✅ Cleaned up ${users.length} test users from ${env} environment`);
  }

  /**
   * Clean up all test users across all environments
   */
  async cleanupAllTestUsers(): Promise<void> {
    const allEnvironments = Array.from(this.createdUsers.keys());
    
    for (const env of allEnvironments) {
      await this.cleanupTestUsers(env);
    }

    console.log(`🧹 Cleaned up test users from ${allEnvironments.length} environments`);
  }

  /**
   * Get statistics about created users
   */
  getUserStatistics(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [env, users] of this.createdUsers.entries()) {
      stats[env] = {
        total_users: users.length,
        user_types: users.reduce((acc, user) => {
          const type = user.email.split('.')[0];
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        created_times: users.map(u => u.created_at)
      };
    }

    return stats;
  }

  /**
   * Validate environment configuration
   */
  validateEnvironment(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const currentEnv = this.getCurrentEnvironment();

    const requiredEnvVars = [
      'KINDE_ISSUER_URL',
      'KINDE_SITE_URL', 
      'KINDE_CLIENT_ID',
      'KINDE_CLIENT_SECRET'
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        errors.push(`Missing environment variable: ${envVar}`);
      }
    }

    // Validate URL formats
    try {
      new URL(currentEnv.kindeIssuerUrl);
    } catch {
      errors.push(`Invalid KINDE_ISSUER_URL format: ${currentEnv.kindeIssuerUrl}`);
    }

    try {
      new URL(currentEnv.kindeSiteUrl);
    } catch {
      errors.push(`Invalid KINDE_SITE_URL format: ${currentEnv.kindeSiteUrl}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Reset manager to initial state
   */
  reset(): void {
    this.currentEnvironment = 'test';
    this.createdUsers.clear();
    this.environmentHistory = [];
    
    // Reset to test environment
    this.switchEnvironment('test');
  }
}

// Global instance for use across tests
export const authEnvManager = new AuthEnvironmentManager();

/**
 * Vitest hooks for automatic environment management
 */
export const authEnvironmentSetup = {
  /**
   * Setup for tests that need environment isolation
   */
  beforeEach: (environmentName: keyof typeof authEnvironments = 'test') => {
    authEnvManager.switchEnvironment(environmentName);
    
    const validation = authEnvManager.validateEnvironment();
    if (!validation.isValid) {
      console.warn('⚠️ Environment validation warnings:', validation.errors);
    }
  },

  /**
   * Cleanup after tests
   */
  afterEach: async () => {
    await authEnvManager.cleanupTestUsers();
  },

  /**
   * Complete cleanup after all tests
   */
  afterAll: async () => {
    await authEnvManager.cleanupAllTestUsers();
    authEnvManager.reset();
  }
};

/**
 * Helper functions for common test scenarios
 */
export const authScenarios = {
  /**
   * Setup for testing user permissions
   */
  setupPermissionTest: async () => {
    return await authEnvManager.createUserScenario('permission-testing');
  },

  /**
   * Setup for testing onboarding flow
   */
  setupOnboardingTest: async () => {
    return await authEnvManager.createUserScenario('onboarding-flow');
  },

  /**
   * Setup for basic authentication testing
   */
  setupBasicAuthTest: async () => {
    return await authEnvManager.createUserScenario('basic-flow');
  },

  /**
   * Setup for multi-organization testing
   */
  setupMultiOrgTest: async () => {
    return await authEnvManager.createUserScenario('multi-org-testing');
  },

  /**
   * Setup for security testing
   */
  setupSecurityTest: async () => {
    return await authEnvManager.createUserScenario('security-testing');
  }
};

/**
 * Environment-aware test utilities
 */
export const environmentAwareUtils = {
  /**
   * Check if running in specific environment
   */
  isEnvironment: (envName: string): boolean => {
    return authEnvManager.getCurrentEnvironment().name === envName;
  },

  /**
   * Skip test if not in specific environment
   */
  skipUnlessEnvironment: (envName: string, testFn: () => void): void => {
    if (environmentAwareUtils.isEnvironment(envName)) {
      testFn();
    } else {
      console.log(`⏭️ Skipping test - requires ${envName} environment`);
    }
  },

  /**
   * Run test in specific environment temporarily
   */
  runInEnvironment: async (envName: keyof typeof authEnvironments, testFn: () => Promise<void>): Promise<void> => {
    const originalEnv = authEnvManager.getCurrentEnvironment().name;
    try {
      authEnvManager.switchEnvironment(envName);
      await testFn();
    } finally {
      authEnvManager.switchEnvironment(originalEnv as keyof typeof authEnvironments);
    }
  }
};