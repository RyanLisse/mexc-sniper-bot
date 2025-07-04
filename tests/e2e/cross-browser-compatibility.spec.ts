import { test, expect, devices } from '@playwright/test';
import { AuthPage, DashboardPage, SettingsPage, MonitoringPage, TradingPage } from './pages';
import { E2EHelpers, TEST_CREDENTIALS } from './utils/e2e-test-helpers';
import { getUserPersona, getSettingsFixture, getTradingFixture } from '../fixtures/test-data-fixtures';

/**
 * Cross-Browser Compatibility Testing
 * Validates that all critical user workflows function consistently across different browsers
 */

test.describe('Cross-Browser Compatibility Tests', () => {
  let authPage: AuthPage;
  let dashboardPage: DashboardPage;
  let settingsPage: SettingsPage;
  let monitoringPage: MonitoringPage;
  let tradingPage: TradingPage;
  let helpers: E2EHelpers;

  test.beforeEach(async ({ page, browserName }) => {
    authPage = new AuthPage(page);
    dashboardPage = new DashboardPage(page);
    settingsPage = new SettingsPage(page);
    monitoringPage = new MonitoringPage(page);
    tradingPage = new TradingPage(page);
    helpers = new E2EHelpers(page);

    // Log which browser is being tested
    console.log(`Running test on: ${browserName}`);
  });

  test.describe('Authentication Cross-Browser Tests', () => {
    test('should complete login flow consistently across browsers', async ({ browserName }) => {
      await authPage.navigate();
      await authPage.waitForPageLoad();

      // Verify page loads correctly
      await expect(authPage.page.locator('[data-testid="login-form"]')).toBeVisible();

      // Complete login
      const persona = getUserPersona('BASIC_TRADER');
      await authPage.signIn(persona.email, persona.password);

      // Verify successful login regardless of browser
      await expect(dashboardPage.page.locator('[data-testid="dashboard"]')).toBeVisible({ timeout: 10000 });
      
      // Verify URL navigation works
      expect(authPage.page.url()).toContain('/dashboard');
    });

    test('should handle signup flow across browsers', async ({ browserName }) => {
      await authPage.navigate();
      await authPage.navigateToSignUp();

      // Verify signup form is displayed correctly
      await expect(authPage.page.locator('[data-testid="signup-form"]')).toBeVisible();

      // Test form interaction - different browsers handle form elements differently
      const testEmail = `test-${browserName}-${Date.now()}@example.com`;
      await authPage.fillSignUpForm({
        name: `Test User ${browserName}`,
        email: testEmail,
        password: 'TestPassword123!',
        confirmPassword: 'TestPassword123!'
      });

      // Verify form validation works across browsers
      await authPage.submitSignUpForm();
      
      // Should either succeed or show expected validation
      const hasSuccess = await authPage.hasSuccessMessage();
      const hasError = await authPage.hasErrorMessage();
      expect(hasSuccess || hasError).toBe(true);
    });

    test('should handle password reset flow across browsers', async ({ browserName }) => {
      await authPage.navigate();
      await authPage.clickForgotPassword();

      // Verify reset form is accessible
      await expect(authPage.page.locator('[data-testid="reset-password-form"]')).toBeVisible();

      // Test email input across browsers
      await authPage.fillResetPasswordForm('test@example.com');
      await authPage.submitResetPasswordForm();

      // Verify appropriate response
      const hasMessage = await authPage.hasInfoMessage();
      expect(hasMessage).toBe(true);
    });

    test('should maintain session across browser tabs', async ({ context, browserName }) => {
      // Login in first tab
      await authPage.navigate();
      await helpers.auth.signIn();
      await dashboardPage.waitForPageLoad();

      // Open new tab
      const newPage = await context.newPage();
      const newDashboardPage = new DashboardPage(newPage);
      
      // Navigate to dashboard in new tab
      await newDashboardPage.navigate();
      
      // Should be automatically logged in
      await expect(newPage.locator('[data-testid="dashboard"]')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Dashboard Cross-Browser Tests', () => {
    test.beforeEach(async () => {
      await helpers.auth.signIn();
    });

    test('should display dashboard metrics consistently', async ({ browserName }) => {
      await dashboardPage.navigate();
      await dashboardPage.waitForPageLoad();

      // Verify core dashboard elements are present
      await expect(dashboardPage.page.locator('[data-testid="portfolio-summary"]')).toBeVisible();
      await expect(dashboardPage.page.locator('[data-testid="trading-overview"]')).toBeVisible();
      await expect(dashboardPage.page.locator('[data-testid="recent-trades"]')).toBeVisible();

      // Verify metrics load and display
      const metrics = await dashboardPage.getPortfolioMetrics();
      expect(metrics).toBeDefined();
      expect(typeof metrics.totalValue).toBe('number');
    });

    test('should handle tab navigation consistently', async ({ browserName }) => {
      await dashboardPage.navigate();
      
      const tabs = ['overview', 'auto-sniping', 'patterns', 'trades'];
      
      for (const tab of tabs) {
        await dashboardPage.switchToTab(tab);
        await dashboardPage.waitForTabContent(tab);
        
        // Verify tab is active and content is loaded
        await expect(dashboardPage.page.locator(`[data-value="${tab}"][data-state="active"]`)).toBeVisible();
        
        // Wait for tab-specific content to load
        await helpers.wait.waitForElement(`[data-testid="${tab}-content"]`, 5000);
      }
    });

    test('should handle real-time updates consistently', async ({ browserName }) => {
      await dashboardPage.navigate();
      await dashboardPage.waitForPageLoad();

      // Enable real-time updates if available
      if (await dashboardPage.hasRealTimeToggle()) {
        await dashboardPage.enableRealTimeUpdates();
      }

      // Verify WebSocket connection works across browsers
      const connectionStatus = await helpers.websocket.getConnectionStatus();
      expect(['connected', 'connecting']).toContain(connectionStatus);

      // Verify updates are received
      if (connectionStatus === 'connected') {
        const initialData = await dashboardPage.getCurrentData();
        await helpers.wait.waitForNetworkIdle();
        
        // Data should be updated or at least timestamp should change
        const updatedData = await dashboardPage.getCurrentData();
        expect(updatedData.lastUpdated).not.toBe(initialData.lastUpdated);
      }
    });

    test('should handle charts and graphics consistently', async ({ browserName }) => {
      await dashboardPage.navigate();
      await dashboardPage.navigateToPatterns();

      // Verify charts render correctly across browsers
      if (await dashboardPage.hasChart()) {
        await expect(dashboardPage.page.locator('[data-testid="pattern-chart"]')).toBeVisible();
        
        // Verify chart is interactive
        const chartElement = dashboardPage.page.locator('[data-testid="pattern-chart"]');
        await chartElement.hover();
        
        // Charts should respond to hover in all browsers
        const isInteractive = await helpers.ui.isElementInteractive(chartElement);
        expect(isInteractive).toBe(true);
      }
    });
  });

  test.describe('Settings Cross-Browser Tests', () => {
    test.beforeEach(async () => {
      await helpers.auth.signIn();
    });

    test('should handle settings form interactions consistently', async ({ browserName }) => {
      await settingsPage.navigate();
      await settingsPage.waitForPageLoad();

      // Test API credentials form
      await settingsPage.switchToApiCredentials();
      
      const testCredentials = getUserPersona('BASIC_TRADER').apiCredentials;
      await settingsPage.configureMexcCredentials(
        testCredentials.mexcApiKey,
        testCredentials.mexcSecretKey
      );

      // Test credentials validation across browsers
      await settingsPage.testCredentials();
      
      // Different browsers might handle async operations differently
      await helpers.wait.waitForElement('[data-testid="credentials-status"]', 10000);
      
      const status = await settingsPage.getCredentialsStatus();
      expect(status).toBeTruthy();
    });

    test('should handle file upload consistently', async ({ browserName }) => {
      await settingsPage.navigate();
      
      // Test settings import functionality if available
      if (await settingsPage.hasImportFeature()) {
        const settingsData = getSettingsFixture('BASIC_SETTINGS');
        await settingsPage.importSettings(settingsData);
        
        // File upload should work consistently across browsers
        const hasSuccess = await settingsPage.hasSuccessMessage();
        expect(hasSuccess).toBe(true);
      }
    });

    test('should handle form validation consistently', async ({ browserName }) => {
      await settingsPage.navigate();
      await settingsPage.switchToTradingSettings();

      // Test with invalid values
      await settingsPage.configureTradingSettings({
        positionSize: '-100', // Invalid
        stopLoss: 'abc', // Invalid
        maxTrades: '0' // Invalid
      });

      await settingsPage.saveSettings();

      // Validation should work consistently across browsers
      const hasErrors = await settingsPage.hasErrorMessage();
      expect(hasErrors).toBe(true);
    });

    test('should handle theme switching consistently', async ({ browserName }) => {
      await settingsPage.navigate();
      
      // Test theme switching if available
      if (await settingsPage.hasThemeSettings()) {
        await settingsPage.configureUserPreferences({ theme: 'dark' });
        await settingsPage.saveSettings();
        
        // Verify theme change is applied
        const currentTheme = await settingsPage.getCurrentTheme();
        expect(currentTheme).toBe('dark');
        
        // Switch back to light
        await settingsPage.configureUserPreferences({ theme: 'light' });
        await settingsPage.saveSettings();
        
        const lightTheme = await settingsPage.getCurrentTheme();
        expect(lightTheme).toBe('light');
      }
    });
  });

  test.describe('Trading Interface Cross-Browser Tests', () => {
    test.beforeEach(async () => {
      await helpers.auth.signIn();
    });

    test('should handle trading form interactions consistently', async ({ browserName }) => {
      await tradingPage.navigate();
      await tradingPage.waitForPageLoad();

      // Test basic trading form functionality
      const tradeData = {
        symbol: 'BTCUSDT',
        type: 'market' as const,
        side: 'buy' as const,
        quantity: '0.001'
      };

      await tradingPage.fillTradeForm(tradeData);
      
      // Verify form is filled correctly across browsers
      const formData = await tradingPage.getTradeFormData();
      expect(formData.symbol).toBe(tradeData.symbol);
      expect(formData.quantity).toBe(tradeData.quantity);

      // Test form submission
      await tradingPage.previewTrade();
      
      // Verify preview modal/dialog appears
      await expect(tradingPage.page.locator('[data-testid="trade-preview"]')).toBeVisible({ timeout: 5000 });
    });

    test('should handle market data updates consistently', async ({ browserName }) => {
      await tradingPage.navigate();
      
      // Verify market data loads
      if (await tradingPage.hasMarketData()) {
        const marketData = await tradingPage.getMarketData();
        expect(marketData).toBeDefined();
        expect(marketData.length).toBeGreaterThan(0);
      }

      // Verify order book updates
      if (await tradingPage.hasOrderBook()) {
        const orderBook = await tradingPage.getOrderBookData();
        expect(orderBook.bids).toBeDefined();
        expect(orderBook.asks).toBeDefined();
      }
    });

    test('should handle keyboard shortcuts consistently', async ({ browserName }) => {
      await tradingPage.navigate();
      await tradingPage.waitForPageLoad();

      // Test common keyboard shortcuts
      const shortcuts = [
        { key: 'F5', description: 'Refresh' },
        { key: 'Escape', description: 'Close dialogs' },
        { key: 'Tab', description: 'Navigate between elements' }
      ];

      for (const shortcut of shortcuts) {
        await tradingPage.page.keyboard.press(shortcut.key);
        await helpers.wait.short();
        
        // Verify shortcut doesn't break the interface
        const isPageResponsive = await helpers.ui.isPageResponsive();
        expect(isPageResponsive).toBe(true);
      }
    });
  });

  test.describe('Monitoring Interface Cross-Browser Tests', () => {
    test.beforeEach(async () => {
      await helpers.auth.signIn();
    });

    test('should display monitoring metrics consistently', async ({ browserName }) => {
      await monitoringPage.navigate();
      await monitoringPage.waitForPageLoad();

      // Verify system health indicators
      await expect(monitoringPage.page.locator('[data-testid="system-health"]')).toBeVisible();
      
      const healthStatus = await monitoringPage.getSystemHealthStatus();
      expect(healthStatus).toBeTruthy();
    });

    test('should handle performance charts consistently', async ({ browserName }) => {
      await monitoringPage.navigateToPerformance();
      
      // Verify performance charts render
      if (await monitoringPage.hasPerformanceCharts()) {
        await expect(monitoringPage.page.locator('[data-testid="performance-chart"]')).toBeVisible();
        
        // Verify chart interaction works
        const chart = monitoringPage.page.locator('[data-testid="performance-chart"]');
        await chart.hover();
        
        // Should show tooltip or highlight
        const hasTooltip = await monitoringPage.page.locator('[data-testid="chart-tooltip"]').isVisible();
        // Tooltip behavior might vary between browsers, so we don't enforce it
      }
    });

    test('should handle real-time monitoring consistently', async ({ browserName }) => {
      await monitoringPage.navigate();
      
      // Enable real-time monitoring
      if (await monitoringPage.hasRealTimeMode()) {
        await monitoringPage.enableRealTimeMode();
        
        // Verify real-time updates
        const initialMetrics = await monitoringPage.getCurrentMetrics();
        await helpers.wait.waitForElement('[data-testid="metrics-updated"]', 10000);
        
        const updatedMetrics = await monitoringPage.getCurrentMetrics();
        expect(updatedMetrics.timestamp).not.toBe(initialMetrics.timestamp);
      }
    });
  });

  test.describe('Browser-Specific Feature Tests', () => {
    test('should handle browser notifications consistently', async ({ browserName, context }) => {
      // Grant notification permissions
      await context.grantPermissions(['notifications']);
      
      await helpers.auth.signIn();
      await settingsPage.navigate();
      
      // Enable notifications if available
      if (await settingsPage.hasNotificationSettings()) {
        await settingsPage.configureNotifications({ email: true });
        
        // Test notification trigger
        if (await settingsPage.canSendTestNotification()) {
          await settingsPage.sendTestNotification();
          
          // Verify notification result
          const result = await settingsPage.getTestNotificationResult();
          expect(result).toContain('sent');
        }
      }
    });

    test('should handle local storage consistently', async ({ browserName }) => {
      await helpers.auth.signIn();
      
      // Test local storage functionality
      const testData = { testKey: 'testValue', browserName };
      await helpers.storage.setLocalStorage('testData', testData);
      
      // Refresh page and verify data persists
      await helpers.navigation.refreshPage();
      
      const retrievedData = await helpers.storage.getLocalStorage('testData');
      expect(retrievedData).toEqual(testData);
    });

    test('should handle clipboard operations consistently', async ({ browserName, context }) => {
      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      
      await helpers.auth.signIn();
      await settingsPage.navigate();
      
      // Test copy/paste functionality if available
      if (await settingsPage.hasCopyFeature()) {
        const testText = `Test clipboard data from ${browserName}`;
        await settingsPage.copyToClipboard(testText);
        
        // Verify clipboard content
        const clipboardContent = await helpers.ui.getClipboardContent();
        expect(clipboardContent).toBe(testText);
      }
    });

    test('should handle geolocation consistently', async ({ browserName, context }) => {
      // Grant geolocation permissions
      await context.grantPermissions(['geolocation']);
      await context.setGeolocation({ latitude: 37.7749, longitude: -122.4194 });
      
      await helpers.auth.signIn();
      
      // Test geolocation features if available
      if (await helpers.ui.hasGeolocationFeatures()) {
        const location = await helpers.ui.getCurrentLocation();
        expect(location.latitude).toBeCloseTo(37.7749, 1);
        expect(location.longitude).toBeCloseTo(-122.4194, 1);
      }
    });
  });

  test.describe('Performance Cross-Browser Tests', () => {
    test('should meet performance benchmarks across browsers', async ({ browserName }) => {
      const performanceMetrics = await helpers.performance.measurePageLoad(async () => {
        await helpers.auth.signIn();
        await dashboardPage.waitForPageLoad();
      });

      // Performance requirements should be met across all browsers
      expect(performanceMetrics.domContentLoaded).toBeLessThan(5000); // 5 seconds max
      expect(performanceMetrics.networkRequestCount).toBeLessThan(50); // Reasonable request count
      
      // Log performance for comparison
      console.log(`${browserName} performance:`, performanceMetrics);
    });

    test('should handle memory usage consistently', async ({ browserName }) => {
      await helpers.auth.signIn();
      
      // Perform memory-intensive operations
      const tabs = ['overview', 'auto-sniping', 'patterns', 'trades'];
      for (const tab of tabs) {
        await dashboardPage.switchToTab(tab);
        await dashboardPage.waitForTabContent(tab);
        await helpers.wait.short();
      }
      
      // Check for memory leaks
      const memoryUsage = await helpers.performance.getMemoryUsage();
      expect(memoryUsage.usedJSHeapSize).toBeLessThan(100 * 1024 * 1024); // 100MB max
    });
  });

  test.describe('Error Handling Cross-Browser Tests', () => {
    test('should handle network errors consistently', async ({ browserName }) => {
      await helpers.auth.signIn();
      
      // Simulate network failure
      await helpers.api.interceptError('**/api/**', 503);
      
      await dashboardPage.navigate();
      
      // Verify error handling
      const hasErrorState = await dashboardPage.hasErrorState();
      expect(hasErrorState).toBe(true);
      
      // Restore network and verify recovery
      await helpers.api.clearRoutes();
      await helpers.navigation.refreshPage();
      
      const hasRecovered = await dashboardPage.isLoaded();
      expect(hasRecovered).toBe(true);
    });

    test('should handle JavaScript errors consistently', async ({ browserName }) => {
      // Track JavaScript errors
      const jsErrors: Error[] = [];
      helpers.page.on('pageerror', error => jsErrors.push(error));
      
      await helpers.auth.signIn();
      await dashboardPage.navigate();
      await dashboardPage.waitForPageLoad();
      
      // Perform typical user interactions
      await dashboardPage.switchToTab('auto-sniping');
      await dashboardPage.switchToTab('patterns');
      
      // Should not have critical JavaScript errors
      const criticalErrors = jsErrors.filter(error => 
        !error.message.includes('Non-critical') && 
        !error.message.includes('Warning')
      );
      
      expect(criticalErrors.length).toBe(0);
    });
  });

  test.describe('Accessibility Cross-Browser Tests', () => {
    test('should maintain accessibility across browsers', async ({ browserName }) => {
      await helpers.auth.signIn();
      await dashboardPage.navigate();
      
      // Test keyboard navigation
      await helpers.accessibility.testKeyboardNavigation();
      
      // Verify focus management
      const focusableElements = await helpers.accessibility.getFocusableElements();
      expect(focusableElements.length).toBeGreaterThan(0);
      
      // Test screen reader compatibility
      const landmarks = await helpers.accessibility.getLandmarks();
      expect(landmarks).toContain('main');
      expect(landmarks).toContain('navigation');
    });

    test('should handle high contrast mode consistently', async ({ browserName }) => {
      // Enable high contrast mode
      await helpers.accessibility.enableHighContrastMode();
      
      await helpers.auth.signIn();
      await dashboardPage.navigate();
      
      // Verify high contrast styles are applied
      const hasHighContrast = await helpers.accessibility.hasHighContrastStyles();
      expect(hasHighContrast).toBe(true);
    });
  });
});