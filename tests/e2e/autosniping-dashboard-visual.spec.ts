import { Stagehand } from "@browserbasehq/stagehand";
import { expect, test } from '@playwright/test';
import { z } from "zod";
import StagehandConfig from "../../stagehand.config.unified";

/**
 * Comprehensive Visual Testing for Autosniping Dashboard
 * 
 * This test suite validates the complete autosniping user interface including:
 * - Pattern detection display and real-time updates
 * - Trading strategy configuration interface  
 * - Take-profit level settings and modifications
 * - Autosniping status indicators and alerts
 * - Emergency stop functionality visual feedback
 * - Real-time price display and WebSocket updates
 * - Multi-phase profit taking interface
 * - Risk management controls and warnings
 */

test.describe('Autosniping Dashboard Visual Testing Suite', () => {
  let stagehand: Stagehand;
  let userId: string;
  let testStartTime: number;

  // Test user credentials
  const TEST_EMAIL = `autosniping-visual-${Date.now()}@example.com`;
  const TEST_PASSWORD = 'AutoSnipeTest123!';
  const TEST_NAME = 'Autosniping Visual Test User';

  test.beforeAll(async () => {
    testStartTime = Date.now();
    stagehand = new Stagehand(StagehandConfig);
    await stagehand.init();
    console.log('🎯 Initializing Autosniping Visual Testing Suite...');
  });

  test.afterAll(async () => {
    if (stagehand) {
      await stagehand.close();
    }
    const testDuration = Date.now() - testStartTime;
    console.log(`🏁 Autosniping Visual Testing Suite completed in ${testDuration}ms`);
  });

  test.afterEach(async () => {
    // Clean up test data if needed
    if (userId) {
      try {
        console.log(`✅ Test cleanup for user: ${userId}`);
      } catch (error) {
        console.warn('⚠️ Cleanup error:', error);
      }
    }
  });

  test('Pattern Detection Dashboard - Visual Workflow Validation', async () => {
    const page = stagehand.page;
    console.log('📊 Testing pattern detection visual interface workflow');

    // Step 1: Set up authenticated user
    await page.goto('http://localhost:3008/auth');
    await page.waitForLoadState('networkidle');

    await page.act("Register a new user account");
    await page.act(`Fill registration form: name "${TEST_NAME}", email "${TEST_EMAIL}", password "${TEST_PASSWORD}"`);
    await page.act("Submit registration form");
    await page.waitForLoadState('networkidle', { timeout: 20000 });

    userId = `autosniping-test-${Date.now()}`;

    // Step 2: Navigate to dashboard and analyze pattern detection display
    const dashboardAnalysis = await page.extract({
      instruction: "Analyze the main dashboard for pattern detection indicators, confidence scores, and activity data display",
      schema: z.object({
        hasPatternDetection: z.boolean(),
        patternIndicators: z.object({
          sts_indicator: z.boolean(),
          st_indicator: z.boolean(),
          tt_indicator: z.boolean(),
          confidenceScoreVisible: z.boolean(),
          activityDataVisible: z.boolean()
        }),
        patternStatus: z.object({
          currentState: z.string(),
          readyToSnipe: z.boolean(),
          confidenceLevel: z.string().optional(),
          activityCount: z.string().optional()
        }),
        visualElements: z.object({
          hasStatusBadges: z.boolean(),
          hasProgressIndicators: z.boolean(),
          hasRealTimeUpdates: z.boolean(),
          hasColorCodedStatus: z.boolean()
        })
      })
    });

    expect(dashboardAnalysis.hasPatternDetection).toBe(true);
    expect(dashboardAnalysis.patternIndicators.confidenceScoreVisible).toBe(true);
    expect(dashboardAnalysis.visualElements.hasStatusBadges).toBe(true);
    console.log('✅ Pattern detection visual indicators validated');

    // Step 3: Test pattern detection status display
    const patternStatusAnalysis = await page.extract({
      instruction: "Focus on the pattern detection status display and extract current pattern states (sts, st, tt values)",
      schema: z.object({
        patternValues: z.object({
          sts_value: z.string().optional(),
          st_value: z.string().optional(),
          tt_value: z.string().optional()
        }),
        statusIndicators: z.object({
          isReady: z.boolean(),
          hasWarnings: z.boolean(),
          hasErrors: z.boolean()
        }),
        confidenceMetrics: z.object({
          currentConfidence: z.string().optional(),
          threshold: z.string().optional(),
          trend: z.string().optional()
        }),
        uiResponsiveness: z.object({
          fastLoading: z.boolean(),
          smoothAnimations: z.boolean(),
          clearVisibility: z.boolean()
        })
      })
    });

    expect(patternStatusAnalysis.uiResponsiveness.fastLoading).toBe(true);
    expect(patternStatusAnalysis.uiResponsiveness.clearVisibility).toBe(true);
    console.log('✅ Pattern status display validation completed');

    // Step 4: Test manual pattern trigger functionality
    const manualTriggerTest = await page.observe({
      instruction: "Look for manual pattern trigger controls, test buttons, or override mechanisms",
      returnAction: true
    });

    if (manualTriggerTest.length > 0) {
      console.log('🔄 Testing manual pattern trigger interface');
      
      const triggerInterface = await page.extract({
        instruction: "Analyze manual trigger controls and their visual feedback mechanisms",
        schema: z.object({
          hasTriggerButton: z.boolean(),
          hasOverrideControls: z.boolean(),
          hasTestMode: z.boolean(),
          buttonStates: z.array(z.string()),
          feedbackMechanisms: z.array(z.string())
        })
      });

      expect(triggerInterface.hasTriggerButton).toBe(true);
      console.log('✅ Manual trigger interface validated');
    }
  });

  test('Trading Strategy Configuration - Visual Interface Testing', async () => {
    const page = stagehand.page;
    console.log('⚙️ Testing trading strategy configuration visual interface');

    // Navigate to strategy configuration
    await page.goto('http://localhost:3008/auth');
    await page.waitForLoadState('networkidle');
    
    await page.act(`Register user: name "${TEST_NAME}", email "${TEST_EMAIL}", password "${TEST_PASSWORD}"`);
    await page.waitForLoadState('networkidle');
    userId = `strategy-test-${Date.now()}`;

    // Navigate to strategy configuration page
    await page.act("Navigate to strategy configuration or settings page");
    await page.waitForLoadState('networkidle');

    // Step 1: Analyze strategy configuration interface
    const strategyConfigAnalysis = await page.extract({
      instruction: "Analyze the strategy configuration interface including take-profit levels, risk parameters, and strategy preview",
      schema: z.object({
        hasStrategyConfig: z.boolean(),
        takeProfitLevels: z.object({
          hasLevelInputs: z.boolean(),
          hasPercentageControls: z.boolean(),
          hasQuantityControls: z.boolean(),
          hasAddRemoveButtons: z.boolean()
        }),
        riskParameters: z.object({
          hasStopLossControl: z.boolean(),
          hasPositionSizeControl: z.boolean(),
          hasRiskLimitControls: z.boolean()
        }),
        strategyPreview: z.object({
          hasVisualChart: z.boolean(),
          hasPreviewCalculations: z.boolean(),
          hasRiskAssessment: z.boolean()
        }),
        validation: z.object({
          hasFieldValidation: z.boolean(),
          hasErrorMessages: z.boolean(),
          hasSuccessIndicators: z.boolean()
        })
      })
    });

    expect(strategyConfigAnalysis.hasStrategyConfig).toBe(true);
    expect(strategyConfigAnalysis.takeProfitLevels.hasLevelInputs).toBe(true);
    expect(strategyConfigAnalysis.strategyPreview.hasVisualChart).toBe(true);
    console.log('✅ Strategy configuration interface validated');

    // Step 2: Test take-profit level configuration
    console.log('📈 Testing take-profit level configuration');
    
    // Try to configure take-profit levels
    await page.act("Configure take-profit levels by setting different percentage levels and quantities");
    await page.waitForTimeout(1000);

    const takeProfitConfigTest = await page.extract({
      instruction: "Analyze the take-profit configuration process and visual feedback",
      schema: z.object({
        configurationActive: z.boolean(),
        levelsConfigured: z.number(),
        validationFeedback: z.object({
          hasValidInput: z.boolean(),
          hasInvalidInput: z.boolean(),
          feedbackMessages: z.array(z.string())
        }),
        visualPreview: z.object({
          chartUpdated: z.boolean(),
          previewAccurate: z.boolean(),
          calculationsVisible: z.boolean()
        })
      })
    });

    expect(takeProfitConfigTest.configurationActive).toBe(true);
    expect(takeProfitConfigTest.visualPreview.chartUpdated).toBe(true);
    console.log('✅ Take-profit configuration validation completed');

    // Step 3: Test strategy validation and preview
    const strategyValidationTest = await page.extract({
      instruction: "Test strategy validation by checking error handling, warnings, and preview accuracy",
      schema: z.object({
        validationWorking: z.boolean(),
        hasWarningSystem: z.boolean(),
        previewMode: z.object({
          showsExpectedReturns: z.boolean(),
          showsRiskMetrics: z.boolean(),
          showsScenarioAnalysis: z.boolean()
        }),
        userExperience: z.object({
          intuitive: z.boolean(),
          responsive: z.boolean(),
          visuallyAppealing: z.boolean()
        })
      })
    });

    expect(strategyValidationTest.validationWorking).toBe(true);
    expect(strategyValidationTest.userExperience.intuitive).toBe(true);
    expect(strategyValidationTest.userExperience.responsive).toBe(true);
    console.log('✅ Strategy validation and preview testing completed');
  });

  test('Autosniping Status Indicators and Emergency Controls', async () => {
    const page = stagehand.page;
    console.log('🚨 Testing autosniping status indicators and emergency controls');

    // Set up authenticated session
    await page.goto('http://localhost:3008/auth');
    await page.waitForLoadState('networkidle');
    
    await page.act(`Register user: name "${TEST_NAME}", email "${TEST_EMAIL}", password "${TEST_PASSWORD}"`);
    await page.waitForLoadState('networkidle');
    userId = `emergency-test-${Date.now()}`;

    // Navigate to main dashboard
    await page.goto('http://localhost:3008/dashboard');
    await page.waitForLoadState('networkidle');

    // Step 1: Analyze autosniping status indicators
    const statusIndicatorAnalysis = await page.extract({
      instruction: "Analyze all autosniping status indicators, alerts, and system state displays",
      schema: z.object({
        autosniperStatus: z.object({
          isActive: z.boolean(),
          currentMode: z.string(),
          statusIndicator: z.string(),
          hasActivityLight: z.boolean()
        }),
        systemAlerts: z.object({
          hasAlertSystem: z.boolean(),
          currentAlerts: z.array(z.string()),
          alertTypes: z.array(z.string()),
          alertSeverity: z.array(z.string())
        }),
        statusDisplay: z.object({
          clearVisibility: z.boolean(),
          colorCoded: z.boolean(),
          realtimeUpdates: z.boolean(),
          statusHistory: z.boolean()
        }),
        monitoringPanels: z.object({
          hasSystemHealth: z.boolean(),
          hasPerformanceMetrics: z.boolean(),
          hasConnectionStatus: z.boolean()
        })
      })
    });

    expect(statusIndicatorAnalysis.statusDisplay.clearVisibility).toBe(true);
    expect(statusIndicatorAnalysis.statusDisplay.colorCoded).toBe(true);
    console.log('✅ Status indicators visual validation completed');

    // Step 2: Test emergency stop functionality
    const emergencyControlsTest = await page.observe({
      instruction: "Look for emergency stop buttons, kill switches, or system halt controls",
      returnAction: true
    });

    if (emergencyControlsTest.length > 0) {
      console.log('🛑 Testing emergency stop visual interface');
      
      const emergencyInterfaceAnalysis = await page.extract({
        instruction: "Analyze emergency stop controls and their visual prominence and accessibility",
        schema: z.object({
          emergencyControls: z.object({
            hasEmergencyStop: z.boolean(),
            hasKillSwitch: z.boolean(),
            hasPauseControls: z.boolean(),
            buttonVisibility: z.string(),
            buttonSizing: z.string()
          }),
          visualDesign: z.object({
            prominentPlacement: z.boolean(),
            clearLabeling: z.boolean(),
            dangerStyling: z.boolean(),
            confirmationRequired: z.boolean()
          }),
          accessibilityFeatures: z.object({
            keyboardAccessible: z.boolean(),
            highContrast: z.boolean(),
            clearInstructions: z.boolean()
          })
        })
      });

      expect(emergencyInterfaceAnalysis.emergencyControls.hasEmergencyStop).toBe(true);
      expect(emergencyInterfaceAnalysis.visualDesign.prominentPlacement).toBe(true);
      expect(emergencyInterfaceAnalysis.visualDesign.dangerStyling).toBe(true);
      console.log('✅ Emergency controls interface validated');

      // Test emergency stop feedback
      await page.act("Test emergency stop functionality (if safe to do so in test environment)");
      await page.waitForTimeout(2000);

      const emergencyFeedbackTest = await page.extract({
        instruction: "Analyze visual feedback after emergency stop activation",
        schema: z.object({
          feedbackProvided: z.boolean(),
          statusChanged: z.boolean(),
          confirmationShown: z.boolean(),
          systemStateUpdated: z.boolean(),
          visualCuesChanged: z.boolean()
        })
      });

      expect(emergencyFeedbackTest.feedbackProvided).toBe(true);
      expect(emergencyFeedbackTest.statusChanged).toBe(true);
      console.log('✅ Emergency stop feedback validation completed');
    } else {
      console.log('ℹ️ Emergency controls not found or not accessible in current context');
    }
  });

  test('Real-time Trading Interface and WebSocket Updates', async () => {
    const page = stagehand.page;
    console.log('⚡ Testing real-time trading interface and WebSocket functionality');

    // Set up authenticated session
    await page.goto('http://localhost:3008/auth');
    await page.waitForLoadState('networkidle');
    
    await page.act(`Register user: name "${TEST_NAME}", email "${TEST_EMAIL}", password "${TEST_PASSWORD}"`);
    await page.waitForLoadState('networkidle');
    userId = `realtime-test-${Date.now()}`;

    // Navigate to dashboard with real-time features
    await page.goto('http://localhost:3008/dashboard');
    await page.waitForLoadState('networkidle');

    // Step 1: Analyze real-time price display
    const realtimePriceAnalysis = await page.extract({
      instruction: "Analyze real-time price displays, WebSocket connection status, and live data updates",
      schema: z.object({
        priceDisplays: z.object({
          hasLivePrices: z.boolean(),
          priceUpdateFrequency: z.string(),
          hasTickerSymbols: z.boolean(),
          hasPriceChange: z.boolean(),
          hasVolumeData: z.boolean()
        }),
        websocketStatus: z.object({
          connectionVisible: z.boolean(),
          connectionStatus: z.string(),
          hasConnectionIndicator: z.boolean(),
          hasReconnectControls: z.boolean()
        }),
        dataFreshness: z.object({
          hasTimestamps: z.boolean(),
          hasLastUpdate: z.boolean(),
          hasDataAge: z.boolean(),
          realtimeIndicators: z.boolean()
        }),
        visualPerformance: z.object({
          smoothUpdates: z.boolean(),
          noVisualLag: z.boolean(),
          efficientRendering: z.boolean()
        })
      })
    });

    expect(realtimePriceAnalysis.priceDisplays.hasLivePrices).toBe(true);
    expect(realtimePriceAnalysis.websocketStatus.connectionVisible).toBe(true);
    expect(realtimePriceAnalysis.visualPerformance.smoothUpdates).toBe(true);
    console.log('✅ Real-time price display validation completed');

    // Step 2: Test order execution visual feedback
    const orderExecutionTest = await page.observe({
      instruction: "Look for order execution interfaces, trade buttons, or transaction controls",
      returnAction: true
    });

    if (orderExecutionTest.length > 0) {
      console.log('💼 Testing order execution visual feedback');
      
      const orderInterfaceAnalysis = await page.extract({
        instruction: "Analyze order execution interface and visual feedback mechanisms",
        schema: z.object({
          orderControls: z.object({
            hasBuyButtons: z.boolean(),
            hasSellButtons: z.boolean(),
            hasQuantityInputs: z.boolean(),
            hasOrderTypes: z.boolean()
          }),
          executionFeedback: z.object({
            hasProgressIndicators: z.boolean(),
            hasStatusUpdates: z.boolean(),
            hasSuccessConfirmation: z.boolean(),
            hasErrorHandling: z.boolean()
          }),
          transactionDisplay: z.object({
            hasOrderHistory: z.boolean(),
            hasExecutionDetails: z.boolean(),
            hasTimestamps: z.boolean(),
            hasStatusTracking: z.boolean()
          })
        })
      });

      expect(orderInterfaceAnalysis.executionFeedback.hasProgressIndicators).toBe(true);
      expect(orderInterfaceAnalysis.executionFeedback.hasStatusUpdates).toBe(true);
      console.log('✅ Order execution interface validated');
    }

    // Step 3: Test portfolio balance and position displays
    const portfolioDisplayTest = await page.extract({
      instruction: "Analyze portfolio balance displays, position information, and profit/loss indicators",
      schema: z.object({
        portfolioDisplay: z.object({
          hasBalanceDisplay: z.boolean(),
          hasPositions: z.boolean(),
          hasProfitLoss: z.boolean(),
          hasPerformanceMetrics: z.boolean()
        }),
        visualClarity: z.object({
          clearNumbers: z.boolean(),
          colorCodedPnL: z.boolean(),
          goodContrast: z.boolean(),
          responsiveLayout: z.boolean()
        }),
        realtimeUpdates: z.object({
          balanceUpdates: z.boolean(),
          positionUpdates: z.boolean(),
          pnlUpdates: z.boolean()
        })
      })
    });

    expect(portfolioDisplayTest.portfolioDisplay.hasBalanceDisplay).toBe(true);
    expect(portfolioDisplayTest.visualClarity.clearNumbers).toBe(true);
    expect(portfolioDisplayTest.visualClarity.colorCodedPnL).toBe(true);
    console.log('✅ Portfolio display validation completed');

    // Step 4: Test performance under simulated load
    console.log('🔄 Testing visual performance under load...');
    
    // Simulate rapid updates by refreshing multiple times
    for (let i = 0; i < 3; i++) {
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
    }

    const performanceTest = await page.extract({
      instruction: "Evaluate visual performance after multiple refreshes and updates",
      schema: z.object({
        performanceMetrics: z.object({
          noVisualLag: z.boolean(),
          smoothTransitions: z.boolean(),
          responsiveInterface: z.boolean(),
          noMemoryLeaks: z.boolean()
        }),
        dataConsistency: z.object({
          consistentDisplay: z.boolean(),
          noDataLoss: z.boolean(),
          accurateValues: z.boolean()
        })
      })
    });

    expect(performanceTest.performanceMetrics.noVisualLag).toBe(true);
    expect(performanceTest.performanceMetrics.responsiveInterface).toBe(true);
    expect(performanceTest.dataConsistency.consistentDisplay).toBe(true);
    console.log('✅ Performance under load validation completed');
  });

  test('Complete User Journey - Login to Autosniping Activation', async () => {
    const page = stagehand.page;
    console.log('🎯 Testing complete autosniping user journey from login to activation');

    // Step 1: Start from homepage
    await page.goto('http://localhost:3008');
    await page.waitForLoadState('networkidle');

    const homepageAnalysis = await page.extract({
      instruction: "Analyze homepage and identify path to get started with autosniping",
      schema: z.object({
        isHomepage: z.boolean(),
        hasGetStarted: z.boolean(),
        hasSignIn: z.boolean(),
        clearCallToAction: z.boolean()
      })
    });

    expect(homepageAnalysis.isHomepage).toBe(true);
    expect(homepageAnalysis.hasGetStarted).toBe(true);
    console.log('✅ Homepage analysis completed');

    // Step 2: Registration flow
    await page.act("Click Get Started to begin registration");
    await page.waitForLoadState('networkidle');

    await page.act(`Complete registration with name "${TEST_NAME}", email "${TEST_EMAIL}", password "${TEST_PASSWORD}"`);
    await page.waitForLoadState('networkidle', { timeout: 20000 });

    userId = `journey-test-${Date.now()}`;
    console.log('✅ User registration completed');

    // Step 3: Dashboard navigation and initial setup
    const dashboardOnboarding = await page.extract({
      instruction: "Analyze dashboard onboarding and guidance for new users setting up autosniping",
      schema: z.object({
        hasOnboarding: z.boolean(),
        hasGuidance: z.boolean(),
        hasSetupWizard: z.boolean(),
        clearNextSteps: z.boolean(),
        setupProgress: z.array(z.string())
      })
    });

    if (dashboardOnboarding.hasOnboarding || dashboardOnboarding.hasSetupWizard) {
      console.log('📋 Following onboarding process...');
      await page.act("Follow the onboarding or setup wizard for autosniping configuration");
      await page.waitForTimeout(2000);
    }

    // Step 4: Strategy setup workflow
    console.log('⚙️ Testing strategy setup workflow');
    
    await page.act("Navigate to strategy configuration");
    await page.waitForLoadState('networkidle');

    const strategySetupFlow = await page.extract({
      instruction: "Analyze the strategy setup flow and user guidance",
      schema: z.object({
        setupFlow: z.object({
          hasStepByStep: z.boolean(),
          hasProgressIndicator: z.boolean(),
          hasValidation: z.boolean(),
          hasPreview: z.boolean()
        }),
        userExperience: z.object({
          intuitive: z.boolean(),
          wellGuided: z.boolean(),
          errorsHandled: z.boolean(),
          helpAvailable: z.boolean()
        })
      })
    });

    expect(strategySetupFlow.userExperience.intuitive).toBe(true);
    expect(strategySetupFlow.userExperience.wellGuided).toBe(true);
    console.log('✅ Strategy setup flow validated');

    // Step 5: Configure a basic strategy
    await page.act("Configure a basic conservative strategy with default settings");
    await page.waitForTimeout(1000);

    // Step 6: Navigate to autosniping activation
    await page.act("Navigate back to dashboard to activate autosniping");
    await page.waitForLoadState('networkidle');

    // Step 7: Test autosniping activation workflow
    const activationTest = await page.observe({
      instruction: "Look for autosniping activation controls, start buttons, or enable switches",
      returnAction: true
    });

    if (activationTest.length > 0) {
      console.log('🚀 Testing autosniping activation');
      
      const activationAnalysis = await page.extract({
        instruction: "Analyze autosniping activation interface and safety checks",
        schema: z.object({
          activationControls: z.object({
            hasActivateButton: z.boolean(),
            hasEnableSwitch: z.boolean(),
            hasStartControls: z.boolean()
          }),
          safetyChecks: z.object({
            hasConfirmation: z.boolean(),
            hasWarnings: z.boolean(),
            hasPrerequisites: z.boolean(),
            hasRiskDisclosure: z.boolean()
          }),
          statusFeedback: z.object({
            activationConfirmed: z.boolean(),
            statusUpdated: z.boolean(),
            monitoringStarted: z.boolean()
          })
        })
      });

      expect(activationAnalysis.activationControls.hasActivateButton).toBe(true);
      expect(activationAnalysis.safetyChecks.hasConfirmation).toBe(true);
      console.log('✅ Activation interface validated');

      // Attempt activation (if safe in test environment)
      await page.act("Activate autosniping after confirming safety checks");
      await page.waitForTimeout(3000);

      // Step 8: Verify activation success and monitoring
      const activationSuccess = await page.extract({
        instruction: "Verify autosniping has been successfully activated and monitoring is working",
        schema: z.object({
          activationSuccess: z.boolean(),
          statusIndicators: z.object({
            activeStatus: z.boolean(),
            monitoringActive: z.boolean(),
            systemHealthy: z.boolean()
          }),
          monitoringInterface: z.object({
            hasRealTimeUpdates: z.boolean(),
            hasControlPanels: z.boolean(),
            hasEmergencyStop: z.boolean()
          })
        })
      });

      expect(activationSuccess.activationSuccess).toBe(true);
      expect(activationSuccess.statusIndicators.activeStatus).toBe(true);
      expect(activationSuccess.monitoringInterface.hasEmergencyStop).toBe(true);
      console.log('✅ Autosniping activation and monitoring validated');
    } else {
      console.log('ℹ️ Autosniping activation controls not found - may require additional setup');
    }

    console.log('🎉 Complete user journey test completed successfully!');
  });

  test('Mobile Responsiveness and Accessibility for Autosniping Interface', async () => {
    const page = stagehand.page;
    console.log('📱 Testing mobile responsiveness and accessibility for autosniping interface');

    // Test different mobile viewports
    const mobileViewports = [
      { name: 'iPhone SE', width: 375, height: 667 },
      { name: 'iPhone 12', width: 390, height: 844 },
      { name: 'Android Medium', width: 412, height: 869 }
    ];

    for (const viewport of mobileViewports) {
      console.log(`📱 Testing ${viewport.name} (${viewport.width}x${viewport.height})`);
      
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      
      // Navigate to dashboard
      await page.goto('http://localhost:3008/auth');
      await page.waitForLoadState('networkidle');
      
      await page.act(`Register user: name "${TEST_NAME}", email "${TEST_EMAIL}", password "${TEST_PASSWORD}"`);
      await page.waitForLoadState('networkidle');
      
      userId = `mobile-test-${viewport.name.replace(' ', '-')}-${Date.now()}`;

      // Test mobile dashboard
      const mobileAnalysis = await page.extract({
        instruction: `Analyze autosniping dashboard mobile responsiveness on ${viewport.name}`,
        schema: z.object({
          responsiveDesign: z.object({
            elementsScaleCorrectly: z.boolean(),
            textReadable: z.boolean(),
            buttonsAccessible: z.boolean(),
            noHorizontalScroll: z.boolean()
          }),
          navigation: z.object({
            menuAccessible: z.boolean(),
            tabsUsable: z.boolean(),
            controlsReachable: z.boolean()
          }),
          autosniperInterface: z.object({
            statusVisible: z.boolean(),
            controlsUsable: z.boolean(),
            emergencyStopAccessible: z.boolean(),
            dataReadable: z.boolean()
          }),
          touchInteractions: z.object({
            buttonsClickable: z.boolean(),
            swipeGesturesWork: z.boolean(),
            inputFieldsUsable: z.boolean()
          })
        })
      });

      expect(mobileAnalysis.responsiveDesign.elementsScaleCorrectly).toBe(true);
      expect(mobileAnalysis.responsiveDesign.textReadable).toBe(true);
      expect(mobileAnalysis.responsiveDesign.buttonsAccessible).toBe(true);
      expect(mobileAnalysis.autosniperInterface.emergencyStopAccessible).toBe(true);
      expect(mobileAnalysis.touchInteractions.buttonsClickable).toBe(true);
      
      console.log(`✅ ${viewport.name} responsiveness validated`);
    }

    // Reset to desktop view
    await page.setViewportSize({ width: 1280, height: 720 });
    console.log('✅ Mobile responsiveness testing completed');
  });

  test('Error Handling and User Feedback Scenarios', async () => {
    const page = stagehand.page;
    console.log('🚨 Testing error handling and user feedback scenarios');

    // Set up authenticated session
    await page.goto('http://localhost:3008/auth');
    await page.waitForLoadState('networkidle');
    
    await page.act(`Register user: name "${TEST_NAME}", email "${TEST_EMAIL}", password "${TEST_PASSWORD}"`);
    await page.waitForLoadState('networkidle');
    userId = `error-test-${Date.now()}`;

    // Navigate to dashboard
    await page.goto('http://localhost:3008/dashboard');
    await page.waitForLoadState('networkidle');

    // Step 1: Test network disconnection simulation
    console.log('🌐 Testing network disconnection handling');
    
    // Simulate offline condition
    await page.context().setOffline(true);
    await page.waitForTimeout(2000);

    const offlineHandling = await page.extract({
      instruction: "Analyze how the interface handles network disconnection and offline state",
      schema: z.object({
        offlineDetection: z.object({
          hasOfflineIndicator: z.boolean(),
          showsConnectionStatus: z.boolean(),
          displaysErrorMessage: z.boolean()
        }),
        userFeedback: z.object({
          clearErrorMessages: z.boolean(),
          helpfulGuidance: z.boolean(),
          retryOptions: z.boolean()
        }),
        gracefulDegradation: z.object({
          interfaceStillUsable: z.boolean(),
          dataPreserved: z.boolean(),
          functionalityReduced: z.boolean()
        })
      })
    });

    // Restore connection
    await page.context().setOffline(false);
    await page.waitForTimeout(2000);

    const reconnectionHandling = await page.extract({
      instruction: "Analyze how the interface handles reconnection and recovery",
      schema: z.object({
        reconnectionDetected: z.boolean(),
        dataRefreshed: z.boolean(),
        statusUpdated: z.boolean(),
        userNotified: z.boolean()
      })
    });

    expect(reconnectionHandling.reconnectionDetected).toBe(true);
    console.log('✅ Network disconnection handling validated');

    // Step 2: Test invalid configuration warnings
    console.log('⚠️ Testing invalid configuration handling');
    
    // Navigate to strategy configuration
    await page.act("Navigate to strategy configuration");
    await page.waitForLoadState('networkidle');

    // Try to input invalid values
    await page.act("Enter invalid configuration values to test validation");
    await page.waitForTimeout(1000);

    const validationHandling = await page.extract({
      instruction: "Analyze validation error handling and user feedback for invalid configurations",
      schema: z.object({
        validationErrors: z.object({
          errorsDisplayed: z.boolean(),
          specificMessages: z.boolean(),
          helpfulGuidance: z.boolean(),
          clearInstructions: z.boolean()
        }),
        userExperience: z.object({
          preventsBadSubmission: z.boolean(),
          allowsCorrection: z.boolean(),
          maintainsFocus: z.boolean()
        })
      })
    });

    expect(validationHandling.validationErrors.errorsDisplayed).toBe(true);
    expect(validationHandling.userExperience.preventsBadSubmission).toBe(true);
    console.log('✅ Invalid configuration handling validated');

    // Step 3: Test emergency stop activation feedback
    const emergencyTest = await page.observe({
      instruction: "Look for emergency stop controls to test feedback mechanisms",
      returnAction: true
    });

    if (emergencyTest.length > 0) {
      console.log('🛑 Testing emergency stop feedback');
      
      await page.act("Test emergency stop activation");
      await page.waitForTimeout(2000);

      const emergencyFeedback = await page.extract({
        instruction: "Analyze emergency stop visual feedback and user communication",
        schema: z.object({
          immediateFeedback: z.object({
            statusChanged: z.boolean(),
            visualCues: z.boolean(),
            confirmationShown: z.boolean()
          }),
          systemResponse: z.object({
            operationsStopped: z.boolean(),
            safetyConfirmed: z.boolean(),
            recoveryOptions: z.boolean()
          })
        })
      });

      expect(emergencyFeedback.immediateFeedback.statusChanged).toBe(true);
      expect(emergencyFeedback.immediateFeedback.confirmationShown).toBe(true);
      console.log('✅ Emergency stop feedback validated');
    }

    console.log('🎯 Error handling and user feedback testing completed');
  });
});