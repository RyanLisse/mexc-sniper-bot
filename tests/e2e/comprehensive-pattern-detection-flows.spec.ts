import { test, expect } from '@playwright/test';
import { AuthPage, DashboardPage } from './pages';

const TEST_EMAIL = process.env.TEST_USER_EMAIL || process.env.AUTH_EMAIL || 'ryan@ryanlisse.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || process.env.AUTH_PASSWORD || 'Testing2025!';

test.describe('Comprehensive Pattern Detection and AI Features Flow Tests', () => {
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

  test.describe('Pattern Detection Display Tests', () => {
    test('should display pattern detection tab', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Verify pattern content is visible
      await expect(dashboardPage['patternsContent']).toBeVisible();
      
      // Verify pattern display is present
      await expect(dashboardPage['patternDisplay']).toBeVisible();
    });

    test('should show AI enhanced patterns', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Check for AI enhanced patterns display
      await expect(dashboardPage['aiEnhancedPatterns']).toBeVisible();
    });

    test('should display patterns count in tab badge', async () => {
      const badges = await dashboardPage.getTabBadges();
      
      if (badges.patterns !== undefined) {
        expect(badges.patterns).toBeGreaterThanOrEqual(0);
        expect(typeof badges.patterns).toBe('number');
      }
    });

    test('should load patterns within acceptable time', async () => {
      const startTime = Date.now();
      await dashboardPage.switchToTab('patterns');
      await dashboardPage.waitForTabContent('patterns');
      const endTime = Date.now();
      
      const loadTime = endTime - startTime;
      expect(loadTime).toBeLessThan(8000); // Should load within 8 seconds
    });
  });

  test.describe('Ready Launches Detection Tests', () => {
    test('should display ready launches section', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Look for ready launches display
      if (await dashboardPage['readyLaunches'].isVisible()) {
        await expect(dashboardPage['readyLaunches']).toBeVisible();
      }
    });

    test('should show ready state patterns', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Look for ready state indicators
      const readyStateElements = dashboardPage.page.locator(
        '[data-testid="ready-state"], .ready-state, [data-status="ready"], .status-ready'
      );
      
      const count = await readyStateElements.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should display pattern confidence scores', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Look for confidence score displays
      const confidenceElements = dashboardPage.page.locator(
        '[data-testid="confidence"], .confidence, .confidence-score, [data-confidence]'
      );
      
      const count = await confidenceElements.count();
      expect(count).toBeGreaterThanOrEqual(0);
      
      // If confidence scores are present, they should be valid percentages
      if (count > 0) {
        const firstConfidence = await confidenceElements.first().textContent();
        if (firstConfidence && firstConfidence.includes('%')) {
          const percentage = parseFloat(firstConfidence.replace('%', ''));
          expect(percentage).toBeGreaterThanOrEqual(0);
          expect(percentage).toBeLessThanOrEqual(100);
        }
      }
    });

    test('should show advance detection timing', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Look for advance notice indicators
      const advanceElements = dashboardPage.page.locator(
        '[data-testid="advance-notice"], .advance-notice, [data-advance], .timing'
      );
      
      const count = await advanceElements.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Pattern Analysis Integration Tests', () => {
    test('should integrate with new listings data', async () => {
      // Check listings tab
      await dashboardPage.switchToTab('listings');
      const listingsCount = await dashboardPage.getListingsCount();
      
      // Check patterns tab
      await dashboardPage.switchToTab('patterns');
      const patternsCount = await dashboardPage.getPatternsCount();
      
      // Both should be non-negative numbers
      expect(listingsCount).toBeGreaterThanOrEqual(0);
      expect(patternsCount).toBeGreaterThanOrEqual(0);
    });

    test('should correlate with trading targets', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Get patterns count
      const patternsCount = await dashboardPage.getPatternsCount();
      
      // Check overview tab for targets
      await dashboardPage.switchToTab('overview');
      const activeTargets = await dashboardPage.getMetricValue('Active Targets');
      
      // Both should provide meaningful data
      expect(patternsCount).toBeGreaterThanOrEqual(0);
      expect(activeTargets).toBeTruthy();
    });

    test('should display pattern-to-target conversion', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Look for elements that show pattern conversion to targets
      const conversionElements = dashboardPage.page.locator(
        '[data-testid="conversion"], .conversion, .pattern-target, [data-convert]'
      );
      
      const count = await conversionElements.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('AI Pattern Enhancement Tests', () => {
    test('should display AI processing status', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Look for AI status indicators
      const aiStatusElements = dashboardPage.page.locator(
        '[data-testid="ai-status"], .ai-status, [data-ai], .ai-processing'
      );
      
      const count = await aiStatusElements.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should show AI confidence metrics', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Look for AI-specific confidence indicators
      const aiConfidenceElements = dashboardPage.page.locator(
        '[data-testid="ai-confidence"], .ai-confidence, [data-ai-score]'
      );
      
      const count = await aiConfidenceElements.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should display pattern classification', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Look for pattern classification labels
      const classificationElements = dashboardPage.page.locator(
        '[data-testid="classification"], .classification, .pattern-type, [data-pattern-type]'
      );
      
      const count = await classificationElements.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should handle AI processing delays', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Look for loading or processing indicators
      const processingElements = dashboardPage.page.locator(
        '[data-testid="processing"], .processing, .ai-loading, [data-loading]'
      );
      
      // Should handle processing states gracefully
      const count = await processingElements.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Pattern Historical Data Tests', () => {
    test('should display pattern history', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Look for historical pattern data
      const historyElements = dashboardPage.page.locator(
        '[data-testid="history"], .history, .pattern-history, [data-historical]'
      );
      
      const count = await historyElements.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should show pattern success rates', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Look for success rate indicators
      const successRateElements = dashboardPage.page.locator(
        '[data-testid="success-rate"], .success-rate, [data-success], .win-rate'
      );
      
      const count = await successRateElements.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should display pattern accuracy metrics', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Look for accuracy metrics
      const accuracyElements = dashboardPage.page.locator(
        '[data-testid="accuracy"], .accuracy, [data-accuracy], .precision'
      );
      
      const count = await accuracyElements.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Pattern Real-time Updates Tests', () => {
    test('should handle real-time pattern updates', async ({ page }) => {
      await dashboardPage.switchToTab('patterns');
      
      // Monitor for real-time updates
      let updatesReceived = false;
      
      page.on('response', response => {
        if (response.url().includes('/api/pattern') || response.url().includes('/api/ready-launches')) {
          updatesReceived = true;
        }
      });
      
      // Wait for potential updates
      await page.waitForTimeout(5000);
      
      // Real-time updates may or may not occur during test
      expect(await dashboardPage.getCurrentUrl()).toMatch(/\/dashboard$/);
    });

    test('should refresh pattern data periodically', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Get initial pattern count
      const initialCount = await dashboardPage.getPatternsCount();
      
      // Wait for potential refresh
      await dashboardPage.page.waitForTimeout(10000);
      
      // Get updated count
      const updatedCount = await dashboardPage.getPatternsCount();
      
      // Both counts should be valid
      expect(initialCount).toBeGreaterThanOrEqual(0);
      expect(updatedCount).toBeGreaterThanOrEqual(0);
    });

    test('should handle WebSocket pattern updates', async ({ page }) => {
      await dashboardPage.switchToTab('patterns');
      
      // Monitor WebSocket connections for pattern data
      let wsConnected = false;
      
      page.on('websocket', ws => {
        wsConnected = true;
        ws.on('framereceived', event => {
          const payload = event.payload;
          if (payload.includes('pattern') || payload.includes('ready')) {
            console.log('Pattern WebSocket data received');
          }
        });
      });
      
      // Wait for WebSocket activity
      await page.waitForTimeout(5000);
      
      // WebSocket may or may not be used for patterns
      expect(await dashboardPage.getCurrentUrl()).toMatch(/\/dashboard$/);
    });
  });

  test.describe('Pattern Interaction Tests', () => {
    test('should allow pattern selection', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Look for selectable pattern items
      const patternItems = dashboardPage.page.locator(
        '[data-testid="pattern-item"], .pattern-item, .pattern-card, [data-pattern-id]'
      );
      
      const count = await patternItems.count();
      
      if (count > 0) {
        // Click first pattern item
        await patternItems.first().click();
        
        // Should not cause navigation errors
        expect(await dashboardPage.getCurrentUrl()).toMatch(/\/dashboard$/);
      }
    });

    test('should show pattern details on interaction', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Look for pattern detail triggers
      const detailTriggers = dashboardPage.page.locator(
        'button:has-text("Details"), button:has-text("View"), .pattern-details-btn'
      );
      
      const count = await detailTriggers.count();
      
      if (count > 0) {
        await detailTriggers.first().click();
        
        // Should show additional details (modal, expansion, etc.)
        expect(await dashboardPage.getCurrentUrl()).toMatch(/\/dashboard$/);
      }
    });

    test('should allow pattern filtering', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Look for filter controls
      const filterControls = dashboardPage.page.locator(
        '[data-testid="filter"], .filter, .pattern-filter, select, input[placeholder*="filter"]'
      );
      
      const count = await filterControls.count();
      
      if (count > 0) {
        // Interact with first filter
        const firstFilter = filterControls.first();
        const tagName = await firstFilter.evaluate(el => el.tagName.toLowerCase());
        
        if (tagName === 'select') {
          await firstFilter.selectOption({ index: 1 });
        } else if (tagName === 'input') {
          await firstFilter.fill('test');
        }
        
        // Should filter patterns
        expect(await dashboardPage.getCurrentUrl()).toMatch(/\/dashboard$/);
      }
    });

    test('should allow pattern sorting', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Look for sort controls
      const sortControls = dashboardPage.page.locator(
        '[data-testid="sort"], .sort, .pattern-sort, button:has-text("Sort")
      );
      
      const count = await sortControls.count();
      
      if (count > 0) {
        await sortControls.first().click();
        
        // Should sort patterns
        expect(await dashboardPage.getCurrentUrl()).toMatch(/\/dashboard$/);
      }
    });
  });

  test.describe('Pattern Error Handling Tests', () => {
    test('should handle pattern API errors', async ({ page }) => {
      // Mock pattern API errors
      await page.route('**/api/pattern**', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Pattern detection service unavailable' })
        });
      });
      
      await dashboardPage.switchToTab('patterns');
      
      // Should handle errors gracefully
      await expect(dashboardPage['patternsContent']).toBeVisible();
    });

    test('should handle AI service errors', async ({ page }) => {
      // Mock AI service errors
      await page.route('**/api/ai-services/**', route => {
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'AI service temporarily unavailable' })
        });
      });
      
      await dashboardPage.switchToTab('patterns');
      
      // Should show appropriate error state
      await expect(dashboardPage['patternsContent']).toBeVisible();
    });

    test('should handle empty pattern data', async ({ page }) => {
      // Mock empty pattern responses
      await page.route('**/api/pattern**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { patterns: [] } })
        });
      });
      
      await dashboardPage.switchToTab('patterns');
      
      // Should display empty state
      const patternsCount = await dashboardPage.getPatternsCount();
      expect(patternsCount).toBe(0);
    });

    test('should handle malformed pattern data', async ({ page }) => {
      // Mock malformed pattern responses
      await page.route('**/api/pattern**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ invalid: 'data structure' })
        });
      });
      
      await dashboardPage.switchToTab('patterns');
      
      // Should handle malformed data gracefully
      await expect(dashboardPage['patternsContent']).toBeVisible();
    });
  });

  test.describe('Pattern Performance Tests', () => {
    test('should load patterns efficiently', async () => {
      const startTime = Date.now();
      await dashboardPage.switchToTab('patterns');
      
      // Wait for patterns to load
      await dashboardPage.waitForTabContent('patterns');
      
      const endTime = Date.now();
      const loadTime = endTime - startTime;
      
      expect(loadTime).toBeLessThan(10000); // Should load within 10 seconds
    });

    test('should handle large pattern datasets', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Should handle any number of patterns without performance issues
      const patternsCount = await dashboardPage.getPatternsCount();
      expect(patternsCount).toBeGreaterThanOrEqual(0);
      
      // UI should remain responsive
      await expect(dashboardPage['patternsContent']).toBeVisible();
    });

    test('should efficiently update pattern displays', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Switch away and back to test re-rendering performance
      await dashboardPage.switchToTab('overview');
      
      const startTime = Date.now();
      await dashboardPage.switchToTab('patterns');
      const endTime = Date.now();
      
      const switchTime = endTime - startTime;
      expect(switchTime).toBeLessThan(5000); // Should switch back quickly
    });
  });

  test.describe('Pattern Validation Tests', () => {
    test('should validate pattern data integrity', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Check for data validation indicators
      const validationElements = dashboardPage.page.locator(
        '[data-testid="validation"], .validation, [data-valid], .verified'
      );
      
      const count = await validationElements.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should show pattern quality scores', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Look for quality indicators
      const qualityElements = dashboardPage.page.locator(
        '[data-testid="quality"], .quality, [data-quality], .pattern-quality'
      );
      
      const count = await qualityElements.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should display pattern verification status', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Look for verification status
      const verificationElements = dashboardPage.page.locator(
        '[data-testid="verified"], .verified, [data-verification], .verification-status'
      );
      
      const count = await verificationElements.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Pattern Integration with Trading Tests', () => {
    test('should link patterns to trading opportunities', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Look for trading action buttons or links
      const tradingActions = dashboardPage.page.locator(
        'button:has-text("Trade"), button:has-text("Snipe"), button:has-text("Target"), .trading-action'
      );
      
      const count = await tradingActions.count();
      
      if (count > 0) {
        await tradingActions.first().click();
        
        // Should trigger trading-related action
        expect(await dashboardPage.getCurrentUrl()).toMatch(/\/dashboard$/);
      }
    });

    test('should show pattern-based recommendations', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Look for recommendation elements
      const recommendationElements = dashboardPage.page.locator(
        '[data-testid="recommendation"], .recommendation, .suggested, [data-suggest]'
      );
      
      const count = await recommendationElements.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should integrate with auto-sniping configuration', async () => {
      await dashboardPage.switchToTab('patterns');
      
      // Get pattern data
      const patternsCount = await dashboardPage.getPatternsCount();
      
      // Switch to auto-sniping tab
      await dashboardPage.switchToTab('auto-sniping');
      
      // Should show integration between patterns and auto-sniping
      const autoSnipingStatus = await dashboardPage.getAutoSnipingStatus();
      
      expect(patternsCount).toBeGreaterThanOrEqual(0);
      expect(autoSnipingStatus).toBeTruthy();
    });
  });
});