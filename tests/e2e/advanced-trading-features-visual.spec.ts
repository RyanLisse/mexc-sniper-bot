import { Stagehand } from "@browserbasehq/stagehand";
import { expect, test } from '@playwright/test';
import { z } from "zod";
import StagehandConfig from "../../stagehand.config.unified";

/**
 * Advanced Trading Features Visual Testing
 * 
 * This test suite validates advanced trading interfaces including:
 * - Multi-phase strategy management and template selection
 * - Advanced trading analytics and performance monitoring
 * - Coin calendar integration and new listings workflow
 * - Trading chart interactions and technical analysis tools
 * - Portfolio management and position tracking
 * - Strategy optimization and backtesting interfaces
 */

test.describe('Advanced Trading Features Visual Testing Suite', () => {
  let stagehand: Stagehand;
  let userId: string;

  const TEST_EMAIL = `trading-visual-${Date.now()}@example.com`;
  const TEST_PASSWORD = 'TradingTest123!';
  const TEST_NAME = 'Trading Visual Test User';

  test.beforeAll(async () => {
    stagehand = new Stagehand(StagehandConfig);
    await stagehand.init();
    console.log('📈 Initializing Advanced Trading Features Visual Testing Suite...');
  });

  test.afterAll(async () => {
    if (stagehand) {
      await stagehand.close();
    }
  });

  test('Multi-Phase Strategy Manager - Complete Strategy Lifecycle', async () => {
    const page = stagehand.page;
    console.log('🎯 Testing multi-phase strategy manager complete interface');

    // Setup authenticated session
    await page.goto('http://localhost:3008/auth');
    await page.waitForLoadState('networkidle');
    
    await page.act(`Register user: name "${TEST_NAME}", email "${TEST_EMAIL}", password "${TEST_PASSWORD}"`);
    await page.waitForLoadState('networkidle');
    userId = `trading-test-${Date.now()}`;

    // Navigate to strategies tab in dashboard
    await page.goto('http://localhost:3008/dashboard');
    await page.waitForLoadState('networkidle');
    
    await page.act("Click on Trading Strategies tab");
    await page.waitForTimeout(2000);

    // Analyze multi-phase strategy manager interface
    const strategyManagerAnalysis = await page.extract({
      instruction: "Analyze multi-phase strategy manager interface including overview cards, strategy tabs, and creation workflow",
      schema: z.object({
        overviewMetrics: z.object({
          hasActiveStrategiesCount: z.boolean(),
          showsTotalPnL: z.boolean(),
          displaysTotalInvested: z.boolean(),
          hasAveragePhases: z.boolean(),
          showsAIConfidence: z.boolean()
        }),
        strategyTabs: z.object({
          hasActiveTab: z.boolean(),
          hasCompletedTab: z.boolean(),
          hasTemplatesTab: z.boolean(),
          showsTabCounters: z.boolean()
        }),
        creationWorkflow: z.object({
          hasCreateButton: z.boolean(),
          showsCreateDialog: z.boolean(),
          hasTemplateSelection: z.boolean(),
          providesFormValidation: z.boolean()
        }),
        visualDesign: z.object({
          clearMetricsDisplay: z.boolean(),
          intuitiveTabs: z.boolean(),
          responsiveLayout: z.boolean(),
          consistentStyling: z.boolean()
        })
      })
    });

    expect(strategyManagerAnalysis.overviewMetrics.hasActiveStrategiesCount).toBe(true);
    expect(strategyManagerAnalysis.overviewMetrics.showsTotalPnL).toBe(true);
    expect(strategyManagerAnalysis.strategyTabs.hasActiveTab).toBe(true);
    expect(strategyManagerAnalysis.creationWorkflow.hasCreateButton).toBe(true);
    console.log('✅ Strategy manager overview validated');
  });

  test('Strategy Template Selection - Template Categories and Customization', async () => {
    const page = stagehand.page;
    console.log('📋 Testing strategy template selection and customization interface');

    // Navigate to dashboard and strategy templates
    await page.goto('http://localhost:3008/dashboard');
    await page.waitForLoadState('networkidle');
    
    await page.act("Navigate to Trading Strategies tab and then Templates tab");
    await page.waitForTimeout(2000);

    // Analyze template selection interface
    const templateInterface = await page.extract({
      instruction: "Analyze strategy template selection interface including categories, template details, and selection workflow",
      schema: z.object({
        templateCategories: z.object({
          hasPredefinedStrategies: z.boolean(),
          hasQuickStartTemplates: z.boolean(),
          hasAdvancedPatterns: z.boolean(),
          showsCategoryLabels: z.boolean()
        }),
        templateDetails: z.object({
          showsTemplateName: z.boolean(),
          displayDescription: z.boolean(),
          hasRiskLevelBadge: z.boolean(),
          showsEstimatedDuration: z.boolean(),
          displaysSuitability: z.boolean()
        }),
        selectionWorkflow: z.object({
          hasUseTemplateButton: z.boolean(),
          providesTemplatePreview: z.boolean(),
          allowsCustomization: z.boolean(),
          hasParameterAdjustment: z.boolean()
        }),
        templateVisualization: z.object({
          showsRiskColorCoding: z.boolean(),
          displaysTemplateMetrics: z.boolean(),
          hasComparisonView: z.boolean(),
          providesRecommendations: z.boolean()
        })
      })
    });

    expect(templateInterface.templateCategories.hasPredefinedStrategies).toBe(true);
    expect(templateInterface.templateDetails.hasRiskLevelBadge).toBe(true);
    expect(templateInterface.selectionWorkflow.hasUseTemplateButton).toBe(true);
    expect(templateInterface.templateVisualization.showsRiskColorCoding).toBe(true);

    // Test template selection workflow
    await page.act("Select a strategy template to test the creation workflow");
    await page.waitForTimeout(2000);

    const templateSelectionTest = await page.extract({
      instruction: "Analyze template selection workflow and parameter customization process",
      schema: z.object({
        selectionProcess: z.object({
          opensCreationDialog: z.boolean(),
          preselectsTemplate: z.boolean(),
          showsTemplateParameters: z.boolean(),
          allowsModification: z.boolean()
        }),
        customizationOptions: z.object({
          hasParameterInputs: z.boolean(),
          showsPreviewCalculations: z.boolean(),
          providesValidation: z.boolean(),
          allowsAdvancedSettings: z.boolean()
        })
      })
    });

    expect(templateSelectionTest.selectionProcess.opensCreationDialog).toBe(true);
    expect(templateSelectionTest.customizationOptions.hasParameterInputs).toBe(true);
    console.log('✅ Template selection interface validated');
  });

  test('Active Strategy Management - Live Strategy Monitoring and Control', async () => {
    const page = stagehand.page;
    console.log('🔄 Testing active strategy management and control interface');

    // Navigate to active strategies view
    await page.goto('http://localhost:3008/dashboard');
    await page.waitForLoadState('networkidle');
    
    await page.act("Navigate to Trading Strategies tab and view active strategies");
    await page.waitForTimeout(2000);

    // Analyze active strategy interface
    const activeStrategyInterface = await page.extract({
      instruction: "Analyze active strategy management interface including strategy cards, progress tracking, and control options",
      schema: z.object({
        strategyCards: z.object({
          hasStrategyName: z.boolean(),
          showsSymbolAndPhases: z.boolean(),
          displaysStatusIcon: z.boolean(),
          hasControlButtons: z.boolean()
        }),
        priceInformation: z.object({
          showsEntryPrice: z.boolean(),
          displaysCurrentPrice: z.boolean(),
          hasPositionSize: z.boolean(),
          showsTotalPnL: z.boolean()
        }),
        progressTracking: z.object({
          hasPhaseProgress: z.boolean(),
          showsExecutedPhases: z.boolean(),
          displaysProgressBar: z.boolean(),
          hasPhaseDetails: z.boolean()
        }),
        strategyControls: z.object({
          hasPlayPauseButton: z.boolean(),
          providesViewButton: z.boolean(),
          hasSettingsButton: z.boolean(),
          allowsModification: z.boolean()
        })
      })
    });

    expect(activeStrategyInterface.strategyCards.hasStrategyName).toBe(true);
    expect(activeStrategyInterface.priceInformation.showsTotalPnL).toBe(true);
    expect(activeStrategyInterface.progressTracking.hasPhaseProgress).toBe(true);
    expect(activeStrategyInterface.strategyControls.hasPlayPauseButton).toBe(true);

    // Test strategy control interactions
    if (activeStrategyInterface.strategyCards.hasControlButtons) {
      await page.act("Test strategy control interactions like pause/resume without causing actual trading");
      await page.waitForTimeout(2000);

      const strategyControlTest = await page.extract({
        instruction: "Analyze strategy control interaction behavior and safety mechanisms",
        schema: z.object({
          controlInteractions: z.object({
            responsiveToActions: z.boolean(),
            providesConfirmations: z.boolean(),
            showsStatusChanges: z.boolean(),
            hasImmediateFeedback: z.boolean()
          }),
          safetyMechanisms: z.object({
            hasConfirmationDialogs: z.boolean(),
            providesWarnings: z.boolean(),
            allowsReversal: z.boolean(),
            preventsAccidentalActions: z.boolean()
          })
        })
      });

      expect(strategyControlTest.controlInteractions.responsiveToActions).toBe(true);
      expect(strategyControlTest.safetyMechanisms.hasConfirmationDialogs).toBe(true);
    }
    console.log('✅ Active strategy management validated');
  });

  test('Trading Chart Integration - Real-time Charts and Technical Analysis', async () => {
    const page = stagehand.page;
    console.log('📊 Testing trading chart integration and technical analysis interface');

    // Navigate to dashboard to access trading chart
    await page.goto('http://localhost:3008/dashboard');
    await page.waitForLoadState('networkidle');

    // Analyze trading chart interface
    const tradingChartAnalysis = await page.extract({
      instruction: "Analyze trading chart interface including chart display, technical indicators, and interactive features",
      schema: z.object({
        chartDisplay: z.object({
          hasMainChart: z.boolean(),
          showsPriceData: z.boolean(),
          displaysTimeframes: z.boolean(),
          hasVolumeIndicators: z.boolean()
        }),
        technicalIndicators: z.object({
          hasTechnicalAnalysis: z.boolean(),
          showsMovingAverages: z.boolean(),
          displaysTrendLines: z.boolean(),
          hasCustomIndicators: z.boolean()
        }),
        interactiveFeatures: z.object({
          allowsZoomPan: z.boolean(),
          hasTimeframeSelection: z.boolean(),
          providesDrawingTools: z.boolean(),
          allowsIndicatorToggle: z.boolean()
        }),
        realtimeUpdates: z.object({
          updatesLive: z.boolean(),
          showsLatestPrices: z.boolean(),
          hasWebSocketConnection: z.boolean(),
          maintainsPerformance: z.boolean()
        })
      })
    });

    expect(tradingChartAnalysis.chartDisplay.hasMainChart).toBe(true);
    expect(tradingChartAnalysis.realtimeUpdates.updatesLive).toBe(true);

    // Test chart interaction capabilities
    await page.act("Interact with trading chart to test zoom, pan, and timeframe selection features");
    await page.waitForTimeout(2000);

    const chartInteractionTest = await page.extract({
      instruction: "Analyze chart interaction capabilities and responsiveness",
      schema: z.object({
        interactionQuality: z.object({
          smoothInteractions: z.boolean(),
          responsiveControls: z.boolean(),
          maintainsData: z.boolean(),
          noPerformanceLag: z.boolean()
        }),
        functionalityAccess: z.object({
          accessibleControls: z.boolean(),
          intuitiveNavigation: z.boolean(),
          clearVisualFeedback: z.boolean(),
          preservesUserActions: z.boolean()
        })
      })
    });

    expect(chartInteractionTest.interactionQuality.smoothInteractions).toBe(true);
    expect(chartInteractionTest.functionalityAccess.accessibleControls).toBe(true);
    console.log('✅ Trading chart integration validated');
  });

  test('Coin Calendar and New Listings - Market Opportunity Interface', async () => {
    const page = stagehand.page;
    console.log('📅 Testing coin calendar and new listings interface');

    // Navigate to new listings view
    await page.goto('http://localhost:3008/dashboard');
    await page.waitForLoadState('networkidle');
    
    await page.act("Navigate to New Listings tab to view coin calendar and upcoming listings");
    await page.waitForTimeout(2000);

    // Analyze coin calendar interface
    const coinCalendarInterface = await page.extract({
      instruction: "Analyze coin calendar and new listings interface including listing details, calendar view, and opportunity tracking",
      schema: z.object({
        listingsDisplay: z.object({
          showsUpcomingListings: z.boolean(),
          displaysListingDetails: z.boolean(),
          hasListingTimestamps: z.boolean(),
          showsMarketInfo: z.boolean()
        }),
        calendarView: z.object({
          hasCalendarLayout: z.boolean(),
          showsScheduledEvents: z.boolean(),
          displaysTimeZones: z.boolean(),
          allowsDateNavigation: z.boolean()
        }),
        opportunityTracking: z.object({
          hasNotificationSettings: z.boolean(),
          allowsListingAlerts: z.boolean(),
          showsPreparationStatus: z.boolean(),
          providesActionItems: z.boolean()
        }),
        marketData: z.object({
          showsMarketCap: z.boolean(),
          displaysVolumeData: z.boolean(),
          hasPerformanceMetrics: z.boolean(),
          providesAnalysis: z.boolean()
        })
      })
    });

    expect(coinCalendarInterface.listingsDisplay.showsUpcomingListings).toBe(true);
    expect(coinCalendarInterface.calendarView.hasCalendarLayout).toBe(true);

    // Test listing interaction and preparation workflow
    await page.act("Interact with coin listings to test preparation and alert configuration workflow");
    await page.waitForTimeout(2000);

    const listingInteractionTest = await page.extract({
      instruction: "Analyze coin listing interaction workflow and preparation features",
      schema: z.object({
        interactionWorkflow: z.object({
          allowsListingSelection: z.boolean(),
          providesDetailedView: z.boolean(),
          hasPreparationActions: z.boolean(),
          allowsAlertSetup: z.boolean()
        }),
        preparationFeatures: z.object({
          hasAutomationSetup: z.boolean(),
          providesStrategyPreparation: z.boolean(),
          allowsParameterConfiguration: z.boolean(),
          hasReadinessChecks: z.boolean()
        })
      })
    });

    expect(listingInteractionTest.interactionWorkflow.allowsListingSelection).toBe(true);
    console.log('✅ Coin calendar and listings interface validated');
  });

  test('Portfolio Management - Position Tracking and Performance Analysis', async () => {
    const page = stagehand.page;
    console.log('💼 Testing portfolio management and position tracking interface');

    // Navigate to dashboard overview section
    await page.goto('http://localhost:3008/dashboard');
    await page.waitForLoadState('networkidle');
    
    await page.act("Navigate to Overview tab to access portfolio and account balance information");
    await page.waitForTimeout(2000);

    // Analyze portfolio management interface
    const portfolioInterface = await page.extract({
      instruction: "Analyze portfolio management interface including account balance, position tracking, and performance metrics",
      schema: z.object({
        accountBalance: z.object({
          showsTotalBalance: z.boolean(),
          displaysBalanceChange: z.boolean(),
          hasBalanceHistory: z.boolean(),
          showsCurrencyBreakdown: z.boolean()
        }),
        positionTracking: z.object({
          showsActivePositions: z.boolean(),
          displaysPositionSizes: z.boolean(),
          hasUnrealizedPnL: z.boolean(),
          showsPositionDetails: z.boolean()
        }),
        performanceMetrics: z.object({
          showsWinRate: z.boolean(),
          displaysROI: z.boolean(),
          hasPerformanceTrends: z.boolean(),
          providesAnalytics: z.boolean()
        }),
        tradingActivity: z.object({
          showsRecentTrades: z.boolean(),
          displaysTradeHistory: z.boolean(),
          hasActivityFeed: z.boolean(),
          providesTradeAnalysis: z.boolean()
        })
      })
    });

    expect(portfolioInterface.accountBalance.showsTotalBalance).toBe(true);
    expect(portfolioInterface.positionTracking.showsActivePositions).toBe(true);
    expect(portfolioInterface.performanceMetrics.showsWinRate).toBe(true);
    expect(portfolioInterface.tradingActivity.showsRecentTrades).toBe(true);

    // Test portfolio drill-down capabilities
    await page.act("Interact with portfolio components to test detailed views and analysis capabilities");
    await page.waitForTimeout(2000);

    const portfolioDetailTest = await page.extract({
      instruction: "Analyze portfolio detail views and analysis capabilities",
      schema: z.object({
        detailViews: z.object({
          providesDetailedBreakdown: z.boolean(),
          hasHistoricalAnalysis: z.boolean(),
          showsPerformanceGraphs: z.boolean(),
          allowsCustomTimeframes: z.boolean()
        }),
        analysisTools: z.object({
          hasRiskAnalysis: z.boolean(),
          providesPerformanceComparison: z.boolean(),
          allowsGoalTracking: z.boolean(),
          hasOptimizationSuggestions: z.boolean()
        })
      })
    });

    expect(portfolioDetailTest.detailViews.providesDetailedBreakdown).toBe(true);
    console.log('✅ Portfolio management interface validated');
  });

  test('Strategy Performance Analytics - Backtesting and Optimization', async () => {
    const page = stagehand.page;
    console.log('📈 Testing strategy performance analytics and optimization interface');

    // Check if there's a dedicated analytics or performance page
    try {
      await page.goto('http://localhost:3008/monitoring');
      await page.waitForLoadState('networkidle');
    } catch {
      // If monitoring page doesn't exist, test analytics within dashboard
      await page.goto('http://localhost:3008/dashboard');
      await page.waitForLoadState('networkidle');
      await page.act("Navigate to AI & Performance tab");
      await page.waitForTimeout(2000);
    }

    // Analyze performance analytics interface
    const analyticsInterface = await page.extract({
      instruction: "Analyze strategy performance analytics interface including backtesting, optimization, and performance monitoring",
      schema: z.object({
        performanceMonitoring: z.object({
          hasPerformanceDashboard: z.boolean(),
          showsMetricsOverview: z.boolean(),
          displaysPerformanceTrends: z.boolean(),
          hasRealTimeUpdates: z.boolean()
        }),
        backtestingCapabilities: z.object({
          hasBacktestingTools: z.boolean(),
          allowsHistoricalAnalysis: z.boolean(),
          providesResultsVisualization: z.boolean(),
          hasParameterTesting: z.boolean()
        }),
        optimizationFeatures: z.object({
          hasOptimizationEngine: z.boolean(),
          allowsParameterOptimization: z.boolean(),
          providesOptimizationSuggestions: z.boolean(),
          hasAutomatedOptimization: z.boolean()
        }),
        analyticsVisualization: z.object({
          hasPerformanceCharts: z.boolean(),
          showsComparisonViews: z.boolean(),
          displaysStatisticalMetrics: z.boolean(),
          providesCustomizableViews: z.boolean()
        })
      })
    });

    expect(analyticsInterface.performanceMonitoring.hasPerformanceDashboard).toBe(true);

    // Test analytics interaction and drill-down
    await page.act("Interact with performance analytics to test detailed analysis and optimization features");
    await page.waitForTimeout(2000);

    const analyticsInteractionTest = await page.extract({
      instruction: "Analyze analytics interaction capabilities and optimization workflow",
      schema: z.object({
        interactionCapabilities: z.object({
          allowsDetailedDrillDown: z.boolean(),
          providesCustomization: z.boolean(),
          hasExportCapabilities: z.boolean(),
          allowsComparisons: z.boolean()
        }),
        optimizationWorkflow: z.object({
          hasOptimizationWizard: z.boolean(),
          providesParameterGuidance: z.boolean(),
          allowsTestingScenarios: z.boolean(),
          hasResultsValidation: z.boolean()
        })
      })
    });

    expect(analyticsInteractionTest.interactionCapabilities.allowsDetailedDrillDown).toBe(true);
    console.log('✅ Strategy performance analytics validated');
  });
});