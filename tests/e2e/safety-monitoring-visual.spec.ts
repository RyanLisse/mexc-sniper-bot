import { test, expect } from '@playwright/test';
import { Stagehand } from "@browserbasehq/stagehand";
import StagehandConfig from "../../stagehand.config.unified";
import { z } from "zod";

/**
 * Safety & Monitoring Systems Visual Testing
 * 
 * This test suite validates comprehensive safety monitoring interfaces including:
 * - Real-time safety dashboard and system health monitoring
 * - Risk assessment displays and threshold monitoring
 * - Emergency control systems and circuit breakers
 * - Agent health monitoring and anomaly detection
 * - Alert management and notification systems
 * - System architecture overview and component health
 */

test.describe('Safety & Monitoring Systems Visual Testing Suite', () => {
  let stagehand: Stagehand;
  let userId: string;

  const TEST_EMAIL = `safety-visual-${Date.now()}@example.com`;
  const TEST_PASSWORD = 'SafetyTest123!';
  const TEST_NAME = 'Safety Visual Test User';

  test.beforeAll(async () => {
    stagehand = new Stagehand(StagehandConfig);
    await stagehand.init();
    console.log('🛡️ Initializing Safety & Monitoring Visual Testing Suite...');
  });

  test.afterAll(async () => {
    if (stagehand) {
      await stagehand.close();
    }
  });

  test('Safety Dashboard - Comprehensive System Health Overview', async () => {
    const page = stagehand.page;
    console.log('📊 Testing comprehensive safety dashboard interface');

    // Setup authenticated session
    await page.goto('http://localhost:3008/auth');
    await page.waitForLoadState('networkidle');
    
    await page.act(`Register user: name "${TEST_NAME}", email "${TEST_EMAIL}", password "${TEST_PASSWORD}"`);
    await page.waitForLoadState('networkidle');
    userId = `safety-test-${Date.now()}`;

    // Navigate to safety page
    await page.goto('http://localhost:3008/safety');
    await page.waitForLoadState('networkidle');

    // Analyze safety dashboard layout and structure
    const safetyDashboardAnalysis = await page.extract({
      instruction: "Analyze the comprehensive safety dashboard layout, components, and real-time monitoring displays",
      schema: z.object({
        dashboardStructure: z.object({
          hasOverviewSection: z.boolean(),
          hasRiskMetrics: z.boolean(),
          hasEmergencyControls: z.boolean(),
          hasAgentMonitoring: z.boolean(),
          hasAlertCenter: z.boolean()
        }),
        systemHealthDisplay: z.object({
          showsOverallStatus: z.boolean(),
          hasHealthIndicators: z.boolean(),
          showsRiskScore: z.boolean(),
          displaysActiveAlerts: z.boolean(),
          hasLastUpdateTime: z.boolean()
        }),
        visualDesign: z.object({
          clearStatusIndicators: z.boolean(),
          colorCodedHealth: z.boolean(),
          hierarchicalLayout: z.boolean(),
          responsiveDesign: z.boolean()
        }),
        realTimeFeatures: z.object({
          liveDataUpdates: z.boolean(),
          automaticRefresh: z.boolean(),
          websocketConnection: z.boolean(),
          realtimeCharts: z.boolean()
        })
      })
    });

    expect(safetyDashboardAnalysis.dashboardStructure.hasOverviewSection).toBe(true);
    expect(safetyDashboardAnalysis.systemHealthDisplay.showsOverallStatus).toBe(true);
    expect(safetyDashboardAnalysis.visualDesign.colorCodedHealth).toBe(true);
    expect(safetyDashboardAnalysis.realTimeFeatures.liveDataUpdates).toBe(true);
    console.log('✅ Safety dashboard structure validated');
  });

  test('Risk Assessment and Metrics - Real-time Monitoring Interface', async () => {
    const page = stagehand.page;
    console.log('📈 Testing risk assessment and metrics monitoring interface');

    // Navigate to safety dashboard
    await page.goto('http://localhost:3008/safety');
    await page.waitForLoadState('networkidle');

    // Analyze risk metrics interface
    const riskMetricsInterface = await page.extract({
      instruction: "Analyze risk assessment interface including metrics display, thresholds, and monitoring capabilities",
      schema: z.object({
        riskMetrics: z.object({
          showsPortfolioValue: z.boolean(),
          displaysTotalExposure: z.boolean(),
          showsDailyPnL: z.boolean(),
          hasValueAtRisk: z.boolean(),
          displaysMaxDrawdown: z.boolean()
        }),
        thresholdMonitoring: z.object({
          hasRiskThresholds: z.boolean(),
          showsWarningLevels: z.boolean(),
          displaysCriticalLevels: z.boolean(),
          hasThresholdIndicators: z.boolean()
        }),
        visualizations: z.object({
          hasRiskCharts: z.boolean(),
          showsTrendAnalysis: z.boolean(),
          displaysProgressBars: z.boolean(),
          hasColorCoding: z.boolean()
        }),
        alertsAndWarnings: z.object({
          showsActiveWarnings: z.boolean(),
          displaysCriticalAlerts: z.boolean(),
          hasNotificationSystem: z.boolean(),
          providesRiskGuidance: z.boolean()
        })
      })
    });

    expect(riskMetricsInterface.riskMetrics.showsPortfolioValue).toBe(true);
    expect(riskMetricsInterface.thresholdMonitoring.hasRiskThresholds).toBe(true);
    expect(riskMetricsInterface.visualizations.hasColorCoding).toBe(true);
    expect(riskMetricsInterface.alertsAndWarnings.hasNotificationSystem).toBe(true);

    // Test risk threshold interactions
    await page.act("Interact with risk threshold displays and monitoring controls");
    await page.waitForTimeout(2000);

    const riskInteractionTest = await page.extract({
      instruction: "Analyze risk threshold interaction behavior and real-time updates",
      schema: z.object({
        interactionBehavior: z.object({
          responsiveToActions: z.boolean(),
          providesDetailedView: z.boolean(),
          showsHistoricalData: z.boolean(),
          allowsThresholdAdjustment: z.boolean()
        }),
        realTimeUpdates: z.object({
          metricsUpdateLive: z.boolean(),
          thresholdsMonitored: z.boolean(),
          alertsTriggered: z.boolean(),
          dataConsistent: z.boolean()
        })
      })
    });

    expect(riskInteractionTest.interactionBehavior.responsiveToActions).toBe(true);
    expect(riskInteractionTest.realTimeUpdates.metricsUpdateLive).toBe(true);
    console.log('✅ Risk assessment interface validated');
  });

  test('Emergency Control Systems - Circuit Breakers and Safety Mechanisms', async () => {
    const page = stagehand.page;
    console.log('🚨 Testing emergency control systems and circuit breaker interface');

    // Navigate to safety dashboard
    await page.goto('http://localhost:3008/safety');
    await page.waitForLoadState('networkidle');

    // Look for emergency control systems
    const emergencyControlsTest = await page.observe({
      instruction: "Look for emergency control systems, circuit breakers, and safety override mechanisms",
      returnAction: true
    });

    if (emergencyControlsTest.length > 0) {
      console.log('🛑 Testing emergency control interface');

      const emergencySystemsAnalysis = await page.extract({
        instruction: "Analyze emergency control systems interface including circuit breakers, emergency stops, and safety overrides",
        schema: z.object({
          emergencyControls: z.object({
            hasEmergencyStopButton: z.boolean(),
            hasCircuitBreakers: z.boolean(),
            hasSafetyOverrides: z.boolean(),
            hasSystemHalt: z.boolean()
          }),
          circuitBreakerStatus: z.object({
            showsBreakerStates: z.boolean(),
            displaysFailureCounts: z.boolean(),
            hasRetryTimers: z.boolean(),
            showsLastFailures: z.boolean()
          }),
          safetyMechanisms: z.object({
            hasConfirmationDialogs: z.boolean(),
            requiresAuthentication: z.boolean(),
            providesRiskWarnings: z.boolean(),
            hasRecoveryProcedures: z.boolean()
          }),
          visualDesign: z.object({
            prominentPlacement: z.boolean(),
            clearDangerStyling: z.boolean(),
            accessibleControls: z.boolean(),
            unmistakableLabeling: z.boolean()
          })
        })
      });

      expect(emergencySystemsAnalysis.emergencyControls.hasEmergencyStopButton).toBe(true);
      expect(emergencySystemsAnalysis.circuitBreakerStatus.showsBreakerStates).toBe(true);
      expect(emergencySystemsAnalysis.safetyMechanisms.hasConfirmationDialogs).toBe(true);
      expect(emergencySystemsAnalysis.visualDesign.prominentPlacement).toBe(true);

      // Test emergency control accessibility (without activation)
      const emergencyAccessibilityTest = await page.extract({
        instruction: "Analyze emergency control accessibility and readiness without activating controls",
        schema: z.object({
          accessibility: z.object({
            controlsVisible: z.boolean(),
            controlsReachable: z.boolean(),
            keyboardAccessible: z.boolean(),
            clearInstructions: z.boolean()
          }),
          readiness: z.object({
            systemReady: z.boolean(),
            noBlockingConditions: z.boolean(),
            quickResponseCapable: z.boolean(),
            statusClear: z.boolean()
          })
        })
      });

      expect(emergencyAccessibilityTest.accessibility.controlsVisible).toBe(true);
      expect(emergencyAccessibilityTest.readiness.systemReady).toBe(true);
      console.log('✅ Emergency control systems validated');
    } else {
      console.log('ℹ️ Emergency controls not found or require specific access level');
    }
  });

  test('Agent Health Monitoring - Multi-Agent System Status', async () => {
    const page = stagehand.page;
    console.log('🤖 Testing agent health monitoring and multi-agent system status');

    // Navigate to safety dashboard
    await page.goto('http://localhost:3008/safety');
    await page.waitForLoadState('networkidle');

    // Analyze agent health monitoring interface
    const agentHealthInterface = await page.extract({
      instruction: "Analyze agent health monitoring interface including individual agent status, response times, and anomaly detection",
      schema: z.object({
        agentOverview: z.object({
          showsTotalAgents: z.boolean(),
          displaysHealthyCount: z.boolean(),
          showsDegradedCount: z.boolean(),
          displaysCriticalCount: z.boolean()
        }),
        individualAgentStatus: z.object({
          showsAgentDetails: z.boolean(),
          displaysResponseTimes: z.boolean(),
          showsSuccessRates: z.boolean(),
          hasLastActivityTime: z.boolean()
        }),
        anomalyDetection: z.object({
          hasAnomalyScores: z.boolean(),
          showsAnomalyAlerts: z.boolean(),
          displaysPatternAnalysis: z.boolean(),
          providesRecommendations: z.boolean()
        }),
        performanceMetrics: z.object({
          showsPerformanceTrends: z.boolean(),
          displaysEfficiencyMetrics: z.boolean(),
          hasComparisonViews: z.boolean(),
          providesOptimizationSuggestions: z.boolean()
        })
      })
    });

    expect(agentHealthInterface.agentOverview.showsTotalAgents).toBe(true);
    expect(agentHealthInterface.individualAgentStatus.showsAgentDetails).toBe(true);
    expect(agentHealthInterface.performanceMetrics.showsPerformanceTrends).toBe(true);

    // Test agent status drill-down functionality
    await page.act("Click on agent details to test drill-down functionality and detailed monitoring");
    await page.waitForTimeout(2000);

    const agentDetailTest = await page.extract({
      instruction: "Analyze agent detail view and monitoring capabilities",
      schema: z.object({
        detailView: z.object({
          showsDetailedMetrics: z.boolean(),
          hasPerformanceHistory: z.boolean(),
          displaysErrorLogs: z.boolean(),
          providesControlActions: z.boolean()
        }),
        monitoringCapabilities: z.object({
          realtimeMetrics: z.boolean(),
          historicalTrends: z.boolean(),
          alertConfiguration: z.boolean(),
          performanceBaselines: z.boolean()
        })
      })
    });

    expect(agentDetailTest.detailView.showsDetailedMetrics).toBe(true);
    expect(agentDetailTest.monitoringCapabilities.realtimeMetrics).toBe(true);
    console.log('✅ Agent health monitoring validated');
  });

  test('Alert Management System - Notification and Response Interface', async () => {
    const page = stagehand.page;
    console.log('🔔 Testing alert management and notification system interface');

    // Navigate to safety dashboard
    await page.goto('http://localhost:3008/safety');
    await page.waitForLoadState('networkidle');

    // Analyze alert management interface
    const alertManagementInterface = await page.extract({
      instruction: "Analyze alert management system including notification display, severity levels, and response actions",
      schema: z.object({
        alertDisplay: z.object({
          showsActiveAlerts: z.boolean(),
          displaysSeverityLevels: z.boolean(),
          hasAlertTimestamps: z.boolean(),
          showsAlertCategories: z.boolean()
        }),
        notificationSystem: z.object({
          hasNotificationCenter: z.boolean(),
          showsNotificationBadges: z.boolean(),
          displaysAlertHistory: z.boolean(),
          hasFilteringOptions: z.boolean()
        }),
        responseActions: z.object({
          hasAcknowledgeActions: z.boolean(),
          providesResponseOptions: z.boolean(),
          showsEscalationPaths: z.boolean(),
          hasResolutionTracking: z.boolean()
        }),
        alertConfiguration: z.object({
          hasThresholdSettings: z.boolean(),
          allowsCustomAlerts: z.boolean(),
          hasNotificationPreferences: z.boolean(),
          providesAlertTesting: z.boolean()
        })
      })
    });

    expect(alertManagementInterface.alertDisplay.showsActiveAlerts).toBe(true);
    expect(alertManagementInterface.notificationSystem.hasNotificationCenter).toBe(true);
    expect(alertManagementInterface.responseActions.hasAcknowledgeActions).toBe(true);

    // Test alert interaction workflow
    await page.act("Interact with alert system to test acknowledgment and response workflow");
    await page.waitForTimeout(2000);

    const alertInteractionTest = await page.extract({
      instruction: "Analyze alert interaction workflow and response capabilities",
      schema: z.object({
        interactionWorkflow: z.object({
          allowsAcknowledgment: z.boolean(),
          providesResponseOptions: z.boolean(),
          hasEscalationControls: z.boolean(),
          tracksResolution: z.boolean()
        }),
        userExperience: z.object({
          clearActionPath: z.boolean(),
          intuitiveInterface: z.boolean(),
          appropriateFeedback: z.boolean(),
          efficientWorkflow: z.boolean()
        })
      })
    });

    expect(alertInteractionTest.interactionWorkflow.allowsAcknowledgment).toBe(true);
    expect(alertInteractionTest.userExperience.clearActionPath).toBe(true);
    console.log('✅ Alert management system validated');
  });

  test('System Architecture Overview - Component Health and Dependencies', async () => {
    const page = stagehand.page;
    console.log('🏗️ Testing system architecture overview and component health monitoring');

    // Check if monitoring page exists for system architecture
    try {
      await page.goto('http://localhost:3008/monitoring');
      await page.waitForLoadState('networkidle');
    } catch {
      // If monitoring page doesn't exist, test within safety dashboard
      await page.goto('http://localhost:3008/safety');
      await page.waitForLoadState('networkidle');
    }

    // Analyze system architecture overview
    const architectureOverview = await page.extract({
      instruction: "Analyze system architecture overview including component health, dependencies, and system topology",
      schema: z.object({
        componentHealth: z.object({
          showsSystemComponents: z.boolean(),
          displaysComponentStatus: z.boolean(),
          hasHealthIndicators: z.boolean(),
          showsPerformanceMetrics: z.boolean()
        }),
        dependencyMapping: z.object({
          showsDependencies: z.boolean(),
          displaysConnectionStatus: z.boolean(),
          hasTopologyView: z.boolean(),
          showsDataFlow: z.boolean()
        }),
        monitoringCapabilities: z.object({
          realtimeComponentStatus: z.boolean(),
          historicalPerformance: z.boolean(),
          predictiveAnalytics: z.boolean(),
          capacityPlanning: z.boolean()
        }),
        troubleshootingTools: z.object({
          hasComponentDrillDown: z.boolean(),
          providesLogsAccess: z.boolean(),
          hasPerformanceAnalysis: z.boolean(),
          offersResolutionGuidance: z.boolean()
        })
      })
    });

    expect(architectureOverview.componentHealth.showsSystemComponents).toBe(true);
    expect(architectureOverview.monitoringCapabilities.realtimeComponentStatus).toBe(true);

    // Test system component interaction
    await page.act("Interact with system components to test detailed monitoring and troubleshooting capabilities");
    await page.waitForTimeout(2000);

    const componentInteractionTest = await page.extract({
      instruction: "Analyze system component interaction and detailed monitoring capabilities",
      schema: z.object({
        detailedMonitoring: z.object({
          providesComponentDetails: z.boolean(),
          showsPerformanceGraphs: z.boolean(),
          hasErrorAnalysis: z.boolean(),
          displaysResourceUsage: z.boolean()
        }),
        systemInsights: z.object({
          identifiesBottlenecks: z.boolean(),
          predictsFailures: z.boolean(),
          recommendsOptimizations: z.boolean(),
          tracksSystemEvolution: z.boolean()
        })
      })
    });

    expect(componentInteractionTest.detailedMonitoring.providesComponentDetails).toBe(true);
    console.log('✅ System architecture overview validated');
  });
});