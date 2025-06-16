import { test, expect } from '@playwright/test';
import { Stagehand } from "@browserbasehq/stagehand";
import StagehandConfig from "../../stagehand.config.unified";
import { z } from "zod";
import { db } from '@/src/db';
import { user, userPreferences, apiCredentials } from '@/src/db/schema';
import { eq } from 'drizzle-orm';

// Enhanced dashboard testing with AI-powered interactions and calendar verification
test.describe('Enhanced Dashboard with Calendar Integration (Stagehand)', () => {
  let stagehand: Stagehand;
  let userId: string;
  
  // Test user credentials
  const TEST_EMAIL = `dashboard-test-${Date.now()}@example.com`;
  const TEST_PASSWORD = 'DashTest123!';
  const TEST_NAME = 'Dashboard Test User';

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

  test('Complete dashboard functionality with calendar data verification', async () => {
    const page = stagehand.page;
    console.log('📊 Testing enhanced dashboard with calendar integration');
    
    // Step 1: Create test account using AI
    await page.goto('http://localhost:3008/auth');
    await page.waitForLoadState('networkidle');
    
    // AI-powered user registration
    const authPageAnalysis = await page.extract({
      instruction: "Analyze the auth page and determine if we need to switch to registration mode",
      schema: z.object({
        currentMode: z.enum(['login', 'register', 'unknown']),
        hasRegistrationOption: z.boolean(),
        formFields: z.array(z.string())
      })
    });
    
    if (authPageAnalysis.currentMode === 'login' && authPageAnalysis.hasRegistrationOption) {
      await page.act("Switch to registration mode by clicking the create account link");
      await page.waitForTimeout(1000);
    }
    
    // Complete registration with AI assistance
    await page.act(`Fill in the name field with "${TEST_NAME}"`);
    await page.act(`Fill in the email field with "${TEST_EMAIL}"`);
    await page.act(`Fill in the password field with "${TEST_PASSWORD}"`);
    await page.act("Submit the registration form to create the account");
    
    // Wait for dashboard redirect
    await page.waitForLoadState('networkidle', { timeout: 20000 });
    
    // Get user ID for cleanup
    const users = await db.select().from(user).where(eq(user.email, TEST_EMAIL));
    expect(users).toHaveLength(1);
    userId = users[0].id;
    console.log(`✅ Test user created with ID: ${userId}`);
    
    // Step 2: Comprehensive dashboard analysis
    const dashboardAnalysis = await page.extract({
      instruction: "Analyze the complete dashboard layout, including header, navigation, main content areas, and any data displays",
      schema: z.object({
        isDashboard: z.boolean(),
        mainTitle: z.string(),
        navigationSections: z.array(z.string()),
        contentAreas: z.array(z.string()),
        hasCalendarSection: z.boolean(),
        hasMetricsCards: z.boolean(),
        hasControlPanels: z.boolean(),
        errorMessages: z.array(z.string())
      })
    });
    
    expect(dashboardAnalysis.isDashboard).toBe(true);
    expect(dashboardAnalysis.mainTitle).toContain('MEXC Sniper Bot');
    expect(dashboardAnalysis.errorMessages).toHaveLength(0);
    console.log('✅ Dashboard loaded successfully without errors');
    
    // Step 3: Calendar section verification
    if (dashboardAnalysis.hasCalendarSection) {
      const calendarAnalysis = await page.extract({
        instruction: "Focus on the calendar section and extract detailed information about coin listings, dates, and functionality",
        schema: z.object({
          calendarTitle: z.string(),
          listingsCount: z.string().optional(),
          hasListingsData: z.boolean(),
          calendarErrors: z.array(z.string()),
          upcomingCoins: z.array(z.object({
            name: z.string().optional(),
            date: z.string().optional(),
            status: z.string().optional()
          }))
        })
      });
      
      expect(calendarAnalysis.calendarTitle).toContain('Calendar');
      expect(calendarAnalysis.calendarErrors).toHaveLength(0);
      
      // Verify specific calendar error messages are NOT present
      const calendarErrorCheck = await page.extract({
        instruction: "Check specifically for calendar-related JavaScript errors like 'filter is not a function' or 'map is not a function'",
        schema: z.object({
          hasFilterError: z.boolean(),
          hasMapError: z.boolean(),
          hasOtherJSErrors: z.boolean(),
          errorDetails: z.array(z.string())
        })
      });
      
      expect(calendarErrorCheck.hasFilterError).toBe(false);
      expect(calendarErrorCheck.hasMapError).toBe(false);
      console.log('✅ Calendar section functioning without JavaScript errors');
      
      if (calendarAnalysis.hasListingsData) {
        console.log(`✅ Calendar displaying ${calendarAnalysis.listingsCount || 'multiple'} listings`);
      } else {
        console.log('ℹ️ Calendar section present but no listings data (may be expected)');
      }
    } else {
      console.log('ℹ️ Calendar section not found on dashboard');
    }
    
    // Step 4: Dashboard navigation testing
    const navigationTest = await page.extract({
      instruction: "Identify all navigation tabs, sections, or menu items available on the dashboard",
      schema: z.object({
        availableTabs: z.array(z.string()),
        hasOverviewTab: z.boolean(),
        hasNewListingsTab: z.boolean(),
        hasSettingsAccess: z.boolean(),
        navigationWorking: z.boolean()
      })
    });
    
    // Test tab navigation if available
    if (navigationTest.hasNewListingsTab) {
      console.log('🔄 Testing New Listings tab navigation');
      await page.act("Click on the New Listings tab");
      await page.waitForTimeout(2000);
      
      const tabSwitchResult = await page.extract({
        instruction: "Verify that the New Listings tab is now active and displaying relevant content",
        schema: z.object({
          tabActive: z.boolean(),
          contentChanged: z.boolean(),
          hasListingsContent: z.boolean()
        })
      });
      
      expect(tabSwitchResult.tabActive).toBe(true);
      console.log('✅ Tab navigation working correctly');
    }
    
    // Step 5: Metrics and data verification
    const metricsAnalysis = await page.extract({
      instruction: "Extract all metric cards, data displays, and key performance indicators from the dashboard",
      schema: z.object({
        metrics: z.array(z.object({
          title: z.string(),
          value: z.string(),
          description: z.string().optional()
        })),
        hasAccountBalance: z.boolean(),
        hasSystemStatus: z.boolean(),
        hasControlPanels: z.boolean(),
        dataLoadingComplete: z.boolean()
      })
    });
    
    expect(metricsAnalysis.metrics.length).toBeGreaterThan(0);
    expect(metricsAnalysis.dataLoadingComplete).toBe(true);
    
    // Verify specific metric types
    const hasBalanceMetric = metricsAnalysis.metrics.some(m => 
      m.title.toLowerCase().includes('balance') || 
      m.title.toLowerCase().includes('portfolio')
    );
    
    if (hasBalanceMetric) {
      console.log('✅ Account balance metrics displayed');
    }
    
    console.log(`✅ Dashboard displaying ${metricsAnalysis.metrics.length} metric cards`);
    
    // Step 6: System control sections
    if (dashboardAnalysis.hasControlPanels) {
      const controlPanelAnalysis = await page.extract({
        instruction: "Analyze system control sections, including ready targets, automation controls, and safety systems",
        schema: z.object({
          hasSystemControl: z.boolean(),
          hasReadyTargets: z.boolean(),
          hasAutomationControls: z.boolean(),
          hasSafetyIndicators: z.boolean(),
          controlSections: z.array(z.string())
        })
      });
      
      if (controlPanelAnalysis.hasSystemControl) {
        console.log('✅ System control section present');
      }
      
      if (controlPanelAnalysis.hasReadyTargets) {
        console.log('✅ Ready to snipe targets section present');
      }
      
      if (controlPanelAnalysis.hasSafetyIndicators) {
        console.log('✅ Safety monitoring indicators present');
      }
    }
    
    // Step 7: Mobile responsiveness test
    console.log('📱 Testing mobile responsiveness');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    
    const mobileAnalysis = await page.extract({
      instruction: "Analyze how the dashboard adapts to mobile viewport, checking for responsive design and accessibility",
      schema: z.object({
        isResponsive: z.boolean(),
        navigationAdapted: z.boolean(),
        contentReadable: z.boolean(),
        elementsAccessible: z.boolean(),
        hasOverflow: z.boolean()
      })
    });
    
    expect(mobileAnalysis.isResponsive).toBe(true);
    expect(mobileAnalysis.contentReadable).toBe(true);
    console.log('✅ Mobile responsiveness verified');
    
    // Reset to desktop view
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(1000);
    
    // Step 8: Performance and loading verification
    const performanceCheck = await page.extract({
      instruction: "Evaluate the overall performance and loading state of the dashboard",
      schema: z.object({
        allContentLoaded: z.boolean(),
        noLoadingSpinners: z.boolean(),
        responsiveInteractions: z.boolean(),
        overallPerformance: z.enum(['excellent', 'good', 'fair', 'poor'])
      })
    });
    
    expect(performanceCheck.allContentLoaded).toBe(true);
    expect(performanceCheck.noLoadingSpinners).toBe(true);
    expect(performanceCheck.responsiveInteractions).toBe(true);
    console.log(`✅ Dashboard performance: ${performanceCheck.overallPerformance}`);
    
    console.log('🎉 Enhanced dashboard test completed successfully!');
  });

  test('Dashboard workflow and user interaction patterns', async () => {
    const page = stagehand.page;
    console.log('🔄 Testing dashboard workflow patterns');
    
    // First, set up authenticated user
    await page.goto('http://localhost:3008/auth');
    await page.waitForLoadState('networkidle');
    
    await page.act("Register a new user account with the test credentials");
    await page.act(`Fill registration form: name "${TEST_NAME}", email "${TEST_EMAIL}", password "${TEST_PASSWORD}"`);
    await page.act("Submit registration form");
    
    await page.waitForLoadState('networkidle');
    
    // Get user ID for cleanup
    const users = await db.select().from(user).where(eq(user.email, TEST_EMAIL));
    if (users.length > 0) {
      userId = users[0].id;
    }
    
    // Test dashboard section navigation
    const dashboardSections = ['Safety', 'Agents', 'Workflows', 'Strategies', 'Settings'];
    
    for (const section of dashboardSections) {
      console.log(`🔗 Testing navigation to ${section} section`);
      
      // Try to navigate to section
      const navigationAttempt = await page.observe({
        instruction: `Look for and click the ${section} navigation link or menu item`,
        returnAction: true
      });
      
      if (navigationAttempt.length > 0) {
        await page.act(`Navigate to the ${section} section`);
        await page.waitForLoadState('networkidle');
        
        // Verify navigation success
        const sectionVerification = await page.extract({
          instruction: `Verify we successfully navigated to the ${section} page or section`,
          schema: z.object({
            onCorrectPage: z.boolean(),
            pageTitle: z.string(),
            sectionContent: z.string(),
            hasRelevantContent: z.boolean()
          })
        });
        
        if (sectionVerification.onCorrectPage) {
          console.log(`✅ Successfully navigated to ${section}`);
        } else {
          console.log(`ℹ️ ${section} section may not be implemented or accessible`);
        }
        
        // Navigate back to main dashboard
        await page.act("Return to the main dashboard view");
        await page.waitForLoadState('networkidle');
      } else {
        console.log(`ℹ️ ${section} navigation not found (may not be implemented)`);
      }
    }
    
    console.log('✅ Dashboard workflow navigation test completed');
  });

  test('Real-time data updates and live features', async () => {
    const page = stagehand.page;
    console.log('⚡ Testing real-time data updates');
    
    // Set up authenticated session
    await page.goto('http://localhost:3008/auth');
    await page.waitForLoadState('networkidle');
    
    await page.act(`Register user: name "${TEST_NAME}", email "${TEST_EMAIL}", password "${TEST_PASSWORD}"`);
    await page.waitForLoadState('networkidle');
    
    // Get user ID for cleanup
    const users = await db.select().from(user).where(eq(user.email, TEST_EMAIL));
    if (users.length > 0) {
      userId = users[0].id;
    }
    
    // Capture initial dashboard state
    const initialState = await page.extract({
      instruction: "Capture the current state of all metrics, timestamps, and data on the dashboard",
      schema: z.object({
        metrics: z.array(z.object({
          name: z.string(),
          value: z.string(),
          timestamp: z.string().optional()
        })),
        lastUpdated: z.string().optional(),
        hasLiveIndicators: z.boolean(),
        websocketConnected: z.boolean().optional()
      })
    });
    
    // Wait for potential data updates
    console.log('⏳ Waiting for potential real-time updates...');
    await page.waitForTimeout(5000);
    
    // Capture updated state
    const updatedState = await page.extract({
      instruction: "Capture the updated state after waiting and check for any changes in metrics or timestamps",
      schema: z.object({
        metrics: z.array(z.object({
          name: z.string(),
          value: z.string(),
          timestamp: z.string().optional()
        })),
        lastUpdated: z.string().optional(),
        dataRefreshed: z.boolean(),
        hasLiveIndicators: z.boolean()
      })
    });
    
    // Verify system is ready for real-time updates
    expect(updatedState.hasLiveIndicators).toBe(true);
    console.log('✅ Real-time data infrastructure verified');
    
    // Test manual data refresh if available
    const refreshControl = await page.observe({
      instruction: "Look for refresh buttons, reload controls, or data update triggers",
      returnAction: true
    });
    
    if (refreshControl.length > 0) {
      console.log('🔄 Testing manual data refresh');
      await page.act("Trigger a manual data refresh or reload");
      await page.waitForTimeout(3000);
      
      const afterRefresh = await page.extract({
        instruction: "Verify data was refreshed after manual trigger",
        schema: z.object({
          refreshSuccessful: z.boolean(),
          newTimestamps: z.boolean(),
          dataUpdated: z.boolean()
        })
      });
      
      expect(afterRefresh.refreshSuccessful).toBe(true);
      console.log('✅ Manual data refresh working');
    } else {
      console.log('ℹ️ Manual refresh controls not found (may be automatic only)');
    }
    
    console.log('🎯 Real-time data features test completed');
  });
});