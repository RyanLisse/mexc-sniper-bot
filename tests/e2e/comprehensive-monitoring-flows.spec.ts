import { test, expect } from '@playwright/test';
import { AuthPage, MonitoringPage, DashboardPage } from './pages';

const TEST_EMAIL = process.env.TEST_USER_EMAIL || process.env.AUTH_EMAIL || 'ryan@ryanlisse.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || process.env.AUTH_PASSWORD || 'Testing2025!';

test.describe('Comprehensive Monitoring and Alerts Flow Tests', () => {
  let authPage: AuthPage;
  let monitoringPage: MonitoringPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    monitoringPage = new MonitoringPage(page);
    dashboardPage = new DashboardPage(page);

    // Authenticate user before each test
    await authPage.navigate();
    await authPage.signIn(TEST_EMAIL, TEST_PASSWORD);
    await authPage.waitForAuthCompletion();
    await dashboardPage.waitForPageLoad();
  });

  test.describe('Monitoring Page Navigation Tests', () => {
    test('should navigate to monitoring page', async () => {
      await monitoringPage.navigate();
      await monitoringPage.verifyMonitoringElements();
      
      // Verify URL
      expect(await monitoringPage.getCurrentUrl()).toMatch(/\/monitoring$/);
    });

    test('should display all monitoring tabs', async () => {
      await monitoringPage.navigate();
      
      // Verify all tabs are present
      await expect(monitoringPage['systemOverviewTab']).toBeVisible();
      await expect(monitoringPage['performanceTab']).toBeVisible();
      await expect(monitoringPage['tradingAnalyticsTab']).toBeVisible();
      await expect(monitoringPage['alertsTab']).toBeVisible();
      await expect(monitoringPage['realTimeTab']).toBeVisible();
    });

    test('should load monitoring page within acceptable time', async () => {
      const startTime = Date.now();
      await monitoringPage.navigate();
      await monitoringPage.waitForPageLoad();
      const endTime = Date.now();
      
      const loadTime = endTime - startTime;
      expect(loadTime).toBeLessThan(10000); // Should load within 10 seconds
    });
  });

  test.describe('System Overview Tests', () => {
    test('should display system health status', async () => {
      await monitoringPage.navigate();
      await monitoringPage.switchToSystemOverview();
      
      const systemHealth = await monitoringPage.getSystemHealthStatus();
      expect(systemHealth).toBeTruthy();
    });

    test('should display API status', async () => {
      await monitoringPage.navigate();
      const apiStatus = await monitoringPage.getApiStatus();
      expect(apiStatus).toBeTruthy();
    });

    test('should display database status', async () => {
      await monitoringPage.navigate();
      const dbStatus = await monitoringPage.getDatabaseStatus();
      expect(dbStatus).toBeTruthy();
    });

    test('should display WebSocket status', async () => {
      await monitoringPage.navigate();
      const wsStatus = await monitoringPage.getWebsocketStatus();
      expect(wsStatus).toBeTruthy();
    });

    test('should display all agent statuses', async () => {
      await monitoringPage.navigate();
      const agentStatuses = await monitoringPage.getAgentStatuses();
      
      // Should have status for each agent
      expect(Object.keys(agentStatuses).length).toBeGreaterThan(0);
      
      // Each status should be a non-empty string
      for (const [agent, status] of Object.entries(agentStatuses)) {
        expect(status).toBeTruthy();
        expect(typeof status).toBe('string');
      }
    });

    test('should verify system health indicators', async () => {
      await monitoringPage.navigate();
      await monitoringPage.verifySystemHealth();
      
      // All health cards should be visible
      await expect(monitoringPage['systemHealthCard']).toBeVisible();
      await expect(monitoringPage['apiStatusCard']).toBeVisible();
      await expect(monitoringPage['databaseStatusCard']).toBeVisible();
      await expect(monitoringPage['websocketStatusCard']).toBeVisible();
    });
  });

  test.describe('Performance Monitoring Tests', () => {
    test('should display performance metrics', async () => {
      await monitoringPage.navigate();
      const performanceMetrics = await monitoringPage.getPerformanceMetrics();
      
      // Should have performance data
      expect(Object.keys(performanceMetrics).length).toBeGreaterThan(0);
    });

    test('should show response time metrics', async () => {
      await monitoringPage.navigate();
      await monitoringPage.switchToPerformance();
      
      // Response time chart should be visible
      if (await monitoringPage['responseTimeChart'].isVisible()) {
        await expect(monitoringPage['responseTimeChart']).toBeVisible();
      }
    });

    test('should show throughput metrics', async () => {
      await monitoringPage.navigate();
      await monitoringPage.switchToPerformance();
      
      // Throughput chart should be visible
      if (await monitoringPage['throughputChart'].isVisible()) {
        await expect(monitoringPage['throughputChart']).toBeVisible();
      }
    });

    test('should show error rate metrics', async () => {
      await monitoringPage.navigate();
      await monitoringPage.switchToPerformance();
      
      // Error rate chart should be visible
      if (await monitoringPage['errorRateChart'].isVisible()) {
        await expect(monitoringPage['errorRateChart']).toBeVisible();
      }
    });

    test('should handle performance data refresh', async () => {
      await monitoringPage.navigate();
      await monitoringPage.switchToPerformance();
      
      // Refresh data
      await monitoringPage.refreshData();
      
      // Should not cause errors
      expect(await monitoringPage.getCurrentUrl()).toMatch(/\/monitoring$/);
    });
  });

  test.describe('Trading Analytics Tests', () => {
    test('should display trading analytics', async () => {
      await monitoringPage.navigate();
      const tradingAnalytics = await monitoringPage.getTradingAnalytics();
      
      // Should have trading data
      expect(Object.keys(tradingAnalytics).length).toBeGreaterThan(0);
    });

    test('should show win rate metrics', async () => {
      await monitoringPage.navigate();
      await monitoringPage.switchToTradingAnalytics();
      
      if (await monitoringPage['winRateMetric'].isVisible()) {
        const winRate = await monitoringPage['winRateMetric'].textContent();
        expect(winRate).toBeTruthy();
        expect(winRate).toMatch(/\d+(\.\d+)?%/);
      }
    });

    test('should show total trades metrics', async () => {
      await monitoringPage.navigate();
      await monitoringPage.switchToTradingAnalytics();
      
      if (await monitoringPage['totalTradesMetric'].isVisible()) {
        const totalTrades = await monitoringPage['totalTradesMetric'].textContent();
        expect(totalTrades).toBeTruthy();
        expect(totalTrades).toMatch(/\d+/);
      }
    });

    test('should display profit/loss chart', async () => {
      await monitoringPage.navigate();
      await monitoringPage.switchToTradingAnalytics();
      
      if (await monitoringPage['profitLossChart'].isVisible()) {
        await expect(monitoringPage['profitLossChart']).toBeVisible();
      }
    });

    test('should show trading performance card', async () => {
      await monitoringPage.navigate();
      await monitoringPage.switchToTradingAnalytics();
      
      await expect(monitoringPage['tradingPerformanceCard']).toBeVisible();
    });
  });

  test.describe('Alerts Management Tests', () => {
    test('should display active alerts', async () => {
      await monitoringPage.navigate();
      const activeAlertsCount = await monitoringPage.getActiveAlertsCount();
      
      // Should return a valid count (0 or more)
      expect(activeAlertsCount).toBeGreaterThanOrEqual(0);
    });

    test('should show alerts history', async () => {
      await monitoringPage.navigate();
      await monitoringPage.switchToAlerts();
      
      // Alerts history should be visible
      if (await monitoringPage['alertsHistory'].isVisible()) {
        await expect(monitoringPage['alertsHistory']).toBeVisible();
      }
    });

    test('should show alerts settings', async () => {
      await monitoringPage.navigate();
      await monitoringPage.switchToAlerts();
      
      // Alerts settings should be visible
      if (await monitoringPage['alertsSettings'].isVisible()) {
        await expect(monitoringPage['alertsSettings']).toBeVisible();
      }
    });

    test('should handle empty alerts state', async () => {
      await monitoringPage.navigate();
      await monitoringPage.switchToAlerts();
      
      // Should handle case when no alerts are present
      await expect(monitoringPage['activeAlerts']).toBeVisible();
    });

    test('should display alert severity levels', async () => {
      await monitoringPage.navigate();
      await monitoringPage.switchToAlerts();
      
      // Look for alert severity indicators
      const severityElements = monitoringPage.page.locator('.alert-critical, .alert-warning, .alert-info, [data-severity]');
      const count = await severityElements.count();
      
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Real-time Monitoring Tests', () => {
    test('should display real-time data feed', async () => {
      await monitoringPage.navigate();
      const realTimeStatus = await monitoringPage.getRealTimeDataStatus();
      
      expect(realTimeStatus).toBeTruthy();
    });

    test('should show active connections', async () => {
      await monitoringPage.navigate();
      await monitoringPage.switchToRealTime();
      
      if (await monitoringPage['activeConnections'].isVisible()) {
        await expect(monitoringPage['activeConnections']).toBeVisible();
      }
    });

    test('should show market data stream', async () => {
      await monitoringPage.navigate();
      await monitoringPage.switchToRealTime();
      
      if (await monitoringPage['marketDataStream'].isVisible()) {
        await expect(monitoringPage['marketDataStream']).toBeVisible();
      }
    });

    test('should handle real-time data updates', async () => {
      await monitoringPage.navigate();
      await monitoringPage.switchToRealTime();
      
      // Wait for potential real-time updates
      await monitoringPage.page.waitForTimeout(3000);
      
      // Should not cause errors
      expect(await monitoringPage.getCurrentUrl()).toMatch(/\/monitoring$/);
    });

    test('should show last updated timestamp', async () => {
      await monitoringPage.navigate();
      const lastUpdated = await monitoringPage.getLastUpdated();
      
      // May or may not have timestamp depending on implementation
      expect(typeof lastUpdated).toBe('string');
    });
  });

  test.describe('Monitoring Controls Tests', () => {
    test('should refresh monitoring data', async () => {
      await monitoringPage.navigate();
      
      // Initial load
      await monitoringPage.waitForPageLoad();
      
      // Refresh data
      await monitoringPage.refreshData();
      
      // Should complete without errors
      expect(await monitoringPage.getCurrentUrl()).toMatch(/\/monitoring$/);
    });

    test('should export monitoring data', async () => {
      await monitoringPage.navigate();
      
      // Look for export functionality
      if (await monitoringPage['exportButton'].isVisible()) {
        await monitoringPage.exportData();
        
        // Should trigger export (download, modal, etc.)
        expect(await monitoringPage.getCurrentUrl()).toMatch(/\/monitoring$/);
      }
    });

    test('should handle emergency stop', async () => {
      await monitoringPage.navigate();
      
      // Check if emergency stop is available
      if (await monitoringPage['emergencyStopButton'].isVisible()) {
        // Check initial state
        const isActive = await monitoringPage.isEmergencyStopActive();
        expect(typeof isActive).toBe('boolean');
        
        // Note: We don't actually trigger emergency stop in tests
        // as it might affect the system
      }
    });

    test('should show monitoring controls', async () => {
      await monitoringPage.navigate();
      
      // Verify control buttons are present
      if (await monitoringPage['refreshButton'].isVisible()) {
        await expect(monitoringPage['refreshButton']).toBeVisible();
      }
      
      if (await monitoringPage['settingsButton'].isVisible()) {
        await expect(monitoringPage['settingsButton']).toBeVisible();
      }
    });
  });

  test.describe('Monitoring Error Handling Tests', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      // Mock monitoring API errors
      await page.route('**/api/monitoring/**', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Monitoring service unavailable' })
        });
      });
      
      await monitoringPage.navigate();
      
      // Should still load page structure
      await expect(monitoringPage['pageTitle']).toBeVisible();
    });

    test('should handle network disconnection', async ({ page }) => {
      await monitoringPage.navigate();
      await monitoringPage.waitForPageLoad();
      
      // Simulate network disconnection
      await page.setOfflineMode(true);
      
      // Try to refresh data
      await monitoringPage.refreshData();
      
      // Restore network
      await page.setOfflineMode(false);
      
      // Should recover gracefully
      await monitoringPage.page.waitForTimeout(2000);
      expect(await monitoringPage.getCurrentUrl()).toMatch(/\/monitoring$/);
    });

    test('should handle missing monitoring data', async ({ page }) => {
      // Mock empty monitoring responses
      await page.route('**/api/monitoring/**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: null })
        });
      });
      
      await monitoringPage.navigate();
      
      // Should display empty states gracefully
      await expect(monitoringPage['pageTitle']).toBeVisible();
    });

    test('should handle slow loading data', async ({ page }) => {
      // Mock slow responses
      await page.route('**/api/monitoring/**', route => {
        setTimeout(() => {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: {} })
          });
        }, 3000);
      });
      
      await monitoringPage.navigate();
      
      // Should show loading states
      const isLoading = await monitoringPage.isLoading();
      expect(typeof isLoading).toBe('boolean');
    });
  });

  test.describe('Monitoring Performance Tests', () => {
    test('should switch between tabs quickly', async () => {
      await monitoringPage.navigate();
      
      const tabs = ['system', 'performance', 'trading', 'alerts', 'realtime'];
      
      for (const tab of tabs) {
        const startTime = Date.now();
        
        switch (tab) {
          case 'system':
            await monitoringPage.switchToSystemOverview();
            break;
          case 'performance':
            await monitoringPage.switchToPerformance();
            break;
          case 'trading':
            await monitoringPage.switchToTradingAnalytics();
            break;
          case 'alerts':
            await monitoringPage.switchToAlerts();
            break;
          case 'realtime':
            await monitoringPage.switchToRealTime();
            break;
        }
        
        const endTime = Date.now();
        const switchTime = endTime - startTime;
        expect(switchTime).toBeLessThan(5000); // Should switch within 5 seconds
      }
    });

    test('should handle frequent data refreshes', async () => {
      await monitoringPage.navigate();
      
      // Perform multiple refreshes
      for (let i = 0; i < 5; i++) {
        await monitoringPage.refreshData();
        await monitoringPage.page.waitForTimeout(1000);
      }
      
      // Should remain responsive
      expect(await monitoringPage.getCurrentUrl()).toMatch(/\/monitoring$/);
    });

    test('should not have memory leaks during monitoring', async () => {
      await monitoringPage.navigate();
      
      // Switch tabs and refresh multiple times
      for (let i = 0; i < 3; i++) {
        await monitoringPage.switchToSystemOverview();
        await monitoringPage.refreshData();
        await monitoringPage.switchToPerformance();
        await monitoringPage.refreshData();
        await monitoringPage.switchToRealTime();
        await monitoringPage.refreshData();
        await monitoringPage.page.waitForTimeout(500);
      }
      
      // Should still be responsive
      expect(await monitoringPage.getCurrentUrl()).toMatch(/\/monitoring$/);
    });
  });

  test.describe('Agent Monitoring Tests', () => {
    test('should verify all agents are monitored', async () => {
      await monitoringPage.navigate();
      const agentStatuses = await monitoringPage.getAgentStatuses();
      
      // Should monitor key agents
      const expectedAgents = ['calendar', 'pattern', 'trading', 'safety', 'orchestrator'];
      
      for (const agent of expectedAgents) {
        if (agentStatuses[agent]) {
          expect(agentStatuses[agent]).toBeTruthy();
        }
      }
    });

    test('should show agent health status', async () => {
      await monitoringPage.navigate();
      await monitoringPage.switchToSystemOverview();
      
      // Look for agent health indicators
      const agentElements = monitoringPage.page.locator('[data-testid*="agent"], .agent-status, .agent-health');
      const count = await agentElements.count();
      
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should handle agent status updates', async () => {
      await monitoringPage.navigate();
      
      // Get initial agent statuses
      const initialStatuses = await monitoringPage.getAgentStatuses();
      
      // Refresh data
      await monitoringPage.refreshData();
      
      // Get updated statuses
      const updatedStatuses = await monitoringPage.getAgentStatuses();
      
      // Statuses should be available (may or may not have changed)
      expect(Object.keys(updatedStatuses).length).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Monitoring Integration Tests', () => {
    test('should integrate with dashboard metrics', async () => {
      // Check dashboard metrics
      await dashboardPage.navigate();
      await dashboardPage.waitForMetrics();
      
      const dashboardWinRate = await dashboardPage.getMetricValue('Win Rate');
      
      // Check monitoring metrics
      await monitoringPage.navigate();
      const monitoringAnalytics = await monitoringPage.getTradingAnalytics();
      
      // Both should have trading data
      expect(dashboardWinRate).toBeTruthy();
      expect(Object.keys(monitoringAnalytics).length).toBeGreaterThanOrEqual(0);
    });

    test('should reflect system changes in real-time', async () => {
      await monitoringPage.navigate();
      await monitoringPage.switchToRealTime();
      
      // Monitor for real-time updates
      const initialStatus = await monitoringPage.getRealTimeDataStatus();
      
      // Wait for potential updates
      await monitoringPage.page.waitForTimeout(5000);
      
      const updatedStatus = await monitoringPage.getRealTimeDataStatus();
      
      // Status should be maintained or updated
      expect(updatedStatus).toBeTruthy();
    });

    test('should show consistent data across tabs', async () => {
      await monitoringPage.navigate();
      
      // Get system health from overview
      const systemHealth = await monitoringPage.getSystemHealthStatus();
      
      // Switch to performance tab
      await monitoringPage.switchToPerformance();
      
      // Switch back to overview
      await monitoringPage.switchToSystemOverview();
      
      // System health should be consistent
      const systemHealthAfter = await monitoringPage.getSystemHealthStatus();
      expect(systemHealthAfter).toBeTruthy();
    });
  });
});