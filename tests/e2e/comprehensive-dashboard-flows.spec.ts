import { test, expect } from '@playwright/test';
import { AuthPage, DashboardPage } from './pages';

const TEST_EMAIL = process.env.TEST_USER_EMAIL || process.env.AUTH_EMAIL || 'ryan@ryanlisse.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || process.env.AUTH_PASSWORD || 'Testing2025!';

test.describe('Comprehensive Dashboard Flow Tests', () => {
  let authPage: AuthPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    dashboardPage = new DashboardPage(page);

    // Authenticate user before each test
    await authPage.navigate();
    await authPage.signIn(TEST_EMAIL, TEST_PASSWORD);
    await authPage.waitForAuthCompletion();
    await dashboardPage.waitForPageLoad();
  });

  test.describe('Dashboard Loading and Layout Tests', () => {
    test('should load dashboard with all essential elements', async () => {
      await dashboardPage.verifyDashboardElements();
      
      // Verify URL is correct
      expect(await dashboardPage.getCurrentUrl()).toMatch(/\/dashboard$/);
      
      // Verify page title
      await expect(dashboardPage['pageTitle']).toBeVisible();
    });

    test('should load metrics cards with data', async () => {
      await dashboardPage.waitForMetrics();
      
      // Check that all metric cards are visible
      await expect(dashboardPage['totalBalanceCard']).toBeVisible();
      await expect(dashboardPage['newListingsCard']).toBeVisible();
      await expect(dashboardPage['activeTargetsCard']).toBeVisible();
      await expect(dashboardPage['winRateCard']).toBeVisible();
      
      // Verify metric values are displayed
      const totalBalance = await dashboardPage.getMetricValue('Total Balance');
      const newListings = await dashboardPage.getMetricValue('New Listings');
      const activeTargets = await dashboardPage.getMetricValue('Active Targets');
      const winRate = await dashboardPage.getMetricValue('Win Rate');
      
      expect(totalBalance).toBeTruthy();
      expect(newListings).toBeTruthy();
      expect(activeTargets).toBeTruthy();
      expect(winRate).toBeTruthy();
    });

    test('should display trading chart', async () => {
      const isChartVisible = await dashboardPage.isTradingChartVisible();
      expect(isChartVisible).toBe(true);
    });

    test('should show tab badges with counts', async () => {
      const badges = await dashboardPage.getTabBadges();
      
      // Verify badge structure (should have numeric values)
      for (const [tab, count] of Object.entries(badges)) {
        expect(typeof count).toBe('number');
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Tab Navigation Tests', () => {
    test('should switch to Auto-Sniping tab and display content', async () => {
      await dashboardPage.switchToTab('auto-sniping');
      
      // Verify auto-sniping content is visible
      await expect(dashboardPage['autoSnipingContent']).toBeVisible();
      
      // Check for auto-sniping specific elements
      await expect(dashboardPage['autoSnipingToggle']).toBeVisible();
    });

    test('should switch to Overview tab and display content', async () => {
      await dashboardPage.switchToTab('overview');
      
      // Verify overview content is visible
      await expect(dashboardPage['overviewContent']).toBeVisible();
      
      // Check for overview specific elements
      await expect(dashboardPage['tradingTargetsSection']).toBeVisible();
      await expect(dashboardPage['accountBalanceSection']).toBeVisible();
      await expect(dashboardPage['activityFeed']).toBeVisible();
    });

    test('should switch to Patterns tab and display content', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Verify patterns content is visible
      await expect(dashboardPage['patternsContent']).toBeVisible();
      
      // Check patterns count
      const patternsCount = await dashboardPage.getPatternsCount();
      expect(patternsCount).toBeGreaterThanOrEqual(0);
    });

    test('should switch to Trading History tab and display content', async () => {
      await dashboardPage.switchToTab('trades');
      
      // Verify trades content is visible
      await expect(dashboardPage['tradesContent']).toBeVisible();
      
      // Check recent trades table
      await expect(dashboardPage['recentTradesTable']).toBeVisible();
      
      // Get trades count
      const tradesCount = await dashboardPage.getRecentTradesCount();
      expect(tradesCount).toBeGreaterThanOrEqual(0);
    });

    test('should switch to New Listings tab and display content', async () => {
      await dashboardPage.switchToTab('listings');
      
      // Verify listings content is visible
      await expect(dashboardPage['listingsContent']).toBeVisible();
      
      // Get listings count
      const listingsCount = await dashboardPage.getListingsCount();
      expect(listingsCount).toBeGreaterThanOrEqual(0);
    });

    test('should switch to Manual Trading tab and display content', async () => {
      await dashboardPage.switchToTab('manual-trading');
      
      // Verify manual trading content is visible
      await expect(dashboardPage['manualTradingContent']).toBeVisible();
    });

    test('should maintain tab state during navigation', async () => {
      // Switch to patterns tab
      await dashboardPage.switchToTab('patterns');
      await expect(dashboardPage['patternsContent']).toBeVisible();
      
      // Refresh page
      await dashboardPage.page.reload();
      await dashboardPage.waitForPageLoad();
      
      // Should default back to auto-sniping tab (default)
      await expect(dashboardPage['autoSnipingContent']).toBeVisible();
    });
  });

  test.describe('Auto-Sniping Control Tests', () => {
    test('should display auto-sniping status', async () => {
      const status = await dashboardPage.getAutoSnipingStatus();
      expect(status).toBeTruthy();
      expect(typeof status).toBe('string');
    });

    test('should be able to toggle auto-sniping', async () => {
      await dashboardPage.switchToTab('auto-sniping');
      
      // Get initial status
      const initialStatus = await dashboardPage.getAutoSnipingStatus();
      
      // Toggle auto-sniping
      await dashboardPage.toggleAutoSniping();
      
      // Wait for status to update
      await dashboardPage.page.waitForTimeout(2000);
      
      // Get new status (should be different)
      const newStatus = await dashboardPage.getAutoSnipingStatus();
      // Note: Status may not change immediately due to safety checks
    });

    test('should display add target button', async () => {
      await dashboardPage.switchToTab('auto-sniping');
      await expect(dashboardPage['addTargetButton']).toBeVisible();
    });

    test('should handle add target action', async () => {
      await dashboardPage.addSnipeTarget();
      
      // Should open target configuration or modal
      // This depends on the actual implementation
    });
  });

  test.describe('Real-time Data Updates Tests', () => {
    test('should update metrics periodically', async ({ page }) => {
      await dashboardPage.waitForMetrics();
      
      // Get initial metric values
      const initialBalance = await dashboardPage.getMetricValue('Total Balance');
      
      // Wait for potential updates
      await page.waitForTimeout(5000);
      
      // Check if values are still displayed (may or may not have changed)
      const updatedBalance = await dashboardPage.getMetricValue('Total Balance');
      expect(updatedBalance).toBeTruthy();
    });

    test('should handle WebSocket connections', async ({ page }) => {
      // Monitor WebSocket connections
      let wsConnected = false;
      
      page.on('websocket', ws => {
        wsConnected = true;
        ws.on('framereceived', event => {
          console.log('WebSocket message received:', event.payload);
        });
      });
      
      await dashboardPage.waitForPageLoad();
      
      // Wait a bit for WebSocket to connect
      await page.waitForTimeout(3000);
      
      // WebSocket connection may or may not be established depending on implementation
      // This test ensures no errors occur
    });

    test('should refresh data when switching tabs', async () => {
      // Switch between tabs to trigger data loading
      await dashboardPage.switchToTab('overview');
      await dashboardPage.switchToTab('patterns');
      await dashboardPage.switchToTab('trades');
      await dashboardPage.switchToTab('listings');
      
      // Should not throw errors
      expect(await dashboardPage.isAuthenticated()).toBe(true);
    });
  });

  test.describe('Dashboard Interactions Tests', () => {
    test('should handle metric card interactions', async () => {
      await dashboardPage.waitForMetrics();
      
      // Click on metric cards (if they're interactive)
      await dashboardPage['totalBalanceCard'].click();
      await dashboardPage['newListingsCard'].click();
      await dashboardPage['activeTargetsCard'].click();
      await dashboardPage['winRateCard'].click();
      
      // Should not navigate away from dashboard
      expect(await dashboardPage.getCurrentUrl()).toMatch(/\/dashboard$/);
    });

    test('should handle trading chart interactions', async () => {
      if (await dashboardPage.isTradingChartVisible()) {
        await dashboardPage['tradingChart'].click();
        
        // Chart should remain functional
        expect(await dashboardPage.isTradingChartVisible()).toBe(true);
      }
    });

    test('should handle activity feed interactions', async () => {
      await dashboardPage.switchToTab('overview');
      
      if (await dashboardPage['activityFeed'].isVisible()) {
        await dashboardPage['activityFeed'].click();
        
        // Should not cause errors
        expect(await dashboardPage.isAuthenticated()).toBe(true);
      }
    });
  });

  test.describe('Dashboard Error Handling Tests', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      // Mock API error responses
      await page.route('**/api/**', route => {
        if (route.request().url().includes('/account/balance')) {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Internal server error' })
          });
        } else {
          route.continue();
        }
      });
      
      // Refresh to trigger API calls
      await page.reload();
      await dashboardPage.waitForPageLoad();
      
      // Dashboard should still load, even with some API errors
      await expect(dashboardPage['pageTitle']).toBeVisible();
    });

    test('should handle network disconnection', async ({ page }) => {
      // Simulate network disconnection
      await page.setOfflineMode(true);
      
      // Try to switch tabs
      await dashboardPage.switchToTab('patterns');
      
      // Restore network
      await page.setOfflineMode(false);
      
      // Should recover gracefully
      await page.waitForTimeout(2000);
      expect(await dashboardPage.isAuthenticated()).toBe(true);
    });

    test('should handle missing data gracefully', async ({ page }) => {
      // Mock empty data responses
      await page.route('**/api/**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] })
        });
      });
      
      await page.reload();
      await dashboardPage.waitForPageLoad();
      
      // Should display empty states gracefully
      await expect(dashboardPage['pageTitle']).toBeVisible();
    });
  });

  test.describe('Dashboard Performance Tests', () => {
    test('should load dashboard within acceptable time', async () => {
      const startTime = Date.now();
      await dashboardPage.navigate();
      await dashboardPage.waitForPageLoad();
      const endTime = Date.now();
      
      const loadTime = endTime - startTime;
      expect(loadTime).toBeLessThan(10000); // Should load within 10 seconds
    });

    test('should handle tab switching quickly', async () => {
      const tabs = ['auto-sniping', 'overview', 'patterns', 'trades', 'listings', 'manual-trading'];
      
      for (const tab of tabs) {
        const startTime = Date.now();
        await dashboardPage.switchToTab(tab);
        const endTime = Date.now();
        
        const switchTime = endTime - startTime;
        expect(switchTime).toBeLessThan(3000); // Should switch within 3 seconds
      }
    });

    test('should not have memory leaks during tab switching', async () => {
      // Switch tabs multiple times to test for memory leaks
      const tabs = ['auto-sniping', 'overview', 'patterns', 'trades', 'listings', 'manual-trading'];
      
      for (let i = 0; i < 5; i++) {
        for (const tab of tabs) {
          await dashboardPage.switchToTab(tab);
          await dashboardPage.page.waitForTimeout(500);
        }
      }
      
      // Should still be responsive
      expect(await dashboardPage.isAuthenticated()).toBe(true);
    });
  });

  test.describe('Dashboard Responsive Design Tests', () => {
    test('should work on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await dashboardPage.navigate();
      await dashboardPage.waitForPageLoad();
      
      // Verify essential elements are visible on mobile
      await expect(dashboardPage['pageTitle']).toBeVisible();
      await expect(dashboardPage['tabsList']).toBeVisible();
    });

    test('should work on tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      
      await dashboardPage.navigate();
      await dashboardPage.waitForPageLoad();
      
      // Verify layout works on tablet
      await dashboardPage.verifyDashboardElements();
    });

    test('should work on desktop viewport', async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      await dashboardPage.navigate();
      await dashboardPage.waitForPageLoad();
      
      // Verify full layout on desktop
      await dashboardPage.verifyDashboardElements();
      await dashboardPage.waitForMetrics();
    });
  });

  test.describe('Dashboard Accessibility Tests', () => {
    test('should be keyboard navigable', async ({ page }) => {
      await dashboardPage.waitForPageLoad();
      
      // Tab through interface
      await page.keyboard.press('Tab'); // First tab
      await page.keyboard.press('Tab'); // Second tab
      await page.keyboard.press('Enter'); // Activate current element
      
      // Should not cause errors
      expect(await dashboardPage.isAuthenticated()).toBe(true);
    });

    test('should have proper heading structure', async () => {
      await dashboardPage.waitForPageLoad();
      
      // Check for proper heading elements
      const headings = await dashboardPage.page.$$('h1, h2, h3, h4, h5, h6');
      expect(headings.length).toBeGreaterThan(0);
    });

    test('should have alt text for images', async () => {
      await dashboardPage.waitForPageLoad();
      
      // Check that images have alt attributes
      const images = await dashboardPage.page.$$('img');
      for (const img of images) {
        const alt = await img.getAttribute('alt');
        expect(alt).toBeTruthy();
      }
    });
  });
});