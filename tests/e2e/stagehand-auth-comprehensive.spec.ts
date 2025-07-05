import { Stagehand } from '@browserbasehq/stagehand';
import { expect, test } from '@playwright/test';
import { z } from 'zod';
import StagehandConfig from '../../stagehand.config.unified';

/**
 * Comprehensive Stagehand Authentication Test Suite
 * 
 * This test suite implements automated user creation and authentication verification
 * using Stagehand's AI-powered browser automation capabilities.
 * 
 * Features:
 * - Dynamic test user creation via API
 * - AI-powered form interaction
 * - Complete authentication flow verification
 * - Session persistence validation
 * - Protected route access testing
 * - Proper cleanup of test users
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3008';
const FALLBACK_EMAIL = process.env.AUTH_EMAIL || 'ryan@ryanlisse.com';
const FALLBACK_PASSWORD = process.env.AUTH_PASSWORD || 'Testing2025!';

// Test user configuration
const generateTestUser = () => {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);
  return {
    email: `test-user-${timestamp}-${randomId}@example.com`,
    password: 'TestPass123!',
    displayName: `Test User ${randomId}`
  };
};

// API helper for test user management
const createTestUser = async (email: string, password: string) => {
  const response = await fetch(`${BASE_URL}/api/test-users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-test-environment': 'true'
    },
    body: JSON.stringify({ email, password })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create test user: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
};

const deleteTestUser = async (email: string) => {
  const response = await fetch(`${BASE_URL}/api/test-users?email=${encodeURIComponent(email)}`, {
    method: 'DELETE',
    headers: {
      'x-test-environment': 'true'
    }
  });
  
  if (!response.ok) {
    console.warn(`Failed to delete test user ${email}: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
};

// Validation schemas for AI extraction
const AuthPageSchema = z.object({
  hasEmailField: z.boolean(),
  hasPasswordField: z.boolean(),
  hasSignInButton: z.boolean(),
  pageTitle: z.string(),
  isAuthPage: z.boolean()
});

const DashboardSchema = z.object({
  isDashboard: z.boolean(),
  hasUserMenu: z.boolean(),
  hasMainContent: z.boolean(),
  userEmail: z.string().optional(),
  isAuthenticated: z.boolean()
});

const ErrorSchema = z.object({
  hasError: z.boolean(),
  errorMessage: z.string().optional(),
  isOnAuthPage: z.boolean()
});

test.describe('Stagehand Comprehensive Authentication', () => {
  let stagehand: Stagehand;
  let testUser: { email: string; password: string; displayName: string };
  let createdUsers: string[] = [];

  test.beforeAll(async () => {
    // Initialize Stagehand with optimized configuration
    stagehand = new Stagehand({
      ...StagehandConfig,
      // Override for reliable testing
      modelName: 'gpt-4o',
      temperature: 0.1,
      verbose: 1
    });
    
    await stagehand.init();
    console.log('✅ Stagehand initialized successfully');
  });

  test.afterAll(async () => {
    // Clean up test users
    for (const email of createdUsers) {
      try {
        await deleteTestUser(email);
        console.log(`🗑️ Cleaned up test user: ${email}`);
      } catch (error) {
        console.warn(`⚠️ Failed to clean up test user ${email}:`, error);
      }
    }
    
    // Close Stagehand
    if (stagehand) {
      await stagehand.close();
      console.log('✅ Stagehand closed successfully');
    }
  });

  test.beforeEach(async () => {
    // Generate new test user for each test
    testUser = generateTestUser();
    createdUsers.push(testUser.email);
  });

  test('should create test user and verify authentication flow', async () => {
    console.log(`📧 Creating test user: ${testUser.email}`);
    
    // Step 1: Create test user via API
    const userCreationResult = await createTestUser(testUser.email, testUser.password);
    expect(userCreationResult.success).toBe(true);
    console.log('✅ Test user created successfully');

    // Step 2: Navigate to application
    const page = stagehand.page;
    await page.goto(BASE_URL);
    console.log('🌐 Navigated to application');

    // Step 3: Use AI to navigate to authentication page
    await page.act('Look for and click the sign in or login button to access the authentication page');
    
    // Wait for navigation to auth page
    await page.waitForURL('**/auth', { timeout: 15000 });
    
    // Step 4: Verify we're on the auth page using AI
    const authPageData = await page.extract({
      instruction: 'Analyze this authentication page and verify it has email field, password field, and sign in button. Also check if this looks like a login/auth page.',
      schema: AuthPageSchema
    });
    
    expect(authPageData.isAuthPage).toBe(true);
    expect(authPageData.hasEmailField).toBe(true);
    expect(authPageData.hasPasswordField).toBe(true);
    expect(authPageData.hasSignInButton).toBe(true);
    console.log('✅ Authentication page verified');

    // Step 5: Sign in with test user credentials using AI
    await page.act(`Fill in the email field with "${testUser.email}"`);
    await page.act(`Fill in the password field with "${testUser.password}"`);
    await page.act('Click the sign in or submit button to log in');
    
    // Step 6: Wait for authentication to complete
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    console.log('🎯 Successfully navigated to dashboard');

    // Step 7: Verify we're on the dashboard and authenticated
    const dashboardData = await page.extract({
      instruction: 'Analyze this dashboard page to confirm the user is authenticated. Look for user menu, main content, and any indicators of successful login.',
      schema: DashboardSchema
    });
    
    expect(dashboardData.isDashboard).toBe(true);
    expect(dashboardData.isAuthenticated).toBe(true);
    console.log('✅ Dashboard access verified');

    // Step 8: Test session persistence by refreshing the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Should still be on dashboard after refresh
    const urlAfterRefresh = page.url();
    expect(urlAfterRefresh).toMatch(/\/dashboard$/);
    console.log('✅ Session persistence verified');
  });

  test('should handle invalid credentials gracefully', async () => {
    console.log('🔐 Testing invalid credentials handling');
    
    const page = stagehand.page;
    await page.goto(BASE_URL);
    
    // Navigate to auth page
    await page.act('Find and click the sign in or login button');
    await page.waitForURL('**/auth', { timeout: 15000 });
    
    // Try to sign in with invalid credentials
    await page.act('Fill in the email field with "invalid@example.com"');
    await page.act('Fill in the password field with "wrongpassword"');
    await page.act('Click the sign in or submit button');
    
    // Wait for error to appear
    await page.waitForTimeout(3000);
    
    // Extract error information
    const errorData = await page.extract({
      instruction: 'Check if there is an error message displayed and if we are still on the authentication page after failed login attempt.',
      schema: ErrorSchema
    });
    
    expect(errorData.isOnAuthPage).toBe(true);
    expect(errorData.hasError).toBe(true);
    console.log('✅ Invalid credentials handled correctly');
  });

  test('should redirect authenticated users from auth page', async () => {
    console.log('🔄 Testing authenticated user redirection');
    
    // First, create and authenticate a test user
    await createTestUser(testUser.email, testUser.password);
    
    const page = stagehand.page;
    await page.goto(`${BASE_URL}/auth`);
    
    // Sign in
    await page.act(`Fill in the email field with "${testUser.email}"`);
    await page.act(`Fill in the password field with "${testUser.password}"`);
    await page.act('Click the sign in button');
    
    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    
    // Now try to visit auth page again
    await page.goto(`${BASE_URL}/auth`);
    
    // Should be redirected away from auth page
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    expect(currentUrl).not.toMatch(/\/auth$/);
    expect(currentUrl).toMatch(/\/dashboard$/);
    console.log('✅ Authenticated user redirection verified');
  });

  test('should test protected route access', async () => {
    console.log('🛡️ Testing protected route access');
    
    const page = stagehand.page;
    
    // Try to access protected route without authentication
    await page.goto(`${BASE_URL}/dashboard`);
    
    // Should be redirected to auth page
    await page.waitForURL('**/auth', { timeout: 15000 });
    
    const authPageData = await page.extract({
      instruction: 'Verify that we have been redirected to the authentication page',
      schema: AuthPageSchema
    });
    
    expect(authPageData.isAuthPage).toBe(true);
    console.log('✅ Protected route access control verified');
  });

  test('should complete full authentication lifecycle', async () => {
    console.log('🔄 Testing complete authentication lifecycle');
    
    // Create test user
    await createTestUser(testUser.email, testUser.password);
    
    const page = stagehand.page;
    await page.goto(BASE_URL);
    
    // 1. Sign in
    await page.act('Click the sign in button');
    await page.waitForURL('**/auth');
    
    await page.act(`Fill in the email field with "${testUser.email}"`);
    await page.act(`Fill in the password field with "${testUser.password}"`);
    await page.act('Click the sign in button');
    
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    console.log('✅ Sign in completed');
    
    // 2. Verify authenticated state
    const dashboardData = await page.extract({
      instruction: 'Confirm we are on the dashboard and authenticated',
      schema: DashboardSchema
    });
    
    expect(dashboardData.isDashboard).toBe(true);
    expect(dashboardData.isAuthenticated).toBe(true);
    
    // 3. Test other protected routes
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState('networkidle');
    
    // Should be able to access settings
    const settingsUrl = page.url();
    expect(settingsUrl).toMatch(/\/settings$/);
    console.log('✅ Settings page access verified');
    
    // 4. Sign out
    await page.goto(`${BASE_URL}/dashboard`);
    await page.act('Find and click the sign out or logout button');
    
    // Should be redirected to auth page
    await page.waitForURL('**/auth', { timeout: 15000 });
    console.log('✅ Sign out completed');
    
    // 5. Verify sign out worked
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForURL('**/auth', { timeout: 15000 });
    
    const finalAuthCheck = await page.extract({
      instruction: 'Verify we are back on the authentication page after sign out',
      schema: AuthPageSchema
    });
    
    expect(finalAuthCheck.isAuthPage).toBe(true);
    console.log('✅ Complete authentication lifecycle verified');
  });

  test('should handle authentication errors and recovery', async () => {
    console.log('🔧 Testing authentication error handling and recovery');
    
    const page = stagehand.page;
    await page.goto(`${BASE_URL}/auth`);
    
    // 1. Test with invalid email format
    await page.act('Fill in the email field with "not-an-email"');
    await page.act('Fill in the password field with "somepassword"');
    await page.act('Click the sign in button');
    
    await page.waitForTimeout(2000);
    
    let errorData = await page.extract({
      instruction: 'Check for validation error about invalid email format',
      schema: ErrorSchema
    });
    
    expect(errorData.hasError).toBe(true);
    expect(errorData.isOnAuthPage).toBe(true);
    console.log('✅ Invalid email format handled');
    
    // 2. Clear form and try with valid credentials
    await createTestUser(testUser.email, testUser.password);
    
    await page.act('Clear the email field');
    await page.act('Clear the password field');
    await page.act(`Fill in the email field with "${testUser.email}"`);
    await page.act(`Fill in the password field with "${testUser.password}"`);
    await page.act('Click the sign in button');
    
    // Should succeed
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    
    const recoveryData = await page.extract({
      instruction: 'Verify successful authentication after error recovery',
      schema: DashboardSchema
    });
    
    expect(recoveryData.isDashboard).toBe(true);
    expect(recoveryData.isAuthenticated).toBe(true);
    console.log('✅ Authentication error recovery verified');
  });

  test('should test with fallback existing user', async () => {
    console.log('👤 Testing with existing fallback user');
    
    const page = stagehand.page;
    await page.goto(`${BASE_URL}/auth`);
    
    // Use fallback credentials
    await page.act(`Fill in the email field with "${FALLBACK_EMAIL}"`);
    await page.act(`Fill in the password field with "${FALLBACK_PASSWORD}"`);
    await page.act('Click the sign in button');
    
    // Should authenticate successfully
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    
    const dashboardData = await page.extract({
      instruction: 'Verify successful authentication with fallback user',
      schema: DashboardSchema
    });
    
    expect(dashboardData.isDashboard).toBe(true);
    expect(dashboardData.isAuthenticated).toBe(true);
    console.log('✅ Fallback user authentication verified');
  });
});