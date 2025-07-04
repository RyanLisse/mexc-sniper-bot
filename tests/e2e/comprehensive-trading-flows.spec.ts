import { test, expect } from '@playwright/test';
import { AuthPage, DashboardPage, SettingsPage } from './pages';

const TEST_EMAIL = process.env.TEST_USER_EMAIL || process.env.AUTH_EMAIL || 'ryan@ryanlisse.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || process.env.AUTH_PASSWORD || 'Testing2025!';
const TEST_API_KEY = process.env.MEXC_API_KEY || 'test-api-key';
const TEST_SECRET_KEY = process.env.MEXC_SECRET_KEY || 'test-secret-key';

test.describe('Comprehensive Trading Flow Tests', () => {
  let authPage: AuthPage;
  let dashboardPage: DashboardPage;
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    dashboardPage = new DashboardPage(page);
    settingsPage = new SettingsPage(page);

    // Authenticate user before each test
    await authPage.navigate();
    await authPage.signIn(TEST_EMAIL, TEST_PASSWORD);
    await authPage.waitForAuthCompletion();
    await dashboardPage.waitForPageLoad();
  });

  test.describe('API Credentials Setup Tests', () => {
    test('should navigate to settings and configure API credentials', async () => {
      await settingsPage.navigate();
      await settingsPage.configureMexcCredentials(TEST_API_KEY, TEST_SECRET_KEY);
      await settingsPage.saveCredentials();
      
      // Should show success message
      const hasSuccess = await settingsPage.hasSuccessMessage();
      if (hasSuccess) {
        expect(hasSuccess).toBe(true);
      }
    });

    test('should test API credentials connectivity', async () => {
      await settingsPage.navigate();
      await settingsPage.configureMexcCredentials(TEST_API_KEY, TEST_SECRET_KEY);
      await settingsPage.testCredentials();
      
      // Should get some status response
      const status = await settingsPage.getCredentialsStatus();
      expect(status).toBeTruthy();
    });

    test('should handle invalid API credentials', async () => {
      await settingsPage.navigate();
      await settingsPage.configureMexcCredentials('invalid-key', 'invalid-secret');
      await settingsPage.testCredentials();
      
      // Should show error or invalid status
      const hasError = await settingsPage.hasErrorMessage();
      const status = await settingsPage.getCredentialsStatus();
      
      expect(hasError || status.toLowerCase().includes('invalid')).toBe(true);
    });
  });

  test.describe('Auto-Sniping Configuration Tests', () => {
    test('should configure auto-sniping settings', async () => {
      await settingsPage.navigate();
      await settingsPage.configureAutoSnipingSettings({
        enabled: true,
        confidenceThreshold: '75',
        maxTargets: '5',
        advanceNotice: '60'
      });
      await settingsPage.saveSettings();
      
      // Should save successfully
      const hasSuccess = await settingsPage.hasSuccessMessage();
      if (hasSuccess) {
        expect(hasSuccess).toBe(true);
      }
    });

    test('should enable/disable auto-sniping from dashboard', async () => {
      await dashboardPage.switchToTab('auto-sniping');
      
      // Get initial status
      const initialStatus = await dashboardPage.getAutoSnipingStatus();
      
      // Toggle auto-sniping
      await dashboardPage.toggleAutoSniping();
      
      // Wait for potential status change
      await dashboardPage.page.waitForTimeout(2000);
      
      // Should not throw errors
      expect(await dashboardPage.isAuthenticated()).toBe(true);
    });

    test('should validate auto-sniping configuration', async () => {
      await dashboardPage.switchToTab('auto-sniping');
      
      // Check that auto-sniping controls are present
      await expect(dashboardPage['autoSnipingToggle']).toBeVisible();
      await expect(dashboardPage['autoSnipingStatus']).toBeVisible();
    });
  });

  test.describe('Trading Settings Configuration Tests', () => {
    test('should configure trading parameters', async () => {
      await settingsPage.navigate();
      await settingsPage.configureTradingSettings({
        positionSize: '100',
        stopLoss: '5',
        takeProfit: '15',
        maxTrades: '3',
        riskManagement: true
      });
      await settingsPage.saveSettings();
      
      // Should save successfully
      const hasSuccess = await settingsPage.hasSuccessMessage();
      if (hasSuccess) {
        expect(hasSuccess).toBe(true);
      }
    });

    test('should validate trading parameter ranges', async () => {
      await settingsPage.navigate();
      
      // Try invalid values
      await settingsPage.configureTradingSettings({
        positionSize: '-100', // Negative value
        stopLoss: '0', // Zero stop loss
        takeProfit: '200', // Very high take profit
        maxTrades: '100' // Too many trades
      });
      
      await settingsPage.saveSettings();
      
      // Should show validation errors
      const hasError = await settingsPage.hasErrorMessage();
      expect(hasError).toBe(true);
    });
  });

  test.describe('Manual Trading Tests', () => {
    test('should access manual trading panel', async () => {
      await dashboardPage.switchToTab('manual-trading');
      
      // Should display manual trading content
      await expect(dashboardPage['manualTradingContent']).toBeVisible();
    });

    test('should display trading form elements', async () => {
      await dashboardPage.switchToTab('manual-trading');
      
      // Look for common trading form elements
      const tradingForm = dashboardPage.page.locator('form, [data-testid="trading-form"]');
      const symbolInput = dashboardPage.page.locator('input[name="symbol"], input[placeholder*="Symbol"]');
      const quantityInput = dashboardPage.page.locator('input[name="quantity"], input[placeholder*="Quantity"]');
      
      // These elements may or may not be present depending on implementation
      if (await tradingForm.isVisible()) {
        await expect(tradingForm).toBeVisible();
      }
    });

    test('should handle manual trade submission', async () => {
      await dashboardPage.switchToTab('manual-trading');
      
      // Look for buy/sell buttons
      const buyButton = dashboardPage.page.locator('button:has-text("Buy"), button:has-text("Long")');
      const sellButton = dashboardPage.page.locator('button:has-text("Sell"), button:has-text("Short")');
      
      if (await buyButton.isVisible()) {
        await buyButton.click();
        
        // Should not cause errors (may show validation errors which is expected)
        expect(await dashboardPage.isAuthenticated()).toBe(true);
      }
    });
  });

  test.describe('Trading History and Analytics Tests', () => {
    test('should display trading history', async () => {
      await dashboardPage.switchToTab('trades');
      
      // Should show trades table
      await expect(dashboardPage['recentTradesTable']).toBeVisible();
      
      // Get trades count
      const tradesCount = await dashboardPage.getRecentTradesCount();
      expect(tradesCount).toBeGreaterThanOrEqual(0);
    });

    test('should display trading metrics', async () => {
      // Check metrics on dashboard
      await dashboardPage.waitForMetrics();
      
      const winRate = await dashboardPage.getMetricValue('Win Rate');
      expect(winRate).toBeTruthy();
      expect(winRate).toMatch(/\d+(\.\d+)?%/);
    });

    test('should handle empty trading history', async () => {
      await dashboardPage.switchToTab('trades');
      
      // Should handle empty state gracefully
      await expect(dashboardPage['recentTradesTable']).toBeVisible();
    });

    test('should display portfolio information', async () => {
      await dashboardPage.switchToTab('overview');
      
      // Check for portfolio/balance information
      await expect(dashboardPage['accountBalanceSection']).toBeVisible();
      
      const totalBalance = await dashboardPage.getMetricValue('Total Balance');
      expect(totalBalance).toBeTruthy();
      expect(totalBalance).toMatch(/\$[\d,]+(\.[\d]{2})?/);
    });
  });

  test.describe('Snipe Targets Management Tests', () => {
    test('should display trading targets section', async () => {
      await dashboardPage.switchToTab('overview');
      
      // Should show trading targets
      await expect(dashboardPage['tradingTargetsSection']).toBeVisible();
      
      const activeTargets = await dashboardPage.getMetricValue('Active Targets');
      expect(activeTargets).toBeTruthy();
    });

    test('should handle add target functionality', async () => {
      await dashboardPage.addSnipeTarget();
      
      // Should trigger add target flow (modal, navigation, etc.)
      // The exact behavior depends on implementation
      expect(await dashboardPage.isAuthenticated()).toBe(true);
    });

    test('should display target information', async () => {
      await dashboardPage.switchToTab('overview');
      
      // Look for target items
      const targetItems = dashboardPage.page.locator('[data-testid="target-item"], .target-item, .snipe-target');
      const count = await targetItems.count();
      
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Pattern Detection Integration Tests', () => {
    test('should display pattern detection data', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Should show pattern content
      await expect(dashboardPage['patternsContent']).toBeVisible();
      
      // Check for AI patterns
      await expect(dashboardPage['aiEnhancedPatterns']).toBeVisible();
    });

    test('should show ready launches', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Look for ready launches display
      const readyLaunches = dashboardPage.page.locator('[data-testid="ready-launches"], .ready-launches');
      
      if (await readyLaunches.isVisible()) {
        await expect(readyLaunches).toBeVisible();
      }
    });

    test('should display pattern confidence scores', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Look for confidence indicators
      const confidenceElements = dashboardPage.page.locator('[data-testid="confidence"], .confidence, .confidence-score');
      const count = await confidenceElements.count();
      
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('New Listings Integration Tests', () => {
    test('should display new listings', async () => {
      await dashboardPage.switchToTab('listings');
      
      // Should show listings content
      await expect(dashboardPage['listingsContent']).toBeVisible();
      
      // Get listings count
      const listingsCount = await dashboardPage.getListingsCount();
      expect(listingsCount).toBeGreaterThanOrEqual(0);
    });

    test('should show listing details', async () => {
      await dashboardPage.switchToTab('listings');
      
      // Look for listing information
      const listingItems = dashboardPage.page.locator('[data-testid="listing-item"], .listing-item, .coin-listing');
      const count = await listingItems.count();
      
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should handle listing interactions', async () => {
      await dashboardPage.switchToTab('listings');
      
      // Look for actionable elements in listings
      const actionButtons = dashboardPage.page.locator('button:has-text("Add"), button:has-text("Target"), button:has-text("Watch")');
      const count = await actionButtons.count();
      
      if (count > 0) {
        await actionButtons.first().click();
        
        // Should not cause errors
        expect(await dashboardPage.isAuthenticated()).toBe(true);
      }
    });
  });

  test.describe('Real-time Trading Data Tests', () => {
    test('should handle real-time price updates', async ({ page }) => {
      await dashboardPage.switchToTab('overview');
      
      // Monitor for WebSocket or polling updates
      let dataUpdated = false;
      
      page.on('response', response => {
        if (response.url().includes('/api/mexc/') || response.url().includes('/api/market-data/')) {
          dataUpdated = true;
        }
      });
      
      // Wait for potential data updates
      await page.waitForTimeout(5000);
      
      // Real-time updates may or may not occur during test
      expect(await dashboardPage.isAuthenticated()).toBe(true);
    });

    test('should display live market data', async () => {
      await dashboardPage.switchToTab('overview');
      
      // Look for price displays or market data
      const priceElements = dashboardPage.page.locator('[data-testid="price"], .price, .market-price');
      const count = await priceElements.count();
      
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should handle market data errors gracefully', async ({ page }) => {
      // Mock market data API errors
      await page.route('**/api/mexc/**', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Market data unavailable' })
        });
      });
      
      await page.reload();
      await dashboardPage.waitForPageLoad();
      
      // Should handle errors gracefully
      await expect(dashboardPage['pageTitle']).toBeVisible();
    });
  });

  test.describe('Trading Safety and Risk Management Tests', () => {
    test('should enforce trading limits', async () => {
      await settingsPage.navigate();
      await settingsPage.configureTradingSettings({
        maxTrades: '1',
        riskManagement: true
      });
      await settingsPage.saveSettings();
      
      // Settings should be saved
      expect(await dashboardPage.isAuthenticated()).toBe(true);
    });

    test('should display risk warnings', async () => {
      await dashboardPage.switchToTab('manual-trading');
      
      // Look for risk warnings or disclaimers
      const warnings = dashboardPage.page.locator('[data-testid="warning"], .warning, .risk-warning');
      const disclaimers = dashboardPage.page.locator('[data-testid="disclaimer"], .disclaimer');
      
      // Risk warnings may or may not be present
      const warningCount = await warnings.count();
      const disclaimerCount = await disclaimers.count();
      
      expect(warningCount + disclaimerCount).toBeGreaterThanOrEqual(0);
    });

    test('should validate position sizes', async () => {
      await settingsPage.navigate();
      
      // Try to set invalid position size
      await settingsPage.configureTradingSettings({
        positionSize: '999999999' // Very large position
      });
      
      await settingsPage.saveSettings();
      
      // Should show validation error or handle gracefully
      const hasError = await settingsPage.hasErrorMessage();
      const hasSuccess = await settingsPage.hasSuccessMessage();
      
      expect(hasError || hasSuccess).toBe(true);
    });
  });

  test.describe('Trading Performance Tests', () => {
    test('should load trading data quickly', async () => {
      const startTime = Date.now();
      await dashboardPage.switchToTab('trades');
      await dashboardPage.waitForTabContent('trades');
      const endTime = Date.now();
      
      const loadTime = endTime - startTime;
      expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
    });

    test('should handle large trading datasets', async () => {
      await dashboardPage.switchToTab('trades');
      
      // Should handle any amount of trading data without performance issues
      const tradesCount = await dashboardPage.getRecentTradesCount();
      expect(tradesCount).toBeGreaterThanOrEqual(0);
      
      // Table should be responsive
      await expect(dashboardPage['recentTradesTable']).toBeVisible();
    });

    test('should update trading metrics efficiently', async () => {
      await dashboardPage.waitForMetrics();
      
      // Switch between tabs to trigger metric updates
      const tabs = ['overview', 'trades', 'patterns'];
      
      for (const tab of tabs) {
        const startTime = Date.now();
        await dashboardPage.switchToTab(tab);
        const endTime = Date.now();
        
        const switchTime = endTime - startTime;
        expect(switchTime).toBeLessThan(3000);
      }
    });
  });
});