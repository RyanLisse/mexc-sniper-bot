import { test, expect } from '@playwright/test';
import { Stagehand } from "@browserbasehq/stagehand";
import StagehandConfig from "../../stagehand.config";
import { z } from "zod";
import { db } from '@/src/db';
import { user, userPreferences, apiCredentials } from '@/src/db/schema';
import { eq } from 'drizzle-orm';

// Enhanced authentication flow testing with AI-powered interactions
test.describe('Complete Authentication Flow (Stagehand Enhanced)', () => {
  let stagehand: Stagehand;
  let userId: string;
  
  // Generate unique test credentials
  const TEST_EMAIL = `stagehand-auth-${Date.now()}@example.com`;
  const TEST_PASSWORD = 'TestPass123!';
  const TEST_NAME = 'Stagehand Test User';

  test.beforeAll(async () => {
    stagehand = new Stagehand(StagehandConfig);
    await stagehand.init();
  });

  test.afterAll(async () => {
    if (stagehand) {
      await stagehand.close();
    }
  });

  test.afterEach(async () => {
    // Clean up test data
    if (userId) {
      try {
        await db.delete(userPreferences).where(eq(userPreferences.userId, userId));
        await db.delete(apiCredentials).where(eq(apiCredentials.userId, userId));
        await db.delete(user).where(eq(user.id, userId));
        console.log(`✅ Cleaned up test user: ${userId}`);
      } catch (error) {
        console.warn('⚠️ Cleanup error:', error);
      }
    }
  });

  test('Anonymous users redirected from protected routes', async () => {
    const page = stagehand.page;
    console.log('🔐 Testing dashboard protection for anonymous users');
    
    // Try to access dashboard directly
    await page.goto('http://localhost:3008/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Use AI to understand the current page state
    const pageAnalysis = await page.extract({
      instruction: "Analyze if this is a dashboard page or if the user was redirected. Check for dashboard content, authentication prompts, or homepage elements.",
      schema: z.object({
        isDashboard: z.boolean(),
        isAuthPage: z.boolean(),
        isHomepage: z.boolean(),
        mainContent: z.string(),
        accessDenied: z.boolean()
      })
    });

    // Verify user was redirected away from dashboard
    expect(pageAnalysis.isDashboard).toBe(false);
    
    if (pageAnalysis.isHomepage) {
      console.log('✅ Anonymous user redirected to homepage');
      
      // Verify homepage content
      const homepageContent = await page.extract({
        instruction: "Extract the main heading and navigation options from the homepage",
        schema: z.object({
          title: z.string(),
          hasGetStarted: z.boolean(),
          hasSignIn: z.boolean()
        })
      });
      
      expect(homepageContent.title).toContain('MEXC Sniper Bot');
      expect(homepageContent.hasGetStarted).toBe(true);
      expect(homepageContent.hasSignIn).toBe(true);
    } else if (pageAnalysis.isAuthPage) {
      console.log('✅ Anonymous user redirected to auth page');
    }
    
    console.log('✅ Dashboard protection working correctly');
  });

  test('Complete authentication workflow with AI-powered form handling', async () => {
    const page = stagehand.page;
    console.log('🚀 Starting AI-powered authentication workflow');
    
    // Step 1: Navigate to homepage
    await page.goto('http://localhost:3008');
    await page.waitForLoadState('networkidle');
    
    // AI-powered homepage verification
    const homepageAnalysis = await page.extract({
      instruction: "Verify this is the MEXC Sniper Bot homepage and identify available actions",
      schema: z.object({
        isCorrectHomepage: z.boolean(),
        title: z.string(),
        availableActions: z.array(z.string()),
        hasLoadingState: z.boolean()
      })
    });
    
    // Wait for loading to complete if present
    if (homepageAnalysis.hasLoadingState) {
      console.log('⏳ Waiting for page loading to complete...');
      await page.waitForTimeout(3000);
    }
    
    expect(homepageAnalysis.isCorrectHomepage).toBe(true);
    expect(homepageAnalysis.title).toContain('MEXC Sniper Bot');
    console.log('✅ Homepage verification passed');
    
    // Step 2: Navigate to authentication using AI
    await page.act("Click the Get Started button to begin registration");
    
    // Verify navigation to auth page
    const authPageCheck = await page.extract({
      instruction: "Confirm we are on the authentication page and identify the current mode (login or register)",
      schema: z.object({
        isAuthPage: z.boolean(),
        currentMode: z.enum(['login', 'register', 'unknown']),
        hasCreateAccountLink: z.boolean(),
        formFields: z.array(z.string())
      })
    });
    
    expect(authPageCheck.isAuthPage).toBe(true);
    console.log('✅ Navigation to auth page successful');
    
    // Step 3: Switch to registration mode if needed
    if (authPageCheck.currentMode === 'login' && authPageCheck.hasCreateAccountLink) {
      await page.act("Click the create account link to switch to registration mode");
      await page.waitForTimeout(1000);
    }
    
    // Step 4: AI-powered form completion
    console.log('📝 Filling registration form with AI assistance');
    
    await page.act(`Fill in the name field with "${TEST_NAME}"`);
    await page.act(`Fill in the email field with "${TEST_EMAIL}"`);
    await page.act(`Fill in the password field with "${TEST_PASSWORD}"`);
    
    // Submit registration using AI
    await page.act("Submit the registration form by clicking the Create Account button");
    
    // Wait for redirect to dashboard
    await page.waitForLoadState('networkidle', { timeout: 20000 });
    
    // Step 5: Verify successful registration and dashboard access
    const dashboardVerification = await page.extract({
      instruction: "Verify we are now on the dashboard page after successful registration",
      schema: z.object({
        isDashboard: z.boolean(),
        pageTitle: z.string(),
        userAuthenticated: z.boolean(),
        mainSections: z.array(z.string())
      })
    });
    
    expect(dashboardVerification.isDashboard).toBe(true);
    expect(dashboardVerification.userAuthenticated).toBe(true);
    
    // Get user ID from database for cleanup
    const users = await db.select().from(user).where(eq(user.email, TEST_EMAIL));
    expect(users).toHaveLength(1);
    userId = users[0].id;
    console.log(`✅ User created with ID: ${userId}`);
    
    // Step 6: Test authenticated user redirects
    await page.goto('http://localhost:3008');
    await page.waitForLoadState('networkidle');
    
    const redirectCheck = await page.extract({
      instruction: "Check if authenticated users are redirected from homepage to dashboard",
      schema: z.object({
        currentPage: z.enum(['homepage', 'dashboard', 'other']),
        url: z.string()
      })
    });
    
    expect(redirectCheck.currentPage).toBe('dashboard');
    console.log('✅ Authenticated user redirect working');
    
    // Step 7: Test sign out functionality (if available)
    const signOutAttempt = await page.observe({
      instruction: "Look for user menu, profile dropdown, or sign out button in the interface",
      returnAction: true
    });
    
    if (signOutAttempt.length > 0) {
      console.log('🔓 Testing sign out functionality');
      
      // Try to access user menu
      await page.act("Open the user menu or profile dropdown");
      await page.waitForTimeout(1000);
      
      // Look for sign out option
      const signOutOption = await page.observe({
        instruction: "Find the sign out or logout button in the menu",
        returnAction: true
      });
      
      if (signOutOption.length > 0) {
        await page.act("Click the sign out button");
        await page.waitForLoadState('networkidle');
        
        // Verify sign out
        const signOutVerification = await page.extract({
          instruction: "Verify user has been signed out and is back on homepage or auth page",
          schema: z.object({
            signedOut: z.boolean(),
            currentPage: z.string(),
            canAccessDashboard: z.boolean()
          })
        });
        
        expect(signOutVerification.signedOut).toBe(true);
        console.log('✅ Sign out successful');
        
        // Step 8: Test sign back in
        if (signOutVerification.currentPage === 'homepage') {
          await page.act("Click the Sign In button");
        }
        
        await page.waitForLoadState('networkidle');
        
        // Fill sign in form
        await page.act(`Fill in the email field with "${TEST_EMAIL}"`);
        await page.act(`Fill in the password field with "${TEST_PASSWORD}"`);
        await page.act("Submit the sign in form");
        
        await page.waitForLoadState('networkidle');
        
        // Verify sign in success
        const signInVerification = await page.extract({
          instruction: "Verify successful sign in by checking if we're back on the dashboard",
          schema: z.object({
            isDashboard: z.boolean(),
            userAuthenticated: z.boolean()
          })
        });
        
        expect(signInVerification.isDashboard).toBe(true);
        expect(signInVerification.userAuthenticated).toBe(true);
        console.log('✅ Sign in successful');
      } else {
        console.log('ℹ️ Sign out option not easily accessible');
      }
    } else {
      console.log('ℹ️ User menu not found, skipping sign out test');
    }
    
    console.log('🎉 Complete authentication workflow test passed!');
  });

  test('Protected pages security verification', async () => {
    const page = stagehand.page;
    console.log('🛡️ Testing security across multiple protected pages');
    
    const protectedRoutes = [
      '/dashboard',
      '/config', 
      '/settings',
      '/safety',
      '/strategies',
      '/workflows'
    ];
    
    for (const route of protectedRoutes) {
      console.log(`🔒 Testing protection for ${route}`);
      
      await page.goto(`http://localhost:3008${route}`);
      await page.waitForLoadState('networkidle');
      
      // AI analysis of access attempt
      const accessAnalysis = await page.extract({
        instruction: `Analyze if anonymous user gained access to ${route} or was properly redirected`,
        schema: z.object({
          accessGranted: z.boolean(),
          redirectedTo: z.string(),
          protectionWorking: z.boolean(),
          currentUrl: z.string()
        })
      });
      
      expect(accessAnalysis.accessGranted).toBe(false);
      expect(accessAnalysis.protectionWorking).toBe(true);
      console.log(`✅ ${route} properly protected`);
    }
    
    console.log('🎯 All protected routes security verified');
  });

  test('Session persistence across browser operations', async () => {
    const page = stagehand.page;
    console.log('💾 Testing session persistence');
    
    // First, authenticate a user
    await page.goto('http://localhost:3008/auth');
    await page.waitForLoadState('networkidle');
    
    // Register user with AI assistance
    await page.act("Switch to registration mode if not already there");
    await page.act(`Fill out the registration form with name "${TEST_NAME}", email "${TEST_EMAIL}", and password "${TEST_PASSWORD}"`);
    await page.act("Submit the registration form");
    
    await page.waitForLoadState('networkidle');
    
    // Get user ID for cleanup
    const users = await db.select().from(user).where(eq(user.email, TEST_EMAIL));
    if (users.length > 0) {
      userId = users[0].id;
    }
    
    // Verify we're on dashboard
    const initialAuth = await page.extract({
      instruction: "Confirm user is authenticated and on dashboard",
      schema: z.object({
        authenticated: z.boolean(),
        onDashboard: z.boolean()
      })
    });
    
    expect(initialAuth.authenticated).toBe(true);
    expect(initialAuth.onDashboard).toBe(true);
    console.log('✅ Initial authentication confirmed');
    
    // Test browser refresh
    console.log('🔄 Testing browser refresh...');
    await page.reload({ waitUntil: 'networkidle' });
    
    // Verify session persisted after refresh
    const afterRefresh = await page.extract({
      instruction: "Check if user session persisted after browser refresh",
      schema: z.object({
        stillAuthenticated: z.boolean(),
        onDashboard: z.boolean(),
        sessionPersisted: z.boolean()
      })
    });
    
    expect(afterRefresh.stillAuthenticated).toBe(true);
    expect(afterRefresh.onDashboard).toBe(true);
    expect(afterRefresh.sessionPersisted).toBe(true);
    console.log('✅ Session persisted after refresh');
    
    // Test navigation and return
    console.log('🔄 Testing navigation persistence...');
    await page.goto('http://localhost:3008');
    await page.waitForLoadState('networkidle');
    
    // Should redirect authenticated user back to dashboard
    const afterNavigation = await page.extract({
      instruction: "Check if authenticated user is redirected back to dashboard from homepage",
      schema: z.object({
        redirectedToDashboard: z.boolean(),
        sessionIntact: z.boolean()
      })
    });
    
    expect(afterNavigation.redirectedToDashboard).toBe(true);
    expect(afterNavigation.sessionIntact).toBe(true);
    console.log('✅ Session persistence across navigation verified');
    
    console.log('🎉 Session persistence test completed successfully!');
  });
});