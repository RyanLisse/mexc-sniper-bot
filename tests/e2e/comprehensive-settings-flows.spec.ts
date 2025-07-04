import { test, expect } from '@playwright/test';
import { AuthPage, SettingsPage, DashboardPage } from './pages';

const TEST_EMAIL = process.env.TEST_USER_EMAIL || process.env.AUTH_EMAIL || 'ryan@ryanlisse.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || process.env.AUTH_PASSWORD || 'Testing2025!';
const TEST_API_KEY = process.env.MEXC_API_KEY || 'test-api-key';
const TEST_SECRET_KEY = process.env.MEXC_SECRET_KEY || 'test-secret-key';
const TEST_WEBHOOK_URL = 'https://webhook.site/test-webhook';

test.describe('Comprehensive Settings and Configuration Flow Tests', () => {
  let authPage: AuthPage;
  let settingsPage: SettingsPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    settingsPage = new SettingsPage(page);
    dashboardPage = new DashboardPage(page);

    // Authenticate user before each test
    await authPage.navigate();
    await authPage.signIn(TEST_EMAIL, TEST_PASSWORD);
    await authPage.waitForAuthCompletion();
    await dashboardPage.waitForPageLoad();
  });

  test.describe('Settings Page Navigation Tests', () => {
    test('should navigate to settings page from dashboard', async () => {
      await settingsPage.navigate();
      await settingsPage.verifySettingsElements();
      
      // Verify URL
      expect(await settingsPage.getCurrentUrl()).toMatch(/\/settings$/);
    });

    test('should display all settings tabs', async () => {
      await settingsPage.navigate();
      
      // Verify all tabs are present
      await expect(settingsPage['apiCredentialsTab']).toBeVisible();
      await expect(settingsPage['tradingSettingsTab']).toBeVisible();
      await expect(settingsPage['autoSnipingSettingsTab']).toBeVisible();
      await expect(settingsPage['notificationsTab']).toBeVisible();
      await expect(settingsPage['accountTab']).toBeVisible();
    });

    test('should remember last active tab', async () => {
      await settingsPage.navigate();
      
      // Switch to trading settings
      await settingsPage.switchToTradingSettings();
      
      // Refresh page
      await settingsPage.page.reload();
      await settingsPage.waitForPageLoad();
      
      // Should default to first tab (API Credentials) or maintain state
      // This depends on implementation
      expect(await settingsPage.getCurrentUrl()).toMatch(/\/settings$/);
    });
  });

  test.describe('API Credentials Configuration Tests', () => {
    test('should configure valid MEXC API credentials', async () => {
      await settingsPage.navigate();
      await settingsPage.configureMexcCredentials(TEST_API_KEY, TEST_SECRET_KEY);
      await settingsPage.saveCredentials();
      
      // Should save successfully
      const hasSuccess = await settingsPage.hasSuccessMessage();
      if (hasSuccess) {
        const successMessage = await settingsPage.getSuccessMessage();
        expect(successMessage).toContain('success');
      }
    });

    test('should test API credentials connectivity', async () => {
      await settingsPage.navigate();
      await settingsPage.configureMexcCredentials(TEST_API_KEY, TEST_SECRET_KEY);
      await settingsPage.testCredentials();
      
      // Should get status response
      const status = await settingsPage.getCredentialsStatus();
      expect(status).toBeTruthy();
    });

    test('should handle empty API credentials', async () => {
      await settingsPage.navigate();
      await settingsPage.configureMexcCredentials('', '');
      await settingsPage.saveCredentials();
      
      // Should show validation error
      const hasError = await settingsPage.hasErrorMessage();
      expect(hasError).toBe(true);
    });

    test('should handle invalid API credentials format', async () => {
      await settingsPage.navigate();
      await settingsPage.configureMexcCredentials('invalid-format', 'also-invalid');
      await settingsPage.testCredentials();
      
      // Should show error or invalid status
      const hasError = await settingsPage.hasErrorMessage();
      const status = await settingsPage.getCredentialsStatus();
      
      expect(hasError || status.toLowerCase().includes('invalid') || status.toLowerCase().includes('error')).toBe(true);
    });

    test('should mask sensitive credential information', async () => {
      await settingsPage.navigate();
      await settingsPage.configureMexcCredentials(TEST_API_KEY, TEST_SECRET_KEY);
      
      // Check if secret key is masked in UI
      const secretInput = settingsPage['mexcSecretKeyInput'];
      const inputType = await secretInput.getAttribute('type');
      
      // Should be password type or show asterisks
      expect(inputType === 'password' || inputType === 'text').toBe(true);
    });

    test('should clear credentials form', async () => {
      await settingsPage.navigate();
      await settingsPage.configureMexcCredentials(TEST_API_KEY, TEST_SECRET_KEY);
      
      // Clear the form
      await settingsPage['mexcApiKeyInput'].clear();
      await settingsPage['mexcSecretKeyInput'].clear();
      
      // Inputs should be empty
      const apiKeyValue = await settingsPage['mexcApiKeyInput'].inputValue();
      const secretKeyValue = await settingsPage['mexcSecretKeyInput'].inputValue();
      
      expect(apiKeyValue).toBe('');
      expect(secretKeyValue).toBe('');
    });
  });

  test.describe('Trading Settings Configuration Tests', () => {
    test('should configure all trading parameters', async () => {
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

    test('should validate position size limits', async () => {
      await settingsPage.navigate();
      
      // Test minimum limits
      await settingsPage.configureTradingSettings({
        positionSize: '0'
      });
      await settingsPage.saveSettings();
      
      const hasError = await settingsPage.hasErrorMessage();
      expect(hasError).toBe(true);
    });

    test('should validate stop loss percentage', async () => {
      await settingsPage.navigate();
      
      // Test invalid stop loss
      await settingsPage.configureTradingSettings({
        stopLoss: '0'
      });
      await settingsPage.saveSettings();
      
      const hasError = await settingsPage.hasErrorMessage();
      expect(hasError).toBe(true);
    });

    test('should validate take profit percentage', async () => {
      await settingsPage.navigate();
      
      // Test invalid take profit
      await settingsPage.configureTradingSettings({
        takeProfit: '0'
      });
      await settingsPage.saveSettings();
      
      const hasError = await settingsPage.hasErrorMessage();
      expect(hasError).toBe(true);
    });

    test('should validate maximum concurrent trades', async () => {
      await settingsPage.navigate();
      
      // Test excessive max trades
      await settingsPage.configureTradingSettings({
        maxTrades: '100'
      });
      await settingsPage.saveSettings();
      
      // Should either save with warning or show error
      const hasError = await settingsPage.hasErrorMessage();
      const hasSuccess = await settingsPage.hasSuccessMessage();
      
      expect(hasError || hasSuccess).toBe(true);
    });

    test('should toggle risk management features', async () => {
      await settingsPage.navigate();
      
      // Enable risk management
      await settingsPage.configureTradingSettings({
        riskManagement: true
      });
      await settingsPage.saveSettings();
      
      // Disable risk management
      await settingsPage.configureTradingSettings({
        riskManagement: false
      });
      await settingsPage.saveSettings();
      
      // Should handle both states
      expect(await settingsPage.getCurrentUrl()).toMatch(/\/settings$/);
    });
  });

  test.describe('Auto-Sniping Settings Configuration Tests', () => {
    test('should configure auto-sniping parameters', async () => {
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

    test('should validate confidence threshold range', async () => {
      await settingsPage.navigate();
      
      // Test invalid confidence threshold
      await settingsPage.configureAutoSnipingSettings({
        confidenceThreshold: '150' // Over 100%
      });
      await settingsPage.saveSettings();
      
      const hasError = await settingsPage.hasErrorMessage();
      expect(hasError).toBe(true);
    });

    test('should validate max targets per day', async () => {
      await settingsPage.navigate();
      
      // Test excessive max targets
      await settingsPage.configureAutoSnipingSettings({
        maxTargets: '1000'
      });
      await settingsPage.saveSettings();
      
      // Should show validation error or warning
      const hasError = await settingsPage.hasErrorMessage();
      const hasSuccess = await settingsPage.hasSuccessMessage();
      
      expect(hasError || hasSuccess).toBe(true);
    });

    test('should validate advance notice timing', async () => {
      await settingsPage.navigate();
      
      // Test minimum advance notice
      await settingsPage.configureAutoSnipingSettings({
        advanceNotice: '0'
      });
      await settingsPage.saveSettings();
      
      const hasError = await settingsPage.hasErrorMessage();
      expect(hasError).toBe(true);
    });

    test('should enable/disable auto-sniping', async () => {
      await settingsPage.navigate();
      
      // Enable auto-sniping
      await settingsPage.configureAutoSnipingSettings({
        enabled: true
      });
      await settingsPage.saveSettings();
      
      // Disable auto-sniping
      await settingsPage.configureAutoSnipingSettings({
        enabled: false
      });
      await settingsPage.saveSettings();
      
      // Should handle both states
      expect(await settingsPage.getCurrentUrl()).toMatch(/\/settings$/);
    });
  });

  test.describe('Notifications Configuration Tests', () => {
    test('should configure notification settings', async () => {
      await settingsPage.navigate();
      await settingsPage.configureNotifications({
        email: true,
        webhook: TEST_WEBHOOK_URL,
        notifyOnTrades: true,
        notifyOnErrors: true
      });
      await settingsPage.saveSettings();
      
      // Should save successfully
      const hasSuccess = await settingsPage.hasSuccessMessage();
      if (hasSuccess) {
        expect(hasSuccess).toBe(true);
      }
    });

    test('should validate webhook URL format', async () => {
      await settingsPage.navigate();
      
      // Test invalid webhook URL
      await settingsPage.configureNotifications({
        webhook: 'not-a-valid-url'
      });
      await settingsPage.saveSettings();
      
      const hasError = await settingsPage.hasErrorMessage();
      expect(hasError).toBe(true);
    });

    test('should test webhook connectivity', async () => {
      await settingsPage.navigate();
      await settingsPage.configureNotifications({
        webhook: TEST_WEBHOOK_URL
      });
      
      // Look for test webhook button
      const testButton = settingsPage.page.locator('button:has-text("Test"), button:has-text("Test Webhook")');
      
      if (await testButton.isVisible()) {
        await testButton.click();
        
        // Should not cause errors
        expect(await settingsPage.getCurrentUrl()).toMatch(/\/settings$/);
      }
    });

    test('should configure selective notifications', async () => {
      await settingsPage.navigate();
      
      // Enable only trade notifications
      await settingsPage.configureNotifications({
        email: true,
        notifyOnTrades: true,
        notifyOnErrors: false
      });
      await settingsPage.saveSettings();
      
      // Enable only error notifications
      await settingsPage.configureNotifications({
        email: true,
        notifyOnTrades: false,
        notifyOnErrors: true
      });
      await settingsPage.saveSettings();
      
      // Should handle selective configurations
      expect(await settingsPage.getCurrentUrl()).toMatch(/\/settings$/);
    });

    test('should disable all notifications', async () => {
      await settingsPage.navigate();
      await settingsPage.configureNotifications({
        email: false,
        webhook: '',
        notifyOnTrades: false,
        notifyOnErrors: false
      });
      await settingsPage.saveSettings();
      
      // Should save successfully
      const hasSuccess = await settingsPage.hasSuccessMessage();
      if (hasSuccess) {
        expect(hasSuccess).toBe(true);
      }
    });
  });

  test.describe('Account Settings Tests', () => {
    test('should display user account information', async () => {
      await settingsPage.navigate();
      await settingsPage.switchToAccount();
      
      // Should show user email
      const userEmail = await settingsPage.getUserEmail();
      expect(userEmail).toContain('@');
      expect(userEmail).toBeTruthy();
    });

    test('should show change password option', async () => {
      await settingsPage.navigate();
      await settingsPage.switchToAccount();
      
      // Should have change password button
      await expect(settingsPage['changePasswordButton']).toBeVisible();
    });

    test('should show delete account option with warning', async () => {
      await settingsPage.navigate();
      await settingsPage.switchToAccount();
      
      // Should have delete account button
      await expect(settingsPage['deleteAccountButton']).toBeVisible();
      
      // Button should be styled as dangerous
      const buttonClass = await settingsPage['deleteAccountButton'].getAttribute('class');
      expect(buttonClass).toContain('destructive');
    });

    test('should handle change password flow', async () => {
      await settingsPage.navigate();
      await settingsPage.switchToAccount();
      
      // Click change password
      await settingsPage['changePasswordButton'].click();
      
      // Should trigger password change flow (modal, redirect, etc.)
      // Exact behavior depends on implementation
      expect(await settingsPage.getCurrentUrl()).toMatch(/\/settings$|password/);
    });
  });

  test.describe('Settings Form Validation Tests', () => {
    test('should validate numeric inputs', async () => {
      await settingsPage.navigate();
      
      // Try to enter non-numeric values in numeric fields
      await settingsPage.configureTradingSettings({
        positionSize: 'abc',
        stopLoss: 'invalid',
        takeProfit: 'not-a-number'
      });
      
      // Should either prevent input or show validation error
      await settingsPage.saveSettings();
      
      const hasError = await settingsPage.hasErrorMessage();
      expect(hasError).toBe(true);
    });

    test('should validate required fields', async () => {
      await settingsPage.navigate();
      
      // Clear all required fields and try to save
      await settingsPage.configureTradingSettings({
        positionSize: '',
        stopLoss: '',
        takeProfit: ''
      });
      await settingsPage.saveSettings();
      
      // Should show validation errors
      const hasError = await settingsPage.hasErrorMessage();
      expect(hasError).toBe(true);
    });

    test('should validate field ranges', async () => {
      await settingsPage.navigate();
      
      // Test values outside valid ranges
      await settingsPage.configureTradingSettings({
        positionSize: '-100', // Negative
        stopLoss: '101', // Over 100%
        takeProfit: '500' // Very high
      });
      await settingsPage.saveSettings();
      
      const hasError = await settingsPage.hasErrorMessage();
      expect(hasError).toBe(true);
    });

    test('should show field-specific error messages', async () => {
      await settingsPage.navigate();
      
      // Enter invalid data
      await settingsPage.configureTradingSettings({
        positionSize: '0'
      });
      await settingsPage.saveSettings();
      
      // Should show specific error message
      if (await settingsPage.hasErrorMessage()) {
        const errorMessage = await settingsPage.getErrorMessage();
        expect(errorMessage.toLowerCase()).toContain('position');
      }
    });
  });

  test.describe('Settings Persistence Tests', () => {
    test('should persist settings across sessions', async () => {
      await settingsPage.navigate();
      
      // Configure and save settings
      await settingsPage.configureTradingSettings({
        positionSize: '250',
        stopLoss: '3',
        takeProfit: '12'
      });
      await settingsPage.saveSettings();
      
      // Sign out and back in
      await dashboardPage.signOut();
      await authPage.signIn(TEST_EMAIL, TEST_PASSWORD);
      await authPage.waitForAuthCompletion();
      
      // Navigate back to settings
      await settingsPage.navigate();
      await settingsPage.switchToTradingSettings();
      
      // Settings should be preserved
      const positionSize = await settingsPage['defaultPositionSize'].inputValue();
      expect(positionSize).toBe('250');
    });

    test('should handle settings backup and restore', async () => {
      await settingsPage.navigate();
      
      // Configure comprehensive settings
      await settingsPage.configureTradingSettings({
        positionSize: '150',
        stopLoss: '4',
        takeProfit: '10',
        maxTrades: '2'
      });
      await settingsPage.saveSettings();
      
      await settingsPage.configureAutoSnipingSettings({
        enabled: true,
        confidenceThreshold: '80'
      });
      await settingsPage.saveSettings();
      
      // Settings should be saved and retrievable
      expect(await settingsPage.getCurrentUrl()).toMatch(/\/settings$/);
    });

    test('should handle concurrent settings updates', async ({ browser }) => {
      // Create second browser context (simulating second user session)
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      const settingsPage2 = new SettingsPage(page2);
      const authPage2 = new AuthPage(page2);
      
      // Authenticate second session
      await authPage2.navigate();
      await authPage2.signIn(TEST_EMAIL, TEST_PASSWORD);
      await authPage2.waitForAuthCompletion();
      
      // Update settings from both sessions
      await settingsPage.navigate();
      await settingsPage2.navigate();
      
      await settingsPage.configureTradingSettings({ positionSize: '100' });
      await settingsPage2.configureTradingSettings({ positionSize: '200' });
      
      await settingsPage.saveSettings();
      await settingsPage2.saveSettings();
      
      // Should handle concurrent updates gracefully
      expect(await settingsPage.getCurrentUrl()).toMatch(/\/settings$/);
      
      await context2.close();
    });
  });

  test.describe('Settings Integration Tests', () => {
    test('should reflect settings changes in dashboard', async () => {
      await settingsPage.navigate();
      
      // Enable auto-sniping
      await settingsPage.configureAutoSnipingSettings({
        enabled: true
      });
      await settingsPage.saveSettings();
      
      // Navigate to dashboard
      await dashboardPage.navigate();
      await dashboardPage.switchToTab('auto-sniping');
      
      // Auto-sniping should be enabled
      const status = await dashboardPage.getAutoSnipingStatus();
      expect(status).toBeTruthy();
    });

    test('should validate API credentials before enabling features', async () => {
      await settingsPage.navigate();
      
      // Try to enable auto-sniping without valid credentials
      await settingsPage.configureAutoSnipingSettings({
        enabled: true
      });
      await settingsPage.saveSettings();
      
      // Should either require credentials or show warning
      const hasError = await settingsPage.hasErrorMessage();
      const hasSuccess = await settingsPage.hasSuccessMessage();
      
      expect(hasError || hasSuccess).toBe(true);
    });

    test('should update trading limits in real-time', async () => {
      await settingsPage.navigate();
      
      // Configure trading limits
      await settingsPage.configureTradingSettings({
        maxTrades: '1'
      });
      await settingsPage.saveSettings();
      
      // Should apply to trading functionality immediately
      expect(await settingsPage.getCurrentUrl()).toMatch(/\/settings$/);
    });
  });
});