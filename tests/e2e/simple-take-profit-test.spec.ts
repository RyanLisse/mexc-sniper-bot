import { test, expect } from '@playwright/test';
import { Stagehand } from '@browserbasehq/stagehand';
import { z } from 'zod';
import StagehandConfig from '../../stagehand.config.unified';

/**
 * Simple Stagehand E2E Test for Unified Take Profit Settings
 * 
 * Tests the basic functionality and UI consistency of the new unified take profit settings page.
 */

test.describe('Unified Take Profit Settings - Simple E2E Test', () => {
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

  test('should display unified take profit settings with design consistency', async () => {
    const page = stagehand.page;
    console.log('🎯 Testing unified take profit settings page');

    // Navigate to settings page
    await page.goto('http://localhost:3008/settings');
    await page.waitForLoadState('networkidle');

    // Wait for page to load and check if we need to authenticate
    await page.waitForTimeout(2000);

    // Check if we're on the auth page and skip if so
    const currentUrl = page.url();
    if (currentUrl.includes('/auth') || currentUrl.includes('/login')) {
      console.log('⚠️ Authentication required - skipping test');
      test.skip();
      return;
    }

    // Click on Take Profit tab
    await page.act("Click on the 'Take Profit' tab to view the take profit settings");
    await page.waitForTimeout(1000);

    // Analyze the take profit settings layout
    const takeProfitAnalysis = await page.extract({
      instruction: "Analyze the take profit settings page layout and design elements",
      schema: z.object({
        hasHeader: z.boolean(),
        headerTitle: z.string(),
        hasStrategyCards: z.boolean(),
        strategyOptions: z.array(z.string()),
        hasVisualChart: z.boolean(),
        hasTabsInterface: z.boolean(),
        designConsistency: z.object({
          hasCardLayout: z.boolean(),
          hasGridStructure: z.boolean(),
          hasProperSpacing: z.boolean()
        })
      })
    });

    expect(takeProfitAnalysis.hasHeader).toBe(true);
    expect(takeProfitAnalysis.headerTitle).toContain('Take Profit');
    expect(takeProfitAnalysis.hasStrategyCards).toBe(true);
    expect(takeProfitAnalysis.strategyOptions.length).toBeGreaterThan(0);
    expect(takeProfitAnalysis.hasVisualChart).toBe(true);
    expect(takeProfitAnalysis.hasTabsInterface).toBe(true);
    expect(takeProfitAnalysis.designConsistency.hasCardLayout).toBe(true);
    expect(takeProfitAnalysis.designConsistency.hasGridStructure).toBe(true);
    
    console.log('✅ Take profit settings layout validated');
    console.log('📊 Strategy options found:', takeProfitAnalysis.strategyOptions);
  });

  test('should allow strategy selection with visual feedback', async () => {
    const page = stagehand.page;
    console.log('🎯 Testing strategy selection functionality');

    await page.goto('http://localhost:3008/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check if we need authentication
    const currentUrl = page.url();
    if (currentUrl.includes('/auth') || currentUrl.includes('/login')) {
      console.log('⚠️ Authentication required - skipping test');
      test.skip();
      return;
    }

    // Navigate to take profit tab
    await page.act("Click on the 'Take Profit' tab");
    await page.waitForTimeout(1000);

    // Test strategy selection
    await page.act("Select a strategy option (Conservative, Balanced, or Aggressive)");
    await page.waitForTimeout(500);

    const strategyAnalysis = await page.extract({
      instruction: "Analyze the selected strategy and visual feedback",
      schema: z.object({
        selectedStrategy: z.string(),
        hasVisualFeedback: z.boolean(),
        chartVisible: z.boolean(),
        strategyDetails: z.object({
          riskLevel: z.string(),
          profitLevels: z.string()
        })
      })
    });

    expect(strategyAnalysis.selectedStrategy).toBeTruthy();
    expect(strategyAnalysis.hasVisualFeedback).toBe(true);
    expect(strategyAnalysis.chartVisible).toBe(true);
    
    console.log('✅ Strategy selection validated');
    console.log('📈 Selected strategy:', strategyAnalysis.selectedStrategy);
  });

  test('should display responsive design elements', async () => {
    const page = stagehand.page;
    console.log('📱 Testing responsive design');

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:3008/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check if we need authentication
    const currentUrl = page.url();
    if (currentUrl.includes('/auth') || currentUrl.includes('/login')) {
      console.log('⚠️ Authentication required - skipping test');
      test.skip();
      return;
    }

    // Navigate to take profit tab
    await page.act("Click on the 'Take Profit' tab");
    await page.waitForTimeout(1000);

    const mobileAnalysis = await page.extract({
      instruction: "Analyze the mobile layout and responsive design",
      schema: z.object({
        isMobileOptimized: z.boolean(),
        elementsVisible: z.boolean(),
        navigationWorking: z.boolean(),
        contentReadable: z.boolean()
      })
    });

    expect(mobileAnalysis.isMobileOptimized).toBe(true);
    expect(mobileAnalysis.elementsVisible).toBe(true);
    expect(mobileAnalysis.navigationWorking).toBe(true);
    
    console.log('✅ Mobile responsiveness validated');

    // Reset to desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });
});
