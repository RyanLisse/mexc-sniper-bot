import { test, expect } from '@playwright/test';
import { E2EHelpers, TEST_CREDENTIALS } from './utils/e2e-test-helpers';
import { AuthPage, DashboardPage, HomePage, SettingsPage, MonitoringPage } from './pages';

test.describe('Visual Regression Testing', () => {
  let helpers: E2EHelpers;
  let authPage: AuthPage;
  let dashboardPage: DashboardPage;
  let homePage: HomePage;
  let settingsPage: SettingsPage;
  let monitoringPage: MonitoringPage;

  test.beforeEach(async ({ page }) => {
    helpers = new E2EHelpers(page);
    authPage = new AuthPage(page);
    dashboardPage = new DashboardPage(page);
    homePage = new HomePage(page);
    settingsPage = new SettingsPage(page);
    monitoringPage = new MonitoringPage(page);

    // Mask dynamic content for consistent screenshots
    await helpers.visual.maskDynamicContent();
  });

  test.describe('Homepage Visual Tests', () => {
    test('should match homepage layout', async ({ page }) => {
      await homePage.navigate();
      await homePage.waitForPageLoad();
      
      // Wait for all images and content to load
      await helpers.wait.waitForNetworkIdle();
      
      // Take full page screenshot
      await expect(page).toHaveScreenshot('homepage-full.png', {
        fullPage: true,
        threshold: 0.2,
        animations: 'disabled'
      });
    });

    test('should match homepage hero section', async () => {
      await homePage.navigate();
      await homePage.waitForPageLoad();
      
      // Screenshot just the hero section
      await helpers.visual.compareElement(
        'main > div:first-child',
        'homepage-hero-section',
        { threshold: 0.3 }
      );
    });

    test('should match homepage features section', async () => {
      await homePage.navigate();
      await homePage.scrollToFeatures();
      
      await helpers.visual.compareElement(
        '.grid.md\\:grid-cols-3',
        'homepage-features-section',
        { threshold: 0.2 }
      );
    });

    test('should match homepage statistics section', async () => {
      await homePage.navigate();
      await homePage.scrollToStatistics();
      
      await helpers.visual.compareElement(
        'text=Platform Performance',
        'homepage-statistics-section',
        { threshold: 0.2 }
      );
    });

    test('should match homepage call-to-action section', async () => {
      await homePage.navigate();
      await homePage.scrollToCallToAction();
      
      await helpers.visual.compareElement(
        'text=Ready to Start Trading?',
        'homepage-cta-section',
        { threshold: 0.2 }
      );
    });
  });

  test.describe('Authentication Visual Tests', () => {
    test('should match auth page layout', async ({ page }) => {
      await authPage.navigate();
      await authPage.waitForPageLoad();
      
      await expect(page).toHaveScreenshot('auth-page.png', {
        threshold: 0.2,
        animations: 'disabled'
      });
    });

    test('should match auth form elements', async () => {
      await authPage.navigate();
      await authPage.waitForPageLoad();
      
      // Screenshot the auth form
      await helpers.visual.compareElement(
        'form, [data-testid="auth-form"]',
        'auth-form',
        { threshold: 0.2 }
      );
    });

    test('should match auth error state', async () => {
      await authPage.navigate();
      await authPage.signIn('invalid@email.com', 'wrongpassword');
      
      // Wait for error to appear
      await helpers.wait.waitForElement('[role="alert"], .error');
      
      await helpers.visual.compareScreenshot('auth-error-state');
    });
  });

  test.describe('Dashboard Visual Tests', () => {
    test.beforeEach(async () => {
      // Authenticate before dashboard tests
      await helpers.auth.signIn();
      await dashboardPage.waitForPageLoad();
    });

    test('should match dashboard layout', async ({ page }) => {
      await helpers.wait.waitForLoading();
      
      await expect(page).toHaveScreenshot('dashboard-full.png', {
        fullPage: true,
        threshold: 0.3,
        animations: 'disabled'
      });
    });

    test('should match dashboard metrics cards', async () => {
      await dashboardPage.waitForMetrics();
      
      await helpers.visual.compareElement(
        '.grid.gap-4.md\\:grid-cols-2.lg\\:grid-cols-4',
        'dashboard-metrics-cards',
        { threshold: 0.2 }
      );
    });

    test('should match trading chart section', async () => {
      await helpers.wait.waitForLoading();
      
      if (await dashboardPage.isTradingChartVisible()) {
        await helpers.visual.compareElement(
          '[data-testid="trading-chart"], .trading-chart',
          'dashboard-trading-chart',
          { threshold: 0.3 }
        );
      }
    });

    test('should match dashboard tabs', async () => {
      await helpers.visual.compareElement(
        '[role="tablist"]',
        'dashboard-tabs',
        { threshold: 0.2 }
      );
    });

    test('should match auto-sniping tab content', async () => {
      await dashboardPage.switchToTab('auto-sniping');
      await dashboardPage.waitForTabContent('auto-sniping');
      
      await helpers.visual.compareElement(
        '[data-value="auto-sniping"][data-state="active"]',
        'dashboard-auto-sniping-tab',
        { threshold: 0.3 }
      );
    });

    test('should match overview tab content', async () => {
      await dashboardPage.switchToTab('overview');
      await dashboardPage.waitForTabContent('overview');
      
      await helpers.visual.compareElement(
        '[data-value="overview"][data-state="active"]',
        'dashboard-overview-tab',
        { threshold: 0.3 }
      );
    });

    test('should match patterns tab content', async () => {
      await dashboardPage.switchToTab('patterns');
      await dashboardPage.waitForTabContent('patterns');
      
      await helpers.visual.compareElement(
        '[data-value="patterns"][data-state="active"]',
        'dashboard-patterns-tab',
        { threshold: 0.3 }
      );
    });

    test('should match trading history tab content', async () => {
      await dashboardPage.switchToTab('trades');
      await dashboardPage.waitForTabContent('trades');
      
      await helpers.visual.compareElement(
        '[data-value="trades"][data-state="active"]',
        'dashboard-trades-tab',
        { threshold: 0.3 }
      );
    });
  });

  test.describe('Settings Visual Tests', () => {
    test.beforeEach(async () => {
      await helpers.auth.signIn();
    });

    test('should match settings page layout', async ({ page }) => {
      await settingsPage.navigate();
      await settingsPage.waitForPageLoad();
      
      await expect(page).toHaveScreenshot('settings-page.png', {
        threshold: 0.2,
        animations: 'disabled'
      });
    });

    test('should match API credentials tab', async () => {
      await settingsPage.navigate();
      await settingsPage.switchToApiCredentials();
      
      await helpers.visual.compareElement(
        '[data-value="api-credentials"][data-state="active"]',
        'settings-api-credentials-tab',
        { threshold: 0.2 }
      );
    });

    test('should match trading settings tab', async () => {
      await settingsPage.navigate();
      await settingsPage.switchToTradingSettings();
      
      await helpers.visual.compareElement(
        '[data-value="trading"][data-state="active"]',
        'settings-trading-tab',
        { threshold: 0.2 }
      );
    });

    test('should match auto-sniping settings tab', async () => {
      await settingsPage.navigate();
      await settingsPage.switchToAutoSnipingSettings();
      
      await helpers.visual.compareElement(
        '[data-value="auto-sniping"][data-state="active"]',
        'settings-auto-sniping-tab',
        { threshold: 0.2 }
      );
    });

    test('should match notifications settings tab', async () => {
      await settingsPage.navigate();
      await settingsPage.switchToNotifications();
      
      await helpers.visual.compareElement(
        '[data-value="notifications"][data-state="active"]',
        'settings-notifications-tab',
        { threshold: 0.2 }
      );
    });
  });

  test.describe('Monitoring Visual Tests', () => {
    test.beforeEach(async () => {
      await helpers.auth.signIn();
    });

    test('should match monitoring page layout', async ({ page }) => {
      await monitoringPage.navigate();
      await monitoringPage.waitForPageLoad();
      
      await expect(page).toHaveScreenshot('monitoring-page.png', {
        threshold: 0.3,
        animations: 'disabled'
      });
    });

    test('should match system overview tab', async () => {
      await monitoringPage.navigate();
      await monitoringPage.switchToSystemOverview();
      
      await helpers.visual.compareElement(
        '[data-value="system"][data-state="active"]',
        'monitoring-system-overview-tab',
        { threshold: 0.3 }
      );
    });

    test('should match performance metrics tab', async () => {
      await monitoringPage.navigate();
      await monitoringPage.switchToPerformance();
      
      await helpers.visual.compareElement(
        '[data-value="performance"][data-state="active"]',
        'monitoring-performance-tab',
        { threshold: 0.3 }
      );
    });

    test('should match trading analytics tab', async () => {
      await monitoringPage.navigate();
      await monitoringPage.switchToTradingAnalytics();
      
      await helpers.visual.compareElement(
        '[data-value="trading"][data-state="active"]',
        'monitoring-trading-analytics-tab',
        { threshold: 0.3 }
      );
    });
  });

  test.describe('Responsive Design Visual Tests', () => {
    test.beforeEach(async () => {
      await helpers.auth.signIn();
    });

    test('should match mobile dashboard layout', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await dashboardPage.navigate();
      await dashboardPage.waitForPageLoad();
      
      await expect(page).toHaveScreenshot('dashboard-mobile.png', {
        threshold: 0.3,
        animations: 'disabled'
      });
    });

    test('should match tablet dashboard layout', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await dashboardPage.navigate();
      await dashboardPage.waitForPageLoad();
      
      await expect(page).toHaveScreenshot('dashboard-tablet.png', {
        threshold: 0.3,
        animations: 'disabled'
      });
    });

    test('should match desktop dashboard layout', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await dashboardPage.navigate();
      await dashboardPage.waitForPageLoad();
      
      await expect(page).toHaveScreenshot('dashboard-desktop.png', {
        threshold: 0.3,
        animations: 'disabled'
      });
    });

    test('should match mobile homepage layout', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await homePage.navigate();
      await homePage.waitForPageLoad();
      
      await expect(page).toHaveScreenshot('homepage-mobile.png', {
        fullPage: true,
        threshold: 0.3,
        animations: 'disabled'
      });
    });

    test('should match mobile auth layout', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await authPage.navigate();
      await authPage.waitForPageLoad();
      
      await expect(page).toHaveScreenshot('auth-mobile.png', {
        threshold: 0.2,
        animations: 'disabled'
      });
    });
  });

  test.describe('Dark Mode Visual Tests', () => {
    test.beforeEach(async ({ page }) => {
      // Enable dark mode if available
      await page.addInitScript(() => {
        localStorage.setItem('theme', 'dark');
        document.documentElement.classList.add('dark');
      });
    });

    test('should match dark mode homepage', async ({ page }) => {
      await homePage.navigate();
      await homePage.waitForPageLoad();
      
      await expect(page).toHaveScreenshot('homepage-dark-mode.png', {
        fullPage: true,
        threshold: 0.3,
        animations: 'disabled'
      });
    });

    test('should match dark mode dashboard', async ({ page }) => {
      await helpers.auth.signIn();
      await dashboardPage.waitForPageLoad();
      
      await expect(page).toHaveScreenshot('dashboard-dark-mode.png', {
        fullPage: true,
        threshold: 0.3,
        animations: 'disabled'
      });
    });

    test('should match dark mode auth page', async ({ page }) => {
      await authPage.navigate();
      await authPage.waitForPageLoad();
      
      await expect(page).toHaveScreenshot('auth-dark-mode.png', {
        threshold: 0.2,
        animations: 'disabled'
      });
    });
  });

  test.describe('Error State Visual Tests', () => {
    test('should match 404 error page', async ({ page }) => {
      await page.goto(`${helpers.navigation.page.url()}/non-existent-page`);
      
      await expect(page).toHaveScreenshot('error-404-page.png', {
        threshold: 0.2,
        animations: 'disabled'
      });
    });

    test('should match network error state', async ({ page }) => {
      await helpers.auth.signIn();
      
      // Simulate network error
      await helpers.api.interceptError('**/api/**', 500, 'Network Error');
      
      await dashboardPage.navigate();
      await helpers.wait.waitForLoading();
      
      await helpers.visual.compareScreenshot('dashboard-network-error-state');
    });

    test('should match empty data state', async ({ page }) => {
      await helpers.auth.signIn();
      
      // Mock empty responses
      await helpers.api.interceptResponse('**/api/**', { success: true, data: [] });
      
      await dashboardPage.navigate();
      await dashboardPage.switchToTab('trades');
      
      await helpers.visual.compareElement(
        '[data-value="trades"][data-state="active"]',
        'dashboard-empty-trades-state'
      );
    });
  });

  test.describe('Loading State Visual Tests', () => {
    test('should match loading state', async ({ page }) => {
      // Slow down responses to capture loading state
      await page.route('**/api/**', async route => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        route.continue();
      });
      
      await helpers.auth.signIn();
      
      // Quickly take screenshot during loading
      await dashboardPage.navigate();
      
      // Look for loading indicators
      const loadingElements = page.locator('.loading, [data-testid="loading"], .spinner');
      if (await loadingElements.first().isVisible()) {
        await helpers.visual.compareScreenshot('dashboard-loading-state');
      }
    });

    test('should match skeleton loading state', async ({ page }) => {
      await helpers.auth.signIn();
      
      // Look for skeleton loaders
      const skeletonElements = page.locator('.skeleton, [data-testid="skeleton"], .shimmer');
      
      if (await skeletonElements.first().isVisible()) {
        await helpers.visual.compareElement(
          '.skeleton, [data-testid="skeleton"], .shimmer',
          'skeleton-loading-state'
        );
      }
    });
  });

  test.describe('Interactive State Visual Tests', () => {
    test.beforeEach(async () => {
      await helpers.auth.signIn();
    });

    test('should match hover states', async ({ page }) => {
      await dashboardPage.navigate();
      await dashboardPage.waitForPageLoad();
      
      // Hover over first metric card
      const metricCard = dashboardPage['totalBalanceCard'];
      await metricCard.hover();
      
      await helpers.visual.compareElement(
        '.grid.gap-4.md\\:grid-cols-2.lg\\:grid-cols-4',
        'dashboard-metrics-hover-state'
      );
    });

    test('should match focus states', async ({ page }) => {
      await settingsPage.navigate();
      await settingsPage.switchToApiCredentials();
      
      // Focus on API key input
      await settingsPage['mexcApiKeyInput'].focus();
      
      await helpers.visual.compareElement(
        'input[name="apiKey"], input[placeholder*="API Key"]',
        'input-focus-state'
      );
    });

    test('should match active tab states', async ({ page }) => {
      await dashboardPage.navigate();
      
      // Switch to patterns tab and capture active state
      await dashboardPage.switchToTab('patterns');
      
      await helpers.visual.compareElement(
        '[role="tablist"]',
        'dashboard-tabs-active-state'
      );
    });
  });
});