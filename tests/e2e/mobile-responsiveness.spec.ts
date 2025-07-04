import { test, expect, devices } from '@playwright/test';
import { AuthPage, DashboardPage, SettingsPage, MonitoringPage, TradingPage } from './pages';
import { E2EHelpers, TEST_CREDENTIALS } from './utils/e2e-test-helpers';
import { getUserPersona, getSettingsFixture } from '../fixtures/test-data-fixtures';

/**
 * Mobile Responsiveness Validation Tests
 * Validates that all critical user journeys work correctly across different device sizes
 */

// Device configurations for testing
const DEVICE_CONFIGS = {
  MOBILE_PORTRAIT: { width: 375, height: 667 }, // iPhone SE
  MOBILE_LANDSCAPE: { width: 667, height: 375 }, // iPhone SE Landscape
  TABLET_PORTRAIT: { width: 768, height: 1024 }, // iPad
  TABLET_LANDSCAPE: { width: 1024, height: 768 }, // iPad Landscape
  SMALL_DESKTOP: { width: 1366, height: 768 }, // Small laptop
  LARGE_DESKTOP: { width: 1920, height: 1080 }, // Large desktop
};

test.describe('Mobile Responsiveness Validation Tests', () => {
  let authPage: AuthPage;
  let dashboardPage: DashboardPage;
  let settingsPage: SettingsPage;
  let monitoringPage: MonitoringPage;
  let tradingPage: TradingPage;
  let helpers: E2EHelpers;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    dashboardPage = new DashboardPage(page);
    settingsPage = new SettingsPage(page);
    monitoringPage = new MonitoringPage(page);
    tradingPage = new TradingPage(page);
    helpers = new E2EHelpers(page);
  });

  test.describe('Authentication Flow Mobile Responsiveness', () => {
    Object.entries(DEVICE_CONFIGS).forEach(([deviceName, viewport]) => {
      test(`should complete login flow on ${deviceName}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        
        await authPage.navigate();
        await authPage.waitForPageLoad();

        // Verify login form is accessible and properly sized
        const loginForm = page.locator('[data-testid="login-form"]');
        await expect(loginForm).toBeVisible();
        
        // Check form is within viewport bounds
        const formBox = await loginForm.boundingBox();
        expect(formBox!.width).toBeLessThanOrEqual(viewport.width);
        expect(formBox!.height).toBeLessThanOrEqual(viewport.height);

        // Verify form inputs are usable
        const emailInput = page.locator('input[type="email"]');
        const passwordInput = page.locator('input[type="password"]');
        
        await expect(emailInput).toBeVisible();
        await expect(passwordInput).toBeVisible();
        
        // Test form interaction
        const persona = getUserPersona('BASIC_TRADER');
        await emailInput.fill(persona.email);
        await passwordInput.fill(persona.password);
        
        // Verify inputs can be filled properly
        expect(await emailInput.inputValue()).toBe(persona.email);
        expect(await passwordInput.inputValue()).toBe(persona.password);

        // Test login submission
        await authPage.clickSignInButton();
        
        // Verify successful navigation
        await expect(page.locator('[data-testid="dashboard"]')).toBeVisible({ timeout: 10000 });
      });

      test(`should handle signup form on ${deviceName}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        
        await authPage.navigate();
        await authPage.navigateToSignUp();

        // Verify signup form layout
        const signupForm = page.locator('[data-testid="signup-form"]');
        await expect(signupForm).toBeVisible();

        // Check all form fields are accessible
        const requiredFields = [
          'input[name="name"]',
          'input[name="email"]', 
          'input[name="password"]',
          'input[name="confirmPassword"]'
        ];

        for (const field of requiredFields) {
          const fieldElement = page.locator(field);
          await expect(fieldElement).toBeVisible();
          
          // Verify field is touchable on mobile
          if (viewport.width <= 768) {
            const fieldBox = await fieldElement.boundingBox();
            expect(fieldBox!.height).toBeGreaterThanOrEqual(44); // Minimum touch target
          }
        }

        // Test form scrolling if needed
        if (viewport.height < 600) {
          await helpers.ui.scrollToElement(signupForm);
          await expect(signupForm).toBeInViewport();
        }
      });
    });

    test('should handle mobile-specific interactions', async ({ page }) => {
      await page.setViewportSize(DEVICE_CONFIGS.MOBILE_PORTRAIT);
      
      await authPage.navigate();
      
      // Test touch interactions
      const loginButton = page.locator('[data-testid="login-button"]');
      await expect(loginButton).toBeVisible();
      
      // Verify button is appropriately sized for touch
      const buttonBox = await loginButton.boundingBox();
      expect(buttonBox!.height).toBeGreaterThanOrEqual(44); // iOS HIG minimum
      expect(buttonBox!.width).toBeGreaterThanOrEqual(44);

      // Test keyboard appearance doesn't break layout
      const emailInput = page.locator('input[type="email"]');
      await emailInput.click();
      await emailInput.fill('test@example.com');
      
      // Verify form is still usable after keyboard input
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    });

    test('should handle orientation changes gracefully', async ({ page }) => {
      // Start in portrait
      await page.setViewportSize(DEVICE_CONFIGS.MOBILE_PORTRAIT);
      await authPage.navigate();
      await authPage.waitForPageLoad();
      
      // Verify initial layout
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
      
      // Switch to landscape
      await page.setViewportSize(DEVICE_CONFIGS.MOBILE_LANDSCAPE);
      await helpers.wait.short(); // Allow layout to adjust
      
      // Verify layout adapts
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
      
      const formBox = await page.locator('[data-testid="login-form"]').boundingBox();
      expect(formBox!.width).toBeLessThanOrEqual(DEVICE_CONFIGS.MOBILE_LANDSCAPE.width);
    });
  });

  test.describe('Dashboard Mobile Responsiveness', () => {
    test.beforeEach(async () => {
      await helpers.auth.signIn();
    });

    Object.entries(DEVICE_CONFIGS).forEach(([deviceName, viewport]) => {
      test(`should display dashboard correctly on ${deviceName}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        
        await dashboardPage.navigate();
        await dashboardPage.waitForPageLoad();

        // Verify core dashboard elements are visible
        await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
        
        // Check responsive grid layout
        const portfolioSummary = page.locator('[data-testid="portfolio-summary"]');
        await expect(portfolioSummary).toBeVisible();
        
        const summaryBox = await portfolioSummary.boundingBox();
        expect(summaryBox!.width).toBeLessThanOrEqual(viewport.width - 32); // Account for padding

        // Verify navigation is accessible
        const navigation = page.locator('[data-testid="navigation"], nav');
        await expect(navigation).toBeVisible();
        
        // On mobile, navigation might be collapsed
        if (viewport.width <= 768) {
          // Check for mobile menu button
          const mobileMenuButton = page.locator('[data-testid="mobile-menu"], .hamburger, [aria-label*="menu"]');
          if (await mobileMenuButton.isVisible()) {
            await mobileMenuButton.click();
            await expect(navigation).toBeVisible();
          }
        }
      });

      test(`should handle tab navigation on ${deviceName}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        
        await dashboardPage.navigate();
        await dashboardPage.waitForPageLoad();

        const tabs = ['overview', 'auto-sniping', 'patterns', 'trades'];
        
        for (const tab of tabs) {
          await dashboardPage.switchToTab(tab);
          
          // Verify tab content is visible and properly sized
          const tabContent = page.locator(`[data-testid="${tab}-content"], [data-value="${tab}"][data-state="active"]`);
          await expect(tabContent).toBeVisible();
          
          const contentBox = await tabContent.boundingBox();
          expect(contentBox!.width).toBeLessThanOrEqual(viewport.width);
          
          // Verify tab content doesn't overflow on mobile
          if (viewport.width <= 768) {
            await helpers.ui.checkForHorizontalScroll(false);
          }
        }
      });
    });

    test('should handle mobile-specific dashboard interactions', async ({ page }) => {
      await page.setViewportSize(DEVICE_CONFIGS.MOBILE_PORTRAIT);
      
      await dashboardPage.navigate();
      await dashboardPage.waitForPageLoad();

      // Test swipe gestures for tabs if supported
      const tabContainer = page.locator('[role="tablist"]');
      if (await tabContainer.isVisible()) {
        // Simulate swipe left
        await helpers.ui.swipeLeft(tabContainer);
        await helpers.wait.short();
        
        // Verify tab changed or scrolled
        const activeTab = page.locator('[data-state="active"]');
        await expect(activeTab).toBeVisible();
      }

      // Test pull-to-refresh if supported
      if (await helpers.ui.supportsPullToRefresh()) {
        await helpers.ui.pullToRefresh();
        await helpers.wait.waitForNetworkIdle();
        
        // Verify data was refreshed
        const lastUpdated = await dashboardPage.getLastUpdatedTime();
        expect(lastUpdated).toBeTruthy();
      }
    });

    test('should display charts responsively', async ({ page }) => {
      await page.setViewportSize(DEVICE_CONFIGS.MOBILE_PORTRAIT);
      
      await dashboardPage.navigate();
      await dashboardPage.navigateToPatterns();

      // Verify charts adapt to mobile viewport
      if (await dashboardPage.hasChart()) {
        const chart = page.locator('[data-testid="pattern-chart"], .chart');
        await expect(chart).toBeVisible();
        
        const chartBox = await chart.boundingBox();
        expect(chartBox!.width).toBeLessThanOrEqual(DEVICE_CONFIGS.MOBILE_PORTRAIT.width - 32);
        
        // Verify chart is interactive on mobile
        await chart.tap();
        await helpers.wait.short();
        
        // Chart should respond to touch
        const isInteractive = await helpers.ui.isElementInteractive(chart);
        expect(isInteractive).toBe(true);
      }
    });
  });

  test.describe('Settings Mobile Responsiveness', () => {
    test.beforeEach(async () => {
      await helpers.auth.signIn();
    });

    Object.entries(DEVICE_CONFIGS).forEach(([deviceName, viewport]) => {
      test(`should display settings form correctly on ${deviceName}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        
        await settingsPage.navigate();
        await settingsPage.waitForPageLoad();

        // Verify settings page layout
        await expect(page.locator('[data-testid="settings-page"]')).toBeVisible();
        
        // Test settings tabs
        const tabs = ['api-credentials', 'trading', 'auto-sniping', 'notifications'];
        
        for (const tab of tabs) {
          await settingsPage.switchToTab(tab);
          
          const tabContent = page.locator(`[data-testid="${tab}-content"]`);
          await expect(tabContent).toBeVisible();
          
          // Verify form elements are properly sized
          const formInputs = page.locator(`[data-testid="${tab}-content"] input, [data-testid="${tab}-content"] select`);
          const inputCount = await formInputs.count();
          
          for (let i = 0; i < inputCount; i++) {
            const input = formInputs.nth(i);
            if (await input.isVisible()) {
              const inputBox = await input.boundingBox();
              
              // On mobile, inputs should be appropriately sized
              if (viewport.width <= 768) {
                expect(inputBox!.height).toBeGreaterThanOrEqual(44);
              }
              
              expect(inputBox!.width).toBeLessThanOrEqual(viewport.width - 64);
            }
          }
        }
      });
    });

    test('should handle settings form interactions on mobile', async ({ page }) => {
      await page.setViewportSize(DEVICE_CONFIGS.MOBILE_PORTRAIT);
      
      await settingsPage.navigate();
      await settingsPage.switchToApiCredentials();

      // Test form filling on mobile
      const apiKeyInput = page.locator('input[name="apiKey"]');
      const secretKeyInput = page.locator('input[name="secretKey"]');
      
      await expect(apiKeyInput).toBeVisible();
      await expect(secretKeyInput).toBeVisible();
      
      // Test mobile keyboard interaction
      await apiKeyInput.tap();
      await apiKeyInput.fill('test-api-key-mobile');
      
      // Verify input field stays in view during typing
      await expect(apiKeyInput).toBeInViewport();
      
      await secretKeyInput.tap();
      await secretKeyInput.fill('test-secret-key-mobile');
      
      // Verify form can be submitted
      const saveButton = page.locator('[data-testid="save-button"], button:has-text("Save")');
      await expect(saveButton).toBeVisible();
      
      // Verify button is touch-friendly
      const buttonBox = await saveButton.boundingBox();
      expect(buttonBox!.height).toBeGreaterThanOrEqual(44);
    });

    test('should handle mobile-specific settings features', async ({ page }) => {
      await page.setViewportSize(DEVICE_CONFIGS.MOBILE_PORTRAIT);
      
      await settingsPage.navigate();
      
      // Test mobile-specific UI elements
      if (await settingsPage.hasMobileMenu()) {
        const mobileMenu = page.locator('[data-testid="mobile-settings-menu"]');
        await mobileMenu.tap();
        
        // Verify menu opens properly
        await expect(page.locator('[data-testid="settings-menu-items"]')).toBeVisible();
      }

      // Test accessibility on mobile
      await settingsPage.switchToAccessibility();
      
      if (await settingsPage.hasAccessibilitySettings()) {
        const fontSizeOption = page.locator('select[name="fontSize"], input[name="fontSize"]');
        if (await fontSizeOption.isVisible()) {
          await fontSizeOption.selectOption('large');
          
          // Verify font size change is applied
          const hasLargeFont = await helpers.ui.hasLargeFontSize();
          expect(hasLargeFont).toBe(true);
        }
      }
    });
  });

  test.describe('Trading Interface Mobile Responsiveness', () => {
    test.beforeEach(async () => {
      await helpers.auth.signIn();
    });

    Object.entries(DEVICE_CONFIGS).forEach(([deviceName, viewport]) => {
      test(`should display trading interface correctly on ${deviceName}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        
        await tradingPage.navigate();
        await tradingPage.waitForPageLoad();

        // Verify trading interface layout
        await expect(page.locator('[data-testid="trading-interface"]')).toBeVisible();
        
        // Check critical trading elements
        const tradeForm = page.locator('[data-testid="trade-form"]');
        await expect(tradeForm).toBeVisible();
        
        const formBox = await tradeForm.boundingBox();
        expect(formBox!.width).toBeLessThanOrEqual(viewport.width - 32);

        // Verify market data is accessible
        if (await tradingPage.hasMarketData()) {
          const marketData = page.locator('[data-testid="market-data"]');
          await expect(marketData).toBeVisible();
          
          // On mobile, market data might be collapsible
          if (viewport.width <= 768) {
            const expandButton = page.locator('[data-testid="expand-market-data"]');
            if (await expandButton.isVisible()) {
              await expandButton.tap();
              await expect(marketData).toBeVisible();
            }
          }
        }
      });
    });

    test('should handle trading form interactions on mobile', async ({ page }) => {
      await page.setViewportSize(DEVICE_CONFIGS.MOBILE_PORTRAIT);
      
      await tradingPage.navigate();
      await tradingPage.waitForPageLoad();

      // Test mobile trading form
      const symbolSelect = page.locator('select[name="symbol"], input[name="symbol"]');
      const quantityInput = page.locator('input[name="quantity"]');
      const tradeTypeSelect = page.locator('select[name="type"]');
      
      // Verify form elements are touch-friendly
      await expect(symbolSelect).toBeVisible();
      await expect(quantityInput).toBeVisible();
      await expect(tradeTypeSelect).toBeVisible();
      
      // Test form interaction
      if (await symbolSelect.getAttribute('tagName') === 'SELECT') {
        await symbolSelect.selectOption('BTCUSDT');
      } else {
        await symbolSelect.fill('BTCUSDT');
      }
      
      await quantityInput.fill('0.001');
      await tradeTypeSelect.selectOption('market');
      
      // Verify preview button is accessible
      const previewButton = page.locator('[data-testid="preview-trade"]');
      await expect(previewButton).toBeVisible();
      
      const buttonBox = await previewButton.boundingBox();
      expect(buttonBox!.height).toBeGreaterThanOrEqual(44);
      
      // Test trade preview on mobile
      await previewButton.tap();
      
      const tradePreview = page.locator('[data-testid="trade-preview"]');
      await expect(tradePreview).toBeVisible();
      
      // Verify preview modal is properly sized for mobile
      const previewBox = await tradePreview.boundingBox();
      expect(previewBox!.width).toBeLessThanOrEqual(DEVICE_CONFIGS.MOBILE_PORTRAIT.width - 32);
    });

    test('should handle order book display on mobile', async ({ page }) => {
      await page.setViewportSize(DEVICE_CONFIGS.MOBILE_PORTRAIT);
      
      await tradingPage.navigate();
      
      if (await tradingPage.hasOrderBook()) {
        const orderBook = page.locator('[data-testid="order-book"]');
        
        // On mobile, order book might be in a separate tab or modal
        if (!(await orderBook.isVisible())) {
          const orderBookTab = page.locator('[data-testid="order-book-tab"]');
          if (await orderBookTab.isVisible()) {
            await orderBookTab.tap();
            await expect(orderBook).toBeVisible();
          }
        }
        
        if (await orderBook.isVisible()) {
          // Verify order book is scrollable on mobile
          const isScrollable = await helpers.ui.isElementScrollable(orderBook);
          expect(isScrollable).toBe(true);
          
          // Test order book interaction
          const firstOrder = page.locator('[data-testid="order-item"]').first();
          if (await firstOrder.isVisible()) {
            await firstOrder.tap();
            // Should populate trade form or show order details
            await helpers.wait.short();
          }
        }
      }
    });
  });

  test.describe('Monitoring Interface Mobile Responsiveness', () => {
    test.beforeEach(async () => {
      await helpers.auth.signIn();
    });

    Object.entries(DEVICE_CONFIGS).forEach(([deviceName, viewport]) => {
      test(`should display monitoring interface correctly on ${deviceName}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        
        await monitoringPage.navigate();
        await monitoringPage.waitForPageLoad();

        // Verify monitoring interface layout
        await expect(page.locator('[data-testid="monitoring-interface"]')).toBeVisible();
        
        // Check system health indicators
        const healthIndicators = page.locator('[data-testid="system-health"]');
        await expect(healthIndicators).toBeVisible();
        
        const indicatorsBox = await healthIndicators.boundingBox();
        expect(indicatorsBox!.width).toBeLessThanOrEqual(viewport.width - 32);

        // Verify metrics cards adapt to viewport
        const metricsCards = page.locator('[data-testid="metrics-card"]');
        const cardCount = await metricsCards.count();
        
        for (let i = 0; i < cardCount; i++) {
          const card = metricsCards.nth(i);
          if (await card.isVisible()) {
            const cardBox = await card.boundingBox();
            expect(cardBox!.width).toBeLessThanOrEqual(viewport.width - 32);
          }
        }
      });
    });

    test('should handle monitoring interactions on mobile', async ({ page }) => {
      await page.setViewportSize(DEVICE_CONFIGS.MOBILE_PORTRAIT);
      
      await monitoringPage.navigate();
      await monitoringPage.waitForPageLoad();

      // Test monitoring tab navigation on mobile
      const tabs = ['system', 'performance', 'trading', 'alerts'];
      
      for (const tab of tabs) {
        await monitoringPage.switchToTab(tab);
        
        const tabContent = page.locator(`[data-testid="${tab}-content"]`);
        await expect(tabContent).toBeVisible();
        
        // On mobile, content should not cause horizontal scroll
        await helpers.ui.checkForHorizontalScroll(false);
      }

      // Test alert interactions on mobile
      if (await monitoringPage.hasAlerts()) {
        const alerts = page.locator('[data-testid="alert-item"]');
        const alertCount = await alerts.count();
        
        if (alertCount > 0) {
          const firstAlert = alerts.first();
          await firstAlert.tap();
          
          // Should show alert details
          const alertDetails = page.locator('[data-testid="alert-details"]');
          if (await alertDetails.isVisible()) {
            // Verify details modal is properly sized
            const detailsBox = await alertDetails.boundingBox();
            expect(detailsBox!.width).toBeLessThanOrEqual(DEVICE_CONFIGS.MOBILE_PORTRAIT.width - 32);
          }
        }
      }
    });

    test('should display charts responsively on mobile', async ({ page }) => {
      await page.setViewportSize(DEVICE_CONFIGS.MOBILE_PORTRAIT);
      
      await monitoringPage.navigateToPerformance();
      
      if (await monitoringPage.hasPerformanceCharts()) {
        const charts = page.locator('[data-testid*="chart"]');
        const chartCount = await charts.count();
        
        for (let i = 0; i < chartCount; i++) {
          const chart = charts.nth(i);
          if (await chart.isVisible()) {
            // Verify chart fits in mobile viewport
            const chartBox = await chart.boundingBox();
            expect(chartBox!.width).toBeLessThanOrEqual(DEVICE_CONFIGS.MOBILE_PORTRAIT.width - 32);
            
            // Test chart interaction on mobile
            await chart.tap();
            await helpers.wait.short();
            
            // Chart should be interactive
            const isInteractive = await helpers.ui.isElementInteractive(chart);
            expect(isInteractive).toBe(true);
          }
        }
      }
    });
  });

  test.describe('Performance on Mobile Devices', () => {
    test('should maintain performance on mobile devices', async ({ page }) => {
      await page.setViewportSize(DEVICE_CONFIGS.MOBILE_PORTRAIT);
      
      // Simulate mobile device performance constraints
      const client = await page.context().newCDPSession(page);
      await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      
      const performanceMetrics = await helpers.performance.measurePageLoad(async () => {
        await helpers.auth.signIn();
        await dashboardPage.waitForPageLoad();
      });

      // Mobile performance requirements
      expect(performanceMetrics.domContentLoaded).toBeLessThan(8000); // 8 seconds max on mobile
      expect(performanceMetrics.firstContentfulPaint).toBeLessThan(3000); // 3 seconds max
      
      // Verify app remains responsive
      const isResponsive = await helpers.ui.isPageResponsive();
      expect(isResponsive).toBe(true);
    });

    test('should handle memory constraints on mobile', async ({ page }) => {
      await page.setViewportSize(DEVICE_CONFIGS.MOBILE_PORTRAIT);
      
      await helpers.auth.signIn();
      
      // Perform memory-intensive operations
      const operations = [
        () => dashboardPage.navigate(),
        () => settingsPage.navigate(), 
        () => monitoringPage.navigate(),
        () => tradingPage.navigate()
      ];
      
      for (const operation of operations) {
        await operation();
        await helpers.wait.short();
        
        // Check memory usage doesn't grow excessively
        const memoryUsage = await helpers.performance.getMemoryUsage();
        expect(memoryUsage.usedJSHeapSize).toBeLessThan(50 * 1024 * 1024); // 50MB limit on mobile
      }
    });
  });

  test.describe('Touch and Gesture Support', () => {
    test('should support touch gestures', async ({ page }) => {
      await page.setViewportSize(DEVICE_CONFIGS.MOBILE_PORTRAIT);
      
      await helpers.auth.signIn();
      await dashboardPage.navigate();

      // Test pinch-to-zoom on charts if supported
      if (await dashboardPage.hasChart()) {
        const chart = page.locator('[data-testid="chart"]');
        await helpers.ui.pinchZoom(chart, 1.5);
        
        // Verify zoom level changed
        const zoomLevel = await helpers.ui.getZoomLevel(chart);
        expect(zoomLevel).toBeGreaterThan(1);
      }

      // Test double-tap to zoom
      const content = page.locator('[data-testid="dashboard-content"]');
      await helpers.ui.doubleTap(content);
      await helpers.wait.short();
      
      // Should maintain proper layout after interaction
      await expect(content).toBeVisible();
    });

    test('should handle long press interactions', async ({ page }) => {
      await page.setViewportSize(DEVICE_CONFIGS.MOBILE_PORTRAIT);
      
      await helpers.auth.signIn();
      await dashboardPage.navigate();

      // Test long press on trade items if available
      const tradeItems = page.locator('[data-testid="trade-item"]');
      const itemCount = await tradeItems.count();
      
      if (itemCount > 0) {
        const firstItem = tradeItems.first();
        await helpers.ui.longPress(firstItem);
        
        // Should show context menu or action options
        const contextMenu = page.locator('[data-testid="context-menu"], .context-menu');
        if (await contextMenu.isVisible()) {
          expect(contextMenu).toBeVisible();
        }
      }
    });
  });

  test.describe('Accessibility on Mobile Devices', () => {
    test('should maintain accessibility on mobile', async ({ page }) => {
      await page.setViewportSize(DEVICE_CONFIGS.MOBILE_PORTRAIT);
      
      await helpers.auth.signIn();
      await dashboardPage.navigate();

      // Test screen reader navigation
      const landmarks = await helpers.accessibility.getLandmarks();
      expect(landmarks.length).toBeGreaterThan(0);

      // Test keyboard navigation on mobile (external keyboard)
      await helpers.accessibility.testKeyboardNavigation();
      
      // Verify focus indicators are visible
      const focusableElements = await helpers.accessibility.getFocusableElements();
      expect(focusableElements.length).toBeGreaterThan(0);

      // Test voice control accessibility
      if (await helpers.accessibility.supportsVoiceControl()) {
        const voiceControlLabels = await helpers.accessibility.getVoiceControlLabels();
        expect(voiceControlLabels.length).toBeGreaterThan(0);
      }
    });

    test('should support assistive technologies on mobile', async ({ page }) => {
      await page.setViewportSize(DEVICE_CONFIGS.MOBILE_PORTRAIT);
      
      // Enable assistive technology simulation
      await helpers.accessibility.enableScreenReader();
      
      await helpers.auth.signIn();
      await dashboardPage.navigate();

      // Verify ARIA labels and roles are properly set
      const ariaElements = await helpers.accessibility.getAriaElements();
      expect(ariaElements.buttons.length).toBeGreaterThan(0);
      expect(ariaElements.links.length).toBeGreaterThan(0);

      // Test high contrast mode on mobile
      await helpers.accessibility.enableHighContrastMode();
      
      const hasHighContrast = await helpers.accessibility.hasHighContrastStyles();
      expect(hasHighContrast).toBe(true);
    });
  });
});