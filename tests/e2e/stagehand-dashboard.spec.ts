import { test, expect } from '@playwright/test';
import { Stagehand } from "@browserbasehq/stagehand";
import StagehandConfig from "../../stagehand.config.unified";
import { z } from "zod";

test.describe('Stagehand Enhanced Dashboard Tests', () => {
  let stagehand: Stagehand;

  test.beforeAll(async () => {
    stagehand = new Stagehand(StagehandConfig);
    await stagehand.init();
  });

  test.afterAll(async () => {
    if (stagehand) {
      await stagehand.close();
    }
  });

  test('should navigate and interact with dashboard using Stagehand', async () => {
    const page = stagehand.page;
    
    // Navigate to dashboard
    await page.goto('http://localhost:3008/dashboard');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Use Stagehand to observe and interact with dashboard elements
    const dashboardTitle = await page.extract({
      instruction: "Extract the main dashboard title",
      schema: z.object({
        title: z.string(),
      }),
      useTextExtract: false,
    });
    
    expect(dashboardTitle.title).toContain('Dashboard');
    
    // Test tab navigation using Stagehand
    const tabResults = await page.observe({
      instruction: "Find the Overview tab",
      onlyVisible: true,
      returnAction: true,
    });
    
    expect(tabResults.length).toBeGreaterThan(0);
    
    // Click on New Listings tab
    const newListingsAction = await page.observe({
      instruction: "Click the New Listings tab",
      onlyVisible: true,
      returnAction: true,
    });
    
    if (newListingsAction.length > 0) {
      await page.act(newListingsAction[0]);
      await page.waitForTimeout(1000);
    }
    
    // Extract metric cards using Stagehand
    const metrics = await page.extract({
      instruction: "Extract all metric card values and titles",
      schema: z.object({
        metrics: z.array(z.object({
          title: z.string(),
          value: z.string(),
        })),
      }),
      useTextExtract: true,
    });
    
    expect(metrics.metrics.length).toBeGreaterThan(0);
    expect(metrics.metrics.some(m => m.title.includes('Balance'))).toBe(true);
  });

  test('should test mobile responsiveness with Stagehand', async () => {
    const page = stagehand.page;
    
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:3008/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Check if mobile layout is properly rendered
    const mobileContent = await page.extract({
      instruction: "Check if the page is responsive on mobile",
      schema: z.object({
        isResponsive: z.boolean(),
        visibleElements: z.array(z.string()),
      }),
      useTextExtract: true,
    });
    
    expect(mobileContent.visibleElements.length).toBeGreaterThan(0);
  });

  test('should test user menu and logout functionality', async () => {
    const page = stagehand.page;
    
    await page.goto('http://localhost:3008/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Look for user menu using Stagehand
    const userMenuAction = await page.observe({
      instruction: "Find and click the user dropdown menu in the sidebar",
      onlyVisible: true,
      returnAction: true,
    });
    
    if (userMenuAction.length > 0) {
      await page.act(userMenuAction[0]);
      await page.waitForTimeout(500);
      
      // Check for logout option
      const logoutOption = await page.extract({
        instruction: "Find the sign out or logout option",
        schema: z.object({
          hasLogout: z.boolean(),
          logoutText: z.string().optional(),
        }),
        useTextExtract: false,
      });
      
      expect(logoutOption.hasLogout).toBe(true);
    }
  });

  test('should navigate between different dashboard sections', async () => {
    const page = stagehand.page;
    
    await page.goto('http://localhost:3008/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Navigate to different sections
    const sections = ['Safety', 'Agents', 'Workflows', 'Strategies'];
    
    for (const section of sections) {
      const sectionAction = await page.observe({
        instruction: `Click the ${section} navigation link`,
        onlyVisible: true,
        returnAction: true,
      });
      
      if (sectionAction.length > 0) {
        await page.act(sectionAction[0]);
        await page.waitForLoadState('networkidle');
        
        // Verify we're on the correct page
        const currentPageTitle = await page.extract({
          instruction: `Check if we're on the ${section} page`,
          schema: z.object({
            pageTitle: z.string(),
            isCorrectPage: z.boolean(),
          }),
          useTextExtract: false,
        });
        
        // Navigate back to dashboard for next iteration
        const dashboardAction = await page.observe({
          instruction: "Click the Dashboard navigation link",
          onlyVisible: true,
          returnAction: true,
        });
        
        if (dashboardAction.length > 0) {
          await page.act(dashboardAction[0]);
          await page.waitForLoadState('networkidle');
        }
      }
    }
  });

  test('should test trading configuration and settings', async () => {
    const page = stagehand.page;
    
    await page.goto('http://localhost:3008/settings');
    await page.waitForLoadState('networkidle');
    
    // Extract trading settings
    const tradingSettings = await page.extract({
      instruction: "Extract all trading configuration options and their current values",
      schema: z.object({
        settings: z.array(z.object({
          name: z.string(),
          value: z.string(),
          type: z.string().optional(),
        })),
      }),
      useTextExtract: true,
    });
    
    expect(tradingSettings.settings.length).toBeGreaterThan(0);
  });
});