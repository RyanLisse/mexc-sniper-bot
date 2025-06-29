import { Stagehand } from '@browserbasehq/stagehand';
import { expect, test } from '@playwright/test';
import { z } from 'zod';
import StagehandConfig from '../../stagehand.config.unified';

/**
 * Comprehensive Stagehand E2E Tests for Unified Take Profit Settings
 * 
 * Tests the new unified take profit settings page that follows the design patterns
 * from trading-settings-react.tsx, ensuring UI consistency and functionality.
 */

test.describe('Unified Take Profit Settings - Stagehand E2E Tests', () => {
  let stagehand: Stagehand;
  let userId: string;

  // Test user credentials
  const TEST_EMAIL = `takeprofit-test-${Date.now()}@example.com`;
  const TEST_PASSWORD = 'TakeProfitTest123!';
  const TEST_NAME = 'Take Profit Test User';

  test.beforeAll(async () => {
    stagehand = new Stagehand(StagehandConfig);
    await stagehand.init();
  });

  test.afterAll(async () => {
    if (stagehand) {
      await stagehand.close();
    }
  });

  test('should display unified take profit settings with consistent design patterns', async () => {
    const page = stagehand.page;
    console.log('🎯 Testing unified take profit settings page design consistency');

    // Navigate to settings page
    await page.goto('http://localhost:3008/settings');
    await page.waitForLoadState('networkidle');

    // Analyze the overall page structure
    const pageAnalysis = await page.extract({
      instruction: "Analyze the settings page structure, focusing on the take profit tab and its design consistency",
      schema: z.object({
        hasSettingsPage: z.boolean(),
        mainTitle: z.string(),
        hasTabs: z.boolean(),
        tabNames: z.array(z.string()),
        takeProfitTabExists: z.boolean(),
        designConsistency: z.object({
          hasCardLayout: z.boolean(),
          hasGridStructure: z.boolean(),
          hasStrategySelection: z.boolean(),
          hasVisualCharts: z.boolean()
        })
      })
    });

    expect(pageAnalysis.hasSettingsPage).toBe(true);
    expect(pageAnalysis.takeProfitTabExists).toBe(true);
    expect(pageAnalysis.tabNames).toContain('Take Profit');
    expect(pageAnalysis.designConsistency.hasCardLayout).toBe(true);
    expect(pageAnalysis.designConsistency.hasGridStructure).toBe(true);
    console.log('✅ Settings page structure validated');

    // Click on Take Profit tab
    await page.act("Click on the 'Take Profit' tab to view the take profit settings");
    await page.waitForTimeout(1000);

    // Analyze the take profit settings layout
    const takeProfitAnalysis = await page.extract({
      instruction: "Analyze the take profit settings layout, strategy cards, and visual elements",
      schema: z.object({
        hasHeader: z.boolean(),
        headerTitle: z.string(),
        hasSaveButton: z.boolean(),
        hasStrategyCards: z.boolean(),
        strategyOptions: z.array(z.string()),
        hasVisualChart: z.boolean(),
        hasTabsInterface: z.boolean(),
        tabOptions: z.array(z.string()),
        hasSummaryCard: z.boolean()
      })
    });

    expect(takeProfitAnalysis.hasHeader).toBe(true);
    expect(takeProfitAnalysis.headerTitle).toContain('Take Profit');
    expect(takeProfitAnalysis.hasSaveButton).toBe(true);
    expect(takeProfitAnalysis.hasStrategyCards).toBe(true);
    expect(takeProfitAnalysis.strategyOptions).toContain('Conservative');
    expect(takeProfitAnalysis.strategyOptions).toContain('Balanced');
    expect(takeProfitAnalysis.strategyOptions).toContain('Aggressive');
    expect(takeProfitAnalysis.hasVisualChart).toBe(true);
    expect(takeProfitAnalysis.hasTabsInterface).toBe(true);
    expect(takeProfitAnalysis.hasSummaryCard).toBe(true);
    console.log('✅ Take profit settings layout validated');
  });

  test('should allow strategy selection and show visual feedback', async () => {
    const page = stagehand.page;
    console.log('🎯 Testing strategy selection and visual feedback');

    await page.goto('http://localhost:3008/settings');
    await page.waitForLoadState('networkidle');
    
    // Navigate to take profit tab
    await page.act("Click on the 'Take Profit' tab");
    await page.waitForTimeout(1000);

    // Test Conservative strategy selection
    await page.act("Select the Conservative strategy option");
    await page.waitForTimeout(500);

    const conservativeAnalysis = await page.extract({
      instruction: "Analyze the selected Conservative strategy and its visual representation",
      schema: z.object({
        selectedStrategy: z.string(),
        hasVisualChart: z.boolean(),
        chartBars: z.number(),
        riskLevel: z.string(),
        profitLevels: z.array(z.string()),
        summaryData: z.object({
          strategyType: z.string(),
          profitLevels: z.string(),
          stopLoss: z.string()
        })
      })
    });

    expect(conservativeAnalysis.selectedStrategy).toContain('Conservative');
    expect(conservativeAnalysis.hasVisualChart).toBe(true);
    expect(conservativeAnalysis.riskLevel).toContain('low');
    console.log('✅ Conservative strategy selection validated');

    // Test Aggressive strategy selection
    await page.act("Select the Aggressive strategy option");
    await page.waitForTimeout(500);

    const aggressiveAnalysis = await page.extract({
      instruction: "Analyze the selected Aggressive strategy and verify the changes in visual representation",
      schema: z.object({
        selectedStrategy: z.string(),
        riskLevel: z.string(),
        chartChanged: z.boolean(),
        profitLevels: z.array(z.string())
      })
    });

    expect(aggressiveAnalysis.selectedStrategy).toContain('Aggressive');
    expect(aggressiveAnalysis.riskLevel).toContain('high');
    expect(aggressiveAnalysis.chartChanged).toBe(true);
    console.log('✅ Aggressive strategy selection validated');
  });

  test('should support custom strategy configuration with validation', async () => {
    const page = stagehand.page;
    console.log('🎯 Testing custom strategy configuration and validation');

    await page.goto('http://localhost:3008/settings');
    await page.waitForLoadState('networkidle');
    
    // Navigate to take profit tab
    await page.act("Click on the 'Take Profit' tab");
    await page.waitForTimeout(1000);

    // Select custom strategy
    await page.act("Select the Custom Strategy option");
    await page.waitForTimeout(500);

    const customStrategyAnalysis = await page.extract({
      instruction: "Analyze the custom strategy interface and available configuration options",
      schema: z.object({
        selectedStrategy: z.string(),
        hasCustomLevels: z.boolean(),
        hasAddLevelButton: z.boolean(),
        customLevelInputs: z.array(z.string()),
        hasValidationErrors: z.boolean(),
        validationMessages: z.array(z.string())
      })
    });

    expect(customStrategyAnalysis.selectedStrategy).toContain('Custom');
    expect(customStrategyAnalysis.hasAddLevelButton).toBe(true);
    console.log('✅ Custom strategy interface validated');

    // Add a custom level
    await page.act("Click the 'Add Level' button to add a new custom profit level");
    await page.waitForTimeout(500);

    // Configure the custom level
    await page.act("Set the profit percentage to 15% and sell quantity to 30% for the first custom level");
    await page.waitForTimeout(500);

    const customLevelAnalysis = await page.extract({
      instruction: "Analyze the custom level configuration and validation feedback",
      schema: z.object({
        customLevelsCount: z.number(),
        hasValidationFeedback: z.boolean(),
        levelConfiguration: z.object({
          profitPercentage: z.string(),
          sellQuantity: z.string()
        }),
        totalSellPercentage: z.string()
      })
    });

    expect(customLevelAnalysis.customLevelsCount).toBeGreaterThan(0);
    console.log('✅ Custom level configuration validated');
  });

  test('should navigate between tabs and maintain state', async () => {
    const page = stagehand.page;
    console.log('🎯 Testing tab navigation and state management');

    await page.goto('http://localhost:3008/settings');
    await page.waitForLoadState('networkidle');
    
    // Navigate to take profit tab
    await page.act("Click on the 'Take Profit' tab");
    await page.waitForTimeout(1000);

    // Select a strategy
    await page.act("Select the Balanced strategy");
    await page.waitForTimeout(500);

    // Navigate to Risk Management tab
    await page.act("Click on the 'Risk Management' tab within the take profit settings");
    await page.waitForTimeout(500);

    const riskTabAnalysis = await page.extract({
      instruction: "Analyze the Risk Management tab content and controls",
      schema: z.object({
        currentTab: z.string(),
        hasStopLossControl: z.boolean(),
        hasTrailingStopToggle: z.boolean(),
        hasPositionSizeInput: z.boolean(),
        stopLossValue: z.string(),
        trailingStopEnabled: z.boolean()
      })
    });

    expect(riskTabAnalysis.currentTab).toContain('Risk');
    expect(riskTabAnalysis.hasStopLossControl).toBe(true);
    expect(riskTabAnalysis.hasTrailingStopToggle).toBe(true);
    expect(riskTabAnalysis.hasPositionSizeInput).toBe(true);
    console.log('✅ Risk Management tab validated');

    // Navigate to Advanced tab
    await page.act("Click on the 'Advanced' tab within the take profit settings");
    await page.waitForTimeout(500);

    const advancedTabAnalysis = await page.extract({
      instruction: "Analyze the Advanced tab content and settings",
      schema: z.object({
        currentTab: z.string(),
        hasAdvancedSettings: z.boolean(),
        settingOptions: z.array(z.string()),
        hasPatternDiscoveryIntegration: z.boolean()
      })
    });

    expect(advancedTabAnalysis.currentTab).toContain('Advanced');
    expect(advancedTabAnalysis.hasAdvancedSettings).toBe(true);
    expect(advancedTabAnalysis.hasPatternDiscoveryIntegration).toBe(true);
    console.log('✅ Advanced tab validated');

    // Return to Profit Levels tab and verify state is maintained
    await page.act("Click on the 'Profit Levels' tab to return to the main configuration");
    await page.waitForTimeout(500);

    const stateValidation = await page.extract({
      instruction: "Verify that the previously selected Balanced strategy is still selected",
      schema: z.object({
        selectedStrategy: z.string(),
        statePreserved: z.boolean()
      })
    });

    expect(stateValidation.selectedStrategy).toContain('Balanced');
    expect(stateValidation.statePreserved).toBe(true);
    console.log('✅ State preservation validated');
  });

  test('should display responsive design and mobile compatibility', async () => {
    const page = stagehand.page;
    console.log('📱 Testing responsive design and mobile compatibility');

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:3008/settings');
    await page.waitForLoadState('networkidle');

    // Navigate to take profit tab
    await page.act("Click on the 'Take Profit' tab");
    await page.waitForTimeout(1000);

    const mobileAnalysis = await page.extract({
      instruction: "Analyze the mobile layout and responsive design of the take profit settings",
      schema: z.object({
        isMobileOptimized: z.boolean(),
        hasResponsiveGrid: z.boolean(),
        strategyCardsStacked: z.boolean(),
        tabsAccessible: z.boolean(),
        buttonsClickable: z.boolean(),
        textReadable: z.boolean()
      })
    });

    expect(mobileAnalysis.isMobileOptimized).toBe(true);
    expect(mobileAnalysis.tabsAccessible).toBe(true);
    expect(mobileAnalysis.buttonsClickable).toBe(true);
    console.log('✅ Mobile responsiveness validated');

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);

    const tabletAnalysis = await page.extract({
      instruction: "Analyze the tablet layout and ensure proper scaling",
      schema: z.object({
        isTabletOptimized: z.boolean(),
        gridLayoutAppropriate: z.boolean(),
        elementsProperlySpaced: z.boolean()
      })
    });

    expect(tabletAnalysis.isTabletOptimized).toBe(true);
    expect(tabletAnalysis.gridLayoutAppropriate).toBe(true);
    console.log('✅ Tablet responsiveness validated');

    // Reset to desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });
});
