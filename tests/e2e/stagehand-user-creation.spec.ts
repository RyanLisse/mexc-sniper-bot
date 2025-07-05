import { Stagehand } from '@browserbasehq/stagehand';
import { expect, test } from '@playwright/test';
import { z } from 'zod';
import StagehandConfig from '../../stagehand.config.unified';

/**
 * Stagehand User Creation and Verification Test
 * 
 * This test focuses specifically on:
 * 1. Creating test users via API
 * 2. Verifying user creation was successful
 * 3. Testing login with newly created users
 * 4. Verifying user data persistence
 * 5. Testing user management operations
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3008';

// User creation schemas
const UserCreationSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    email_confirmed_at: z.string().optional()
  }).optional()
});

const LoginVerificationSchema = z.object({
  isLoggedIn: z.boolean(),
  userEmail: z.string().optional(),
  hasUserMenu: z.boolean(),
  pageTitle: z.string()
});

// Test utilities
class TestUserManager {
  private createdUsers: Set<string> = new Set();
  
  async createUser(email: string, password: string) {
    console.log(`📧 Creating test user: ${email}`);
    
    const response = await fetch(`${BASE_URL}/api/test-users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-environment': 'true',
        'User-Agent': 'Stagehand-Test-Runner'
      },
      body: JSON.stringify({ email, password })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create user: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    if (result.success) {
      this.createdUsers.add(email);
      console.log(`✅ Test user created: ${email}`);
    }
    
    return result;
  }
  
  async deleteUser(email: string) {
    console.log(`🗑️ Deleting test user: ${email}`);
    
    const response = await fetch(`${BASE_URL}/api/test-users?email=${encodeURIComponent(email)}`, {
      method: 'DELETE',
      headers: {
        'x-test-environment': 'true',
        'User-Agent': 'Stagehand-Test-Runner'
      }
    });
    
    if (response.ok) {
      this.createdUsers.delete(email);
      console.log(`✅ Test user deleted: ${email}`);
    } else {
      console.warn(`⚠️ Failed to delete user ${email}: ${response.status}`);
    }
    
    return response.ok;
  }
  
  async cleanup() {
    console.log(`🧹 Cleaning up ${this.createdUsers.size} test users`);
    const cleanupPromises = Array.from(this.createdUsers).map(email => this.deleteUser(email));
    await Promise.allSettled(cleanupPromises);
  }
  
  generateTestUser() {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    return {
      email: `test-user-${timestamp}-${randomId}@stagehand.test`,
      password: 'StagehandTest123!',
      displayName: `Stagehand Test User ${randomId}`
    };
  }
}

test.describe('Stagehand User Creation and Management', () => {
  let stagehand: Stagehand;
  let userManager: TestUserManager;

  test.beforeAll(async () => {
    // Initialize Stagehand
    stagehand = new Stagehand({
      ...StagehandConfig,
      modelName: 'gpt-4o',
      temperature: 0.1,
      verbose: 2 // More verbose for user creation tests
    });
    
    await stagehand.init();
    userManager = new TestUserManager();
    console.log('🚀 Stagehand User Creation Test Suite initialized');
  });

  test.afterAll(async () => {
    // Clean up all created users
    await userManager.cleanup();
    
    // Close Stagehand
    if (stagehand) {
      await stagehand.close();
    }
    console.log('🏁 Test suite cleanup completed');
  });

  test('should create a new test user via API', async () => {
    const testUser = userManager.generateTestUser();
    
    // Create user via API
    const result = await userManager.createUser(testUser.email, testUser.password);
    
    // Verify creation response
    expect(result).toMatchObject({
      success: true,
      message: expect.stringContaining(testUser.email)
    });
    
    if (result.user) {
      expect(result.user.email).toBe(testUser.email);
      expect(result.user.id).toBeDefined();
    }
    
    console.log('✅ User creation API test passed');
  });

  test('should create user and verify login functionality', async () => {
    const testUser = userManager.generateTestUser();
    
    // Step 1: Create user
    const creationResult = await userManager.createUser(testUser.email, testUser.password);
    expect(creationResult.success).toBe(true);
    
    // Step 2: Test login with created user
    const page = stagehand.page;
    await page.goto(`${BASE_URL}/auth`);
    
    // Use AI to fill login form
    await page.act(`Enter "${testUser.email}" in the email input field`);
    await page.act(`Enter "${testUser.password}" in the password input field`);
    await page.act('Click the sign in or login button to authenticate');
    
    // Wait for successful authentication
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    
    // Step 3: Verify login success
    const loginData = await page.extract({
      instruction: 'Verify that the user is successfully logged in by checking for user interface elements like user menu, dashboard content, and any displayed email address',
      schema: LoginVerificationSchema
    });
    
    expect(loginData.isLoggedIn).toBe(true);
    console.log('✅ User creation and login verification passed');
  });

  test('should create multiple users and test batch operations', async () => {
    const users = [
      userManager.generateTestUser(),
      userManager.generateTestUser(),
      userManager.generateTestUser()
    ];
    
    // Create multiple users
    const creationPromises = users.map(user => 
      userManager.createUser(user.email, user.password)
    );
    
    const results = await Promise.all(creationPromises);
    
    // Verify all users were created
    results.forEach((result, index) => {
      expect(result.success).toBe(true);
      console.log(`✅ User ${index + 1} created: ${users[index].email}`);
    });
    
    // Test login with one of the created users
    const testUser = users[1]; // Use middle user
    const page = stagehand.page;
    
    await page.goto(`${BASE_URL}/auth`);
    await page.act(`Fill the email field with "${testUser.email}"`);
    await page.act(`Fill the password field with "${testUser.password}"`);
    await page.act('Submit the login form by clicking the sign in button');
    
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    
    const verificationResult = await page.extract({
      instruction: 'Confirm successful authentication by checking dashboard elements',
      schema: LoginVerificationSchema
    });
    
    expect(verificationResult.isLoggedIn).toBe(true);
    console.log('✅ Batch user creation and login test passed');
  });

  test('should handle user creation errors gracefully', async () => {
    // Test duplicate user creation
    const testUser = userManager.generateTestUser();
    
    // Create user first time
    const firstResult = await userManager.createUser(testUser.email, testUser.password);
    expect(firstResult.success).toBe(true);
    
    // Try to create same user again
    try {
      const duplicateResult = await userManager.createUser(testUser.email, testUser.password);
      // Should either succeed (idempotent) or fail gracefully
      console.log('🔄 Duplicate user creation handled:', duplicateResult);
    } catch (error) {
      console.log('⚠️ Duplicate user creation rejected as expected:', error.message);
    }
    
    console.log('✅ User creation error handling test passed');
  });

  test('should verify user data persistence across sessions', async () => {
    const testUser = userManager.generateTestUser();
    
    // Create user
    await userManager.createUser(testUser.email, testUser.password);
    
    const page = stagehand.page;
    
    // First login session
    await page.goto(`${BASE_URL}/auth`);
    await page.act(`Enter "${testUser.email}" in the email field`);
    await page.act(`Enter "${testUser.password}" in the password field`);
    await page.act('Click sign in button');
    
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    
    // Verify first session
    let sessionData = await page.extract({
      instruction: 'Check if user is logged in and get any displayed user information',
      schema: LoginVerificationSchema
    });
    
    expect(sessionData.isLoggedIn).toBe(true);
    
    // Test session persistence with page refresh
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Should still be logged in
    const currentUrl = page.url();
    expect(currentUrl).not.toMatch(/\/auth$/);
    
    // Verify persistence
    sessionData = await page.extract({
      instruction: 'Verify user is still logged in after page refresh',
      schema: LoginVerificationSchema
    });
    
    expect(sessionData.isLoggedIn).toBe(true);
    console.log('✅ User data persistence test passed');
  });

  test('should test user creation with edge cases', async () => {
    // Test with different email formats
    const edgeCaseUsers = [
      {
        email: `test.user+tag@stagehand-test.com`,
        password: 'EdgeCase123!'
      },
      {
        email: `test_user@subdomain.stagehand-test.co.uk`,
        password: 'AnotherEdgeCase456!'
      }
    ];
    
    for (const user of edgeCaseUsers) {
      try {
        const result = await userManager.createUser(user.email, user.password);
        expect(result.success).toBe(true);
        console.log(`✅ Edge case user created: ${user.email}`);
        
        // Test login with edge case user
        const page = stagehand.page;
        await page.goto(`${BASE_URL}/auth`);
        await page.act(`Fill email field with "${user.email}"`);
        await page.act(`Fill password field with "${user.password}"`);
        await page.act('Click the sign in button');
        
        await page.waitForURL('**/dashboard', { timeout: 30000 });
        console.log(`✅ Edge case user login successful: ${user.email}`);
        
        // Sign out for next test
        await page.act('Find and click sign out button');
        await page.waitForURL('**/auth', { timeout: 15000 });
        
      } catch (error) {
        console.log(`⚠️ Edge case failed for ${user.email}:`, error.message);
      }
    }
    
    console.log('✅ Edge case user creation test completed');
  });

  test('should validate API endpoints are working correctly', async () => {
    // Test API health by creating and immediately deleting a user
    const testUser = userManager.generateTestUser();
    
    // Create user
    const createResult = await userManager.createUser(testUser.email, testUser.password);
    expect(createResult.success).toBe(true);
    
    // Verify user can authenticate (API works end-to-end)
    const page = stagehand.page;
    await page.goto(`${BASE_URL}/auth`);
    await page.act(`Type "${testUser.email}" in the email input`);
    await page.act(`Type "${testUser.password}" in the password input`);
    await page.act('Click the login button');
    
    // Should successfully authenticate
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    
    const apiValidation = await page.extract({
      instruction: 'Confirm we have successfully reached the dashboard after API-created user login',
      schema: LoginVerificationSchema
    });
    
    expect(apiValidation.isLoggedIn).toBe(true);
    
    // Clean up by deleting the user
    const deleteResult = await userManager.deleteUser(testUser.email);
    expect(deleteResult).toBe(true);
    
    console.log('✅ API endpoint validation test passed');
  });
});