import { expect, test } from '@playwright/test';

test.describe('Multi-Phase Trading Strategy Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard and ensure authentication
    await page.goto('/dashboard');
    
    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="dashboard-header"]', { timeout: 10000 });
  });

  test('should create and configure a new multi-phase strategy', async ({ page }) => {
    // Navigate to strategy creation page
    await page.click('[data-testid="create-strategy-button"]');
    
    // Fill in strategy details
    await page.fill('[data-testid="strategy-name"]', 'E2E Test Strategy');
    await page.fill('[data-testid="symbol-input"]', 'BTCUSDT');
    await page.fill('[data-testid="entry-price"]', '50000');
    await page.fill('[data-testid="position-size"]', '1');
    
    // Select strategy type
    await page.selectOption('[data-testid="strategy-type"]', 'normal');
    
    // Configure risk settings
    await page.fill('[data-testid="stop-loss-percent"]', '10');
    
    // Add description
    await page.fill('[data-testid="strategy-description"]', 'E2E test strategy for multi-phase trading');
    
    // Create strategy
    await page.click('[data-testid="create-strategy-submit"]');
    
    // Verify strategy was created
    await expect(page.locator('[data-testid="strategy-created-success"]')).toBeVisible();
    
    // Verify strategy appears in list
    await page.goto('/dashboard/strategies');
    await expect(page.locator('text=E2E Test Strategy')).toBeVisible();
  });

  test('should display strategy phases with correct visualization', async ({ page }) => {
    // Assume strategy exists from previous test or setup
    await page.goto('/dashboard/strategies');
    
    // Click on a strategy to view details
    await page.click('[data-testid="strategy-card"]:first-child');
    
    // Verify phase visualization
    await expect(page.locator('[data-testid="phase-visualization"]')).toBeVisible();
    
    // Check for phase indicators
    await expect(page.locator('text=⬜')).toBeVisible(); // Pending phases
    await expect(page.locator('text=Phase 1')).toBeVisible();
    await expect(page.locator('text=Phase 2')).toBeVisible();
    
    // Verify phase details
    await expect(page.locator('[data-testid="phase-details"]')).toBeVisible();
    await expect(page.locator('text=+50%')).toBeVisible(); // Target percentage
    await expect(page.locator('text=25%')).toBeVisible(); // Sell percentage
  });

  test('should simulate strategy execution with price updates', async ({ page }) => {
    await page.goto('/dashboard/strategies');
    
    // Open strategy details
    await page.click('[data-testid="strategy-card"]:first-child');
    
    // Open simulation mode
    await page.click('[data-testid="simulate-strategy"]');
    
    // Enter price update
    await page.fill('[data-testid="current-price-input"]', '75000'); // 50% increase
    await page.click('[data-testid="update-price-button"]');
    
    // Verify phase execution
    await expect(page.locator('text=✅ Phase 1')).toBeVisible(); // Completed phase
    await expect(page.locator('text=🎯 Phase 2')).toBeVisible(); // Next target
    
    // Check execution details
    await expect(page.locator('[data-testid="execution-summary"]')).toBeVisible();
    await expect(page.locator('text=Realized P&L')).toBeVisible();
    await expect(page.locator('text=Unrealized P&L')).toBeVisible();
    
    // Verify phase was recorded
    await expect(page.locator('[data-testid="phase-execution-history"]')).toBeVisible();
    await expect(page.locator('text=Phase 1 executed')).toBeVisible();
  });

  test('should handle multiple phase executions in sequence', async ({ page }) => {
    await page.goto('/dashboard/strategies');
    await page.click('[data-testid="strategy-card"]:first-child');
    await page.click('[data-testid="simulate-strategy"]');
    
    // Execute multiple price updates
    const priceUpdates = [
      { price: '75000', expectedPhases: 1 }, // 50% - Phase 1
      { price: '100000', expectedPhases: 2 }, // 100% - Phase 1,2
      { price: '112500', expectedPhases: 3 }, // 125% - Phase 1,2,3
      { price: '137500', expectedPhases: 4 }, // 175% - All phases
    ];
    
    for (const update of priceUpdates) {
      await page.fill('[data-testid="current-price-input"]', update.price);
      await page.click('[data-testid="update-price-button"]');
      
      // Wait for update to process
      await page.waitForTimeout(1000);
      
      // Verify correct number of completed phases
      const completedPhases = await page.locator('text=✅').count();
      expect(completedPhases).toBe(update.expectedPhases);
    }
    
    // Verify strategy completion
    await expect(page.locator('[data-testid="strategy-completed"]')).toBeVisible();
    await expect(page.locator('text=All phases completed')).toBeVisible();
  });

  test('should display performance metrics correctly', async ({ page }) => {
    await page.goto('/dashboard/strategies');
    await page.click('[data-testid="strategy-card"]:first-child');
    
    // Navigate to performance tab
    await page.click('[data-testid="performance-tab"]');
    
    // Verify performance metrics
    await expect(page.locator('[data-testid="total-pnl"]')).toBeVisible();
    await expect(page.locator('[data-testid="win-rate"]')).toBeVisible();
    await expect(page.locator('[data-testid="avg-execution-time"]')).toBeVisible();
    
    // Check for performance charts
    await expect(page.locator('[data-testid="performance-chart"]')).toBeVisible();
    
    // Verify phase breakdown
    await expect(page.locator('[data-testid="phase-breakdown"]')).toBeVisible();
    await expect(page.locator('text=Phase 1')).toBeVisible();
  });

  test('should allow strategy modification and updates', async ({ page }) => {
    await page.goto('/dashboard/strategies');
    await page.click('[data-testid="strategy-card"]:first-child');
    
    // Click edit strategy
    await page.click('[data-testid="edit-strategy"]');
    
    // Modify strategy parameters
    await page.fill('[data-testid="strategy-name"]', 'Modified E2E Strategy');
    await page.fill('[data-testid="stop-loss-percent"]', '15');
    
    // Save changes
    await page.click('[data-testid="save-strategy"]');
    
    // Verify update success
    await expect(page.locator('[data-testid="strategy-updated-success"]')).toBeVisible();
    
    // Verify changes are reflected
    await expect(page.locator('text=Modified E2E Strategy')).toBeVisible();
    await expect(page.locator('text=15%')).toBeVisible(); // Stop loss
  });

  test('should handle risk assessment and warnings', async ({ page }) => {
    await page.goto('/dashboard/strategies');
    
    // Create high-risk strategy
    await page.click('[data-testid="create-strategy-button"]');
    await page.fill('[data-testid="strategy-name"]', 'High Risk Strategy');
    await page.fill('[data-testid="symbol-input"]', 'ALTCOIN');
    await page.fill('[data-testid="entry-price"]', '1');
    await page.fill('[data-testid="position-size"]', '10000'); // Large position
    await page.selectOption('[data-testid="strategy-type"]', 'aggressive');
    
    // Should show risk warning
    await expect(page.locator('[data-testid="high-risk-warning"]')).toBeVisible();
    await expect(page.locator('text=high risk')).toBeVisible();
    
    // Proceed with creation
    await page.click('[data-testid="accept-risk"]');
    await page.click('[data-testid="create-strategy-submit"]');
    
    // Verify risk indicators in strategy view
    await page.goto('/dashboard/strategies');
    await expect(page.locator('[data-testid="risk-indicator-high"]')).toBeVisible();
  });

  test('should export and import strategy configurations', async ({ page }) => {
    await page.goto('/dashboard/strategies');
    await page.click('[data-testid="strategy-card"]:first-child');
    
    // Export strategy
    await page.click('[data-testid="strategy-actions"]');
    await page.click('[data-testid="export-strategy"]');
    
    // Verify export modal
    await expect(page.locator('[data-testid="export-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="export-json"]')).toBeVisible();
    
    // Copy export data
    await page.click('[data-testid="copy-export"]');
    
    // Close export modal
    await page.click('[data-testid="close-export"]');
    
    // Test import
    await page.click('[data-testid="import-strategy"]');
    await expect(page.locator('[data-testid="import-modal"]')).toBeVisible();
    
    // Paste and import (simulate)
    await page.fill('[data-testid="import-json"]', '{"id":"test","name":"Imported Strategy","levels":[]}');
    await page.click('[data-testid="validate-import"]');
    
    // Should show validation result
    await expect(page.locator('[data-testid="import-validation"]')).toBeVisible();
  });

  test('should handle real-time price updates and notifications', async ({ page }) => {
    await page.goto('/dashboard/strategies');
    await page.click('[data-testid="strategy-card"]:first-child');
    
    // Enable real-time mode
    await page.click('[data-testid="enable-realtime"]');
    
    // Verify real-time status
    await expect(page.locator('[data-testid="realtime-active"]')).toBeVisible();
    await expect(page.locator('text=Live monitoring')).toBeVisible();
    
    // Simulate price alert
    await page.click('[data-testid="simulate-price-alert"]');
    
    // Should show notification
    await expect(page.locator('[data-testid="price-notification"]')).toBeVisible();
    await expect(page.locator('text=Target reached')).toBeVisible();
    
    // Verify notification history
    await page.click('[data-testid="notifications-tab"]');
    await expect(page.locator('[data-testid="notification-history"]')).toBeVisible();
  });

  test('should validate strategy templates and presets', async ({ page }) => {
    await page.goto('/dashboard/strategies/templates');
    
    // Verify template categories
    await expect(page.locator('[data-testid="template-conservative"]')).toBeVisible();
    await expect(page.locator('[data-testid="template-normal"]')).toBeVisible();
    await expect(page.locator('[data-testid="template-aggressive"]')).toBeVisible();
    await expect(page.locator('[data-testid="template-scalping"]')).toBeVisible();
    await expect(page.locator('[data-testid="template-diamond"]')).toBeVisible();
    
    // Test template preview
    await page.click('[data-testid="template-conservative"]');
    await expect(page.locator('[data-testid="template-preview"]')).toBeVisible();
    await expect(page.locator('text=Conservative Multi-Phase Strategy')).toBeVisible();
    
    // Verify phase configuration
    await expect(page.locator('text=+10%')).toBeVisible(); // Conservative targets
    await expect(page.locator('text=30%')).toBeVisible(); // Sell percentage
    
    // Use template
    await page.click('[data-testid="use-template"]');
    await expect(page.locator('[data-testid="create-strategy-form"]')).toBeVisible();
    
    // Verify template data is populated
    const strategyType = await page.inputValue('[data-testid="strategy-type"]');
    expect(strategyType).toBe('conservative');
  });

  test('should handle error conditions gracefully', async ({ page }) => {
    await page.goto('/dashboard/strategies');
    
    // Test invalid strategy creation
    await page.click('[data-testid="create-strategy-button"]');
    await page.fill('[data-testid="strategy-name"]', ''); // Empty name
    await page.fill('[data-testid="entry-price"]', '-100'); // Invalid price
    await page.click('[data-testid="create-strategy-submit"]');
    
    // Should show validation errors
    await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
    await expect(page.locator('text=Name is required')).toBeVisible();
    await expect(page.locator('text=Price must be positive')).toBeVisible();
    
    // Test network error handling
    await page.route('**/api/strategies/**', route => route.abort());
    
    await page.fill('[data-testid="strategy-name"]', 'Valid Name');
    await page.fill('[data-testid="entry-price"]', '100');
    await page.click('[data-testid="create-strategy-submit"]');
    
    // Should show error message
    await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
    await expect(page.locator('text=Failed to create strategy')).toBeVisible();
  });

  test('should maintain strategy state across page refreshes', async ({ page }) => {
    await page.goto('/dashboard/strategies');
    await page.click('[data-testid="strategy-card"]:first-child');
    
    // Execute some phases
    await page.click('[data-testid="simulate-strategy"]');
    await page.fill('[data-testid="current-price-input"]', '75000');
    await page.click('[data-testid="update-price-button"]');
    
    // Verify phase executed
    await expect(page.locator('text=✅ Phase 1')).toBeVisible();
    
    // Refresh page
    await page.reload();
    
    // Verify state is preserved
    await expect(page.locator('text=✅ Phase 1')).toBeVisible();
    await expect(page.locator('[data-testid="execution-summary"]')).toBeVisible();
    
    // Continue execution
    await page.click('[data-testid="simulate-strategy"]');
    await page.fill('[data-testid="current-price-input"]', '100000');
    await page.click('[data-testid="update-price-button"]');
    
    // Should execute next phase
    await expect(page.locator('text=✅ Phase 2')).toBeVisible();
  });

  test('should support mobile responsive design', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/dashboard/strategies');
    
    // Verify mobile layout
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
    await expect(page.locator('[data-testid="strategy-grid"]')).toHaveClass(/mobile-grid/);
    
    // Test mobile strategy creation
    await page.click('[data-testid="mobile-create-button"]');
    await expect(page.locator('[data-testid="mobile-create-form"]')).toBeVisible();
    
    // Verify mobile form layout
    const formInputs = page.locator('[data-testid^="mobile-input"]');
    await expect(formInputs.first()).toBeVisible();
    
    // Test mobile strategy view
    await page.goBack();
    await page.click('[data-testid="strategy-card"]:first-child');
    
    // Verify mobile strategy details
    await expect(page.locator('[data-testid="mobile-strategy-view"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-phase-list"]')).toBeVisible();
  });
});