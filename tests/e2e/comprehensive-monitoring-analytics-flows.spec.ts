import { test, expect } from '@playwright/test';
import { AuthPage, DashboardPage, MonitoringPage } from './pages';
import { E2EHelpers } from './utils/e2e-test-helpers';

test.describe('Comprehensive Monitoring and Analytics Flow Tests', () => {
  let authPage: AuthPage;
  let dashboardPage: DashboardPage;
  let monitoringPage: MonitoringPage;
  let helpers: E2EHelpers;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    dashboardPage = new DashboardPage(page);
    monitoringPage = new MonitoringPage(page);
    helpers = new E2EHelpers(page);

    // Authenticate user before each test
    await helpers.auth.signIn();
  });

  test.describe('Real-time Performance Monitoring', () => {
    test('should display real-time system performance metrics', async () => {
      await monitoringPage.navigate();
      
      // Verify real-time metrics dashboard
      await expect(monitoringPage.page.locator('[data-testid="realtime-metrics"]')).toBeVisible();
      await expect(monitoringPage.page.locator('[data-testid="cpu-usage"]')).toBeVisible();
      await expect(monitoringPage.page.locator('[data-testid="memory-usage"]')).toBeVisible();
      await expect(monitoringPage.page.locator('[data-testid="network-io"]')).toBeVisible();
      
      // Verify metrics are updating
      const initialMetrics = await monitoringPage.getCurrentMetrics();
      await helpers.wait.waitForElement('[data-testid="metrics-updated"]', 10000);
      const updatedMetrics = await monitoringPage.getCurrentMetrics();
      
      expect(updatedMetrics.timestamp).not.toBe(initialMetrics.timestamp);
      expect(updatedMetrics.cpuUsage).toBeDefined();
      expect(updatedMetrics.memoryUsage).toBeDefined();
    });

    test('should handle performance threshold alerts', async () => {
      await monitoringPage.navigate();
      
      // Configure performance thresholds
      await monitoringPage.setPerformanceThresholds({
        cpuUsage: 80,
        memoryUsage: 85,
        responseTime: 2000,
        errorRate: 5
      });
      
      // Simulate high resource usage
      await helpers.api.interceptResponse('**/api/monitoring/real-time**', {
        cpuUsage: 90, // Above threshold
        memoryUsage: 95, // Above threshold
        responseTime: 3000, // Above threshold
        errorRate: 8 // Above threshold
      });
      
      await monitoringPage.refreshMetrics();
      
      // Verify alerts are triggered
      await expect(monitoringPage.page.locator('[data-testid="performance-alert"]')).toBeVisible();
      const alertCount = await monitoringPage.getActiveAlertCount();
      expect(alertCount).toBeGreaterThan(0);
    });

    test('should track trading system performance', async () => {
      await monitoringPage.navigateToTradingMetrics();
      
      // Verify trading performance metrics
      await expect(monitoringPage.page.locator('[data-testid="trading-latency"]')).toBeVisible();
      await expect(monitoringPage.page.locator('[data-testid="order-execution-time"]')).toBeVisible();
      await expect(monitoringPage.page.locator('[data-testid="pattern-detection-performance"]')).toBeVisible();
      
      const tradingMetrics = await monitoringPage.getTradingPerformanceMetrics();
      expect(tradingMetrics.avgOrderExecutionTime).toBeDefined();
      expect(tradingMetrics.patternDetectionLatency).toBeDefined();
      expect(tradingMetrics.successRate).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Trading Analytics and Insights', () => {
    test('should display comprehensive trading analytics', async () => {
      await monitoringPage.navigateToTradingAnalytics();
      
      // Verify analytics dashboard components
      await expect(monitoringPage.page.locator('[data-testid="profit-loss-chart"]')).toBeVisible();
      await expect(monitoringPage.page.locator('[data-testid="win-rate-metrics"]')).toBeVisible();
      await expect(monitoringPage.page.locator('[data-testid="trading-volume"]')).toBeVisible();
      await expect(monitoringPage.page.locator('[data-testid="risk-metrics"]')).toBeVisible();
      
      // Verify analytics data
      const analytics = await monitoringPage.getTradingAnalytics();
      expect(analytics.totalTrades).toBeGreaterThanOrEqual(0);
      expect(analytics.winRate).toBeDefined();
      expect(analytics.avgProfitPerTrade).toBeDefined();
      expect(analytics.sharpeRatio).toBeDefined();
    });

    test('should filter analytics by time periods', async () => {
      await monitoringPage.navigateToTradingAnalytics();
      
      // Test different time period filters
      const timePeriods = ['1d', '7d', '30d', '90d', 'ytd'];
      
      for (const period of timePeriods) {
        await monitoringPage.selectTimePeriod(period);
        await helpers.wait.waitForElement('[data-testid="analytics-updated"]', 5000);
        
        const analytics = await monitoringPage.getTradingAnalytics();
        expect(analytics.timePeriod).toBe(period);
        expect(analytics.totalTrades).toBeGreaterThanOrEqual(0);
      }
    });

    test('should display pattern detection analytics', async () => {
      await monitoringPage.navigateToPatternAnalytics();
      
      // Verify pattern analytics components
      await expect(monitoringPage.page.locator('[data-testid="pattern-success-rate"]')).toBeVisible();
      await expect(monitoringPage.page.locator('[data-testid="pattern-frequency"]')).toBeVisible();
      await expect(monitoringPage.page.locator('[data-testid="confidence-distribution"]')).toBeVisible();
      
      const patternAnalytics = await monitoringPage.getPatternAnalytics();
      expect(patternAnalytics.totalPatterns).toBeGreaterThanOrEqual(0);
      expect(patternAnalytics.avgConfidence).toBeDefined();
      expect(patternAnalytics.successfulTargets).toBeGreaterThanOrEqual(0);
    });

    test('should generate trading performance reports', async () => {
      await monitoringPage.navigateToTradingAnalytics();
      
      // Configure report parameters
      const reportConfig = {
        dateRange: {
          start: '2025-01-01',
          end: '2025-07-04'
        },
        includeMetrics: ['profit_loss', 'win_rate', 'volume', 'risk'],
        groupBy: 'daily',
        format: 'detailed'
      };
      
      await monitoringPage.generateTradingReport(reportConfig);
      
      // Wait for report generation
      await helpers.wait.waitForElement('[data-testid="report-generated"]', 30000);
      
      // Verify report is ready
      const reportStatus = await monitoringPage.getReportGenerationStatus();
      expect(reportStatus).toBe('completed');
      
      // Preview report
      await monitoringPage.previewGeneratedReport();
      await expect(monitoringPage.page.locator('[data-testid="report-preview"]')).toBeVisible();
    });
  });

  test.describe('Risk Monitoring and Analysis', () => {
    test('should display comprehensive risk metrics', async () => {
      await monitoringPage.navigateToRiskMonitoring();
      
      // Verify risk monitoring components
      await expect(monitoringPage.page.locator('[data-testid="portfolio-risk"]')).toBeVisible();
      await expect(monitoringPage.page.locator('[data-testid="var-calculation"]')).toBeVisible();
      await expect(monitoringPage.page.locator('[data-testid="drawdown-analysis"]')).toBeVisible();
      await expect(monitoringPage.page.locator('[data-testid="concentration-risk"]')).toBeVisible();
      
      const riskMetrics = await monitoringPage.getRiskMetrics();
      expect(riskMetrics.portfolioVaR).toBeDefined();
      expect(riskMetrics.maxDrawdown).toBeDefined();
      expect(riskMetrics.concentrationRisk).toBeDefined();
      expect(riskMetrics.riskScore).toBeGreaterThanOrEqual(0);
    });

    test('should handle risk limit monitoring', async () => {
      await monitoringPage.navigateToRiskMonitoring();
      
      // Configure risk limits
      const riskLimits = {
        maxDailyLoss: 1000,
        maxDrawdown: 15,
        maxPositionSize: 500,
        maxConcentration: 20
      };
      
      await monitoringPage.configureRiskLimits(riskLimits);
      
      // Simulate risk limit breach
      await helpers.api.interceptResponse('**/api/safety/risk-assessment**', {
        currentDailyLoss: 1200, // Above limit
        currentDrawdown: 18, // Above limit
        largestPosition: 600, // Above limit
        riskLimitsBreach: ['daily_loss', 'drawdown', 'position_size']
      });
      
      await monitoringPage.refreshRiskMetrics();
      
      // Verify risk alerts
      await expect(monitoringPage.page.locator('[data-testid="risk-limit-alert"]')).toBeVisible();
      const breaches = await monitoringPage.getRiskLimitBreaches();
      expect(breaches.length).toBeGreaterThan(0);
    });

    test('should provide risk scenario analysis', async () => {
      await monitoringPage.navigateToRiskMonitoring();
      
      // Run stress test scenarios
      const scenarios = [
        { name: 'market_crash', marketDrop: 20 },
        { name: 'volatility_spike', volatilityIncrease: 50 },
        { name: 'liquidity_crisis', liquidityReduction: 30 }
      ];
      
      for (const scenario of scenarios) {
        await monitoringPage.runStressTestScenario(scenario);
        await helpers.wait.waitForElement('[data-testid="scenario-complete"]', 15000);
        
        const results = await monitoringPage.getScenarioResults(scenario.name);
        expect(results.portfolioImpact).toBeDefined();
        expect(results.worstCaseScenario).toBeDefined();
        expect(results.recommendations).toBeTruthy();
      }
    });
  });

  test.describe('Market Data and Pattern Monitoring', () => {
    test('should display market data analytics', async () => {
      await monitoringPage.navigateToMarketData();
      
      // Verify market data components
      await expect(monitoringPage.page.locator('[data-testid="market-overview"]')).toBeVisible();
      await expect(monitoringPage.page.locator('[data-testid="volatility-index"]')).toBeVisible();
      await expect(monitoringPage.page.locator('[data-testid="correlation-matrix"]')).toBeVisible();
      await expect(monitoringPage.page.locator('[data-testid="market-sentiment"]')).toBeVisible();
      
      const marketData = await monitoringPage.getMarketDataAnalytics();
      expect(marketData.marketCap).toBeDefined();
      expect(marketData.volatilityIndex).toBeDefined();
      expect(marketData.sentiment).toBeTruthy();
    });

    test('should monitor pattern detection quality', async () => {
      await monitoringPage.navigateToPatternMonitoring();
      
      // Verify pattern quality metrics
      await expect(monitoringPage.page.locator('[data-testid="pattern-accuracy"]')).toBeVisible();
      await expect(monitoringPage.page.locator('[data-testid="false-positive-rate"]')).toBeVisible();
      await expect(monitoringPage.page.locator('[data-testid="detection-latency"]')).toBeVisible();
      
      const patternQuality = await monitoringPage.getPatternQualityMetrics();
      expect(patternQuality.accuracy).toBeGreaterThanOrEqual(0);
      expect(patternQuality.falsePositiveRate).toBeGreaterThanOrEqual(0);
      expect(patternQuality.avgDetectionTime).toBeDefined();
    });

    test('should track new listing performance', async () => {
      await monitoringPage.navigateToListingAnalytics();
      
      // Verify listing analytics
      await expect(monitoringPage.page.locator('[data-testid="listing-success-rate"]')).toBeVisible();
      await expect(monitoringPage.page.locator('[data-testid="avg-listing-return"]')).toBeVisible();
      await expect(monitoringPage.page.locator('[data-testid="listing-volume-analysis"]')).toBeVisible();
      
      const listingAnalytics = await monitoringPage.getListingAnalytics();
      expect(listingAnalytics.totalListings).toBeGreaterThanOrEqual(0);
      expect(listingAnalytics.successRate).toBeDefined();
      expect(listingAnalytics.avgReturn).toBeDefined();
    });
  });

  test.describe('System Health and Alerting', () => {
    test('should monitor system component health', async () => {
      await monitoringPage.navigateToSystemHealth();
      
      // Verify all system components are monitored
      const components = [
        'database',
        'api_server',
        'websocket_server',
        'trading_engine',
        'pattern_detector',
        'risk_engine',
        'notification_service'
      ];
      
      for (const component of components) {
        await expect(monitoringPage.page.locator(`[data-testid="${component}-health"]`)).toBeVisible();
        
        const health = await monitoringPage.getComponentHealth(component);
        expect(['healthy', 'warning', 'critical']).toContain(health.status);
        expect(health.uptime).toBeDefined();
        expect(health.lastCheck).toBeTruthy();
      }
    });

    test('should handle cascade failure detection', async () => {
      await monitoringPage.navigateToSystemHealth();
      
      // Simulate cascade failure
      await helpers.api.interceptResponse('**/api/health/**', {
        database: { status: 'critical', message: 'Connection failed' },
        api_server: { status: 'warning', message: 'Degraded performance' },
        trading_engine: { status: 'critical', message: 'Service unavailable' }
      });
      
      await monitoringPage.refreshSystemHealth();
      
      // Verify cascade failure detection
      await expect(monitoringPage.page.locator('[data-testid="cascade-failure-alert"]')).toBeVisible();
      
      const cascadeAnalysis = await monitoringPage.getCascadeFailureAnalysis();
      expect(cascadeAnalysis.primaryFailure).toBe('database');
      expect(cascadeAnalysis.affectedComponents).toContain('trading_engine');
      expect(cascadeAnalysis.impactLevel).toBe('critical');
    });

    test('should manage alert escalation workflows', async () => {
      await monitoringPage.navigateToAlertManagement();
      
      // Configure alert escalation rules
      const escalationRules = {
        criticalAlerts: {
          immediateNotification: true,
          escalateAfter: 5, // minutes
          escalationLevels: ['admin', 'senior_admin', 'emergency_contact']
        },
        warningAlerts: {
          batchNotification: true,
          escalateAfter: 30,
          escalationLevels: ['admin']
        }
      };
      
      await monitoringPage.configureAlertEscalation(escalationRules);
      
      // Simulate critical alert
      await monitoringPage.triggerTestAlert('critical', 'Database connection lost');
      
      // Verify alert is created and escalation starts
      const alertStatus = await monitoringPage.getAlertStatus();
      expect(alertStatus.level).toBe('critical');
      expect(alertStatus.escalationStarted).toBe(true);
    });
  });

  test.describe('Custom Analytics and Dashboards', () => {
    test('should create custom dashboard', async () => {
      await monitoringPage.navigateToCustomDashboards();
      
      // Create new dashboard
      const dashboardConfig = {
        name: 'Custom Trading Dashboard',
        widgets: [
          { type: 'profit_loss_chart', size: 'large', position: { x: 0, y: 0 } },
          { type: 'win_rate_gauge', size: 'medium', position: { x: 1, y: 0 } },
          { type: 'active_trades_table', size: 'large', position: { x: 0, y: 1 } },
          { type: 'risk_metrics', size: 'medium', position: { x: 1, y: 1 } }
        ],
        autoRefresh: true,
        refreshInterval: 30
      };
      
      await monitoringPage.createCustomDashboard(dashboardConfig);
      
      // Verify dashboard is created
      const hasSuccess = await monitoringPage.hasSuccessMessage();
      expect(hasSuccess).toBe(true);
      
      // Verify dashboard is accessible
      await monitoringPage.viewCustomDashboard('Custom Trading Dashboard');
      await expect(monitoringPage.page.locator('[data-testid="custom-dashboard"]')).toBeVisible();
    });

    test('should configure custom metrics and KPIs', async () => {
      await monitoringPage.navigateToCustomMetrics();
      
      // Define custom KPIs
      const customKPIs = [
        {
          name: 'Profit Per Hour',
          formula: 'total_profit / trading_hours',
          target: 50,
          threshold: { warning: 30, critical: 10 }
        },
        {
          name: 'Pattern Accuracy Rate',
          formula: 'successful_patterns / total_patterns * 100',
          target: 85,
          threshold: { warning: 70, critical: 50 }
        }
      ];
      
      for (const kpi of customKPIs) {
        await monitoringPage.createCustomKPI(kpi);
        
        // Verify KPI is created
        const kpiExists = await monitoringPage.customKPIExists(kpi.name);
        expect(kpiExists).toBe(true);
      }
      
      // Calculate and display KPIs
      await monitoringPage.refreshCustomKPIs();
      
      const kpiValues = await monitoringPage.getCustomKPIValues();
      expect(kpiValues['Profit Per Hour']).toBeDefined();
      expect(kpiValues['Pattern Accuracy Rate']).toBeDefined();
    });

    test('should export analytics data', async () => {
      await monitoringPage.navigateToDataExport();
      
      // Configure data export
      const exportConfig = {
        dataTypes: ['trading_history', 'performance_metrics', 'risk_metrics'],
        format: 'csv',
        dateRange: 'last_30_days',
        includeHeaders: true,
        compression: true
      };
      
      await monitoringPage.configureDataExport(exportConfig);
      await monitoringPage.startDataExport();
      
      // Wait for export completion
      await helpers.wait.waitForElement('[data-testid="export-complete"]', 60000);
      
      // Verify export is ready
      const exportStatus = await monitoringPage.getExportStatus();
      expect(exportStatus).toBe('completed');
      
      // Download exported data
      await monitoringPage.downloadExportedData();
      
      const downloadStarted = await monitoringPage.isDownloadStarted();
      expect(downloadStarted).toBe(true);
    });
  });

  test.describe('Monitoring Performance and Reliability', () => {
    test('should handle high-frequency data updates', async () => {
      await monitoringPage.navigate();
      
      // Enable high-frequency mode
      await monitoringPage.enableHighFrequencyMode();
      
      // Monitor for data consistency
      const updateCount = 10;
      let consecutiveUpdates = 0;
      
      for (let i = 0; i < updateCount; i++) {
        await helpers.wait.waitForElement('[data-testid="metrics-updated"]', 5000);
        consecutiveUpdates++;
        await monitoringPage.page.waitForTimeout(1000);
      }
      
      expect(consecutiveUpdates).toBe(updateCount);
      
      // Verify no performance degradation
      const performanceMetrics = await helpers.performance.getPerformanceMetrics();
      expect(performanceMetrics.domContentLoaded).toBeLessThan(3000);
    });

    test('should handle monitoring during system stress', async () => {
      await monitoringPage.navigate();
      
      // Simulate system stress
      const stressPromises = [];
      for (let i = 0; i < 10; i++) {
        stressPromises.push(monitoringPage.refreshAllMetrics());
      }
      
      await Promise.allSettled(stressPromises);
      
      // Verify monitoring remains functional
      const systemHealth = await monitoringPage.getSystemHealthStatus();
      expect(systemHealth).toBeTruthy();
      
      // Verify no memory leaks
      const memoryUsage = await monitoringPage.getCurrentMetrics();
      expect(memoryUsage.memoryUsage).toBeLessThan(90); // Should not exceed 90%
    });

    test('should handle monitoring failover scenarios', async ({ page }) => {
      await monitoringPage.navigate();
      
      // Simulate primary monitoring service failure
      await helpers.api.interceptError('**/api/monitoring/real-time**', 503);
      
      await monitoringPage.refreshMetrics();
      
      // Should fallback to alternative data sources
      await expect(monitoringPage.page.locator('[data-testid="fallback-mode"]')).toBeVisible();
      
      // Restore primary service
      await helpers.api.clearRoutes();
      await monitoringPage.refreshMetrics();
      
      // Should recover to normal mode
      const normalMode = await monitoringPage.isNormalModeActive();
      expect(normalMode).toBe(true);
    });
  });
});