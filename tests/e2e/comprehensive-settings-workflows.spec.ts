import { test, expect } from '@playwright/test';
import { AuthPage, DashboardPage, SettingsPage } from './pages';
import { E2EHelpers, TEST_CREDENTIALS } from './utils/e2e-test-helpers';

test.describe('Comprehensive Settings Workflow Tests', () => {
  let authPage: AuthPage;
  let dashboardPage: DashboardPage;
  let settingsPage: SettingsPage;
  let helpers: E2EHelpers;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    dashboardPage = new DashboardPage(page);
    settingsPage = new SettingsPage(page);
    helpers = new E2EHelpers(page);

    // Authenticate user before each test
    await helpers.auth.signIn();
  });

  test.describe('API Credentials Management', () => {
    test('should complete full API credentials setup workflow', async () => {
      await settingsPage.navigate();
      
      // Clear existing credentials
      await settingsPage.clearApiCredentials();
      
      // Configure new credentials
      await settingsPage.configureMexcCredentials(
        TEST_CREDENTIALS.apiKey,
        TEST_CREDENTIALS.secretKey
      );
      
      // Test credentials connectivity
      await settingsPage.testCredentials();
      
      // Verify successful connection
      const status = await settingsPage.getCredentialsStatus();
      expect(status).toContain('connected');
      
      // Save configuration
      await settingsPage.saveCredentials();
      
      // Verify persistence after page reload
      await helpers.navigation.refreshPage();
      const persistedStatus = await settingsPage.getCredentialsStatus();
      expect(persistedStatus).toContain('connected');
    });

    test('should handle credentials update workflow', async () => {
      // Set initial credentials
      await settingsPage.navigate();
      await settingsPage.configureMexcCredentials('old-key', 'old-secret');
      await settingsPage.saveCredentials();
      
      // Update credentials
      await settingsPage.configureMexcCredentials(
        TEST_CREDENTIALS.apiKey,
        TEST_CREDENTIALS.secretKey
      );
      
      // Test new credentials
      await settingsPage.testCredentials();
      await settingsPage.saveCredentials();
      
      // Verify update was successful
      const status = await settingsPage.getCredentialsStatus();
      expect(status).toBeTruthy();
    });

    test('should handle credentials validation errors', async () => {
      await settingsPage.navigate();
      
      // Test with malformed API key
      await settingsPage.configureMexcCredentials('invalid-format', 'test-secret');
      await settingsPage.testCredentials();
      
      const hasError = await settingsPage.hasErrorMessage();
      expect(hasError).toBe(true);
      
      // Test with empty credentials
      await settingsPage.configureMexcCredentials('', '');
      await settingsPage.testCredentials();
      
      const hasEmptyError = await settingsPage.hasErrorMessage();
      expect(hasEmptyError).toBe(true);
    });

    test('should handle credentials deletion workflow', async () => {
      // Set credentials first
      await settingsPage.navigate();
      await settingsPage.configureMexcCredentials(
        TEST_CREDENTIALS.apiKey,
        TEST_CREDENTIALS.secretKey
      );
      await settingsPage.saveCredentials();
      
      // Delete credentials
      await settingsPage.clearApiCredentials();
      await settingsPage.saveCredentials();
      
      // Verify credentials are removed
      const status = await settingsPage.getCredentialsStatus();
      expect(status).toContain('not configured');
    });
  });

  test.describe('Trading Settings Configuration', () => {
    test('should configure comprehensive trading parameters', async () => {
      await settingsPage.navigate();
      
      const tradingConfig = {
        positionSize: '500',
        stopLoss: '3',
        takeProfit: '10',
        maxTrades: '5',
        riskManagement: true,
        slippage: '0.5',
        timeout: '30',
        advancedMode: true
      };
      
      await settingsPage.configureTradingSettings(tradingConfig);
      await settingsPage.saveSettings();
      
      // Verify configuration persistence
      await helpers.navigation.refreshPage();
      const savedConfig = await settingsPage.getTradingSettings();
      
      expect(savedConfig.positionSize).toBe(tradingConfig.positionSize);
      expect(savedConfig.stopLoss).toBe(tradingConfig.stopLoss);
      expect(savedConfig.takeProfit).toBe(tradingConfig.takeProfit);
    });

    test('should validate trading parameter boundaries', async () => {
      await settingsPage.navigate();
      
      // Test maximum position size validation
      await settingsPage.configureTradingSettings({
        positionSize: '999999999999'
      });
      await settingsPage.saveSettings();
      
      let hasError = await settingsPage.hasErrorMessage();
      expect(hasError).toBe(true);
      
      // Test minimum stop loss validation
      await settingsPage.configureTradingSettings({
        stopLoss: '-5'
      });
      await settingsPage.saveSettings();
      
      hasError = await settingsPage.hasErrorMessage();
      expect(hasError).toBe(true);
      
      // Test maximum take profit validation
      await settingsPage.configureTradingSettings({
        takeProfit: '500'
      });
      await settingsPage.saveSettings();
      
      hasError = await settingsPage.hasErrorMessage();
      expect(hasError).toBe(true);
    });

    test('should handle advanced trading configuration', async () => {
      await settingsPage.navigate();
      
      await settingsPage.configureAdvancedTradingSettings({
        orderType: 'limit',
        timeInForce: 'GTC',
        iceBergQty: '10',
        stopPrice: '50000',
        workingType: 'MARK_PRICE',
        priceProtect: true,
        reduceOnly: false,
        closePosition: false
      });
      
      await settingsPage.saveSettings();
      
      const hasSuccess = await settingsPage.hasSuccessMessage();
      expect(hasSuccess).toBe(true);
    });
  });

  test.describe('Auto-Sniping Settings Configuration', () => {
    test('should configure auto-sniping parameters', async () => {
      await settingsPage.navigate();
      
      const autoSnipingConfig = {
        enabled: true,
        confidenceThreshold: '80',
        maxTargets: '3',
        advanceNotice: '30',
        patternTypes: ['ready_state', 'pre_ready'],
        safetyChecks: true,
        emergencyStop: true
      };
      
      await settingsPage.configureAutoSnipingSettings(autoSnipingConfig);
      await settingsPage.saveSettings();
      
      // Verify configuration
      const hasSuccess = await settingsPage.hasSuccessMessage();
      expect(hasSuccess).toBe(true);
      
      // Test configuration persistence
      await helpers.navigation.refreshPage();
      const savedConfig = await settingsPage.getAutoSnipingSettings();
      expect(savedConfig.enabled).toBe(true);
      expect(savedConfig.confidenceThreshold).toBe('80');
    });

    test('should handle auto-sniping safety constraints', async () => {
      await settingsPage.navigate();
      
      // Configure with high risk settings
      await settingsPage.configureAutoSnipingSettings({
        confidenceThreshold: '10', // Very low confidence
        maxTargets: '100', // Too many targets
        advanceNotice: '5' // Too short notice
      });
      
      await settingsPage.saveSettings();
      
      // Should show warnings or adjust values
      const hasWarning = await settingsPage.hasWarningMessage();
      const hasError = await settingsPage.hasErrorMessage();
      expect(hasWarning || hasError).toBe(true);
    });

    test('should test auto-sniping pattern configuration', async () => {
      await settingsPage.navigate();
      
      // Configure specific pattern types
      await settingsPage.selectPatternTypes(['ready_state', 'volatility_spike']);
      await settingsPage.configurePatternParameters({
        volumeThreshold: '1000000',
        priceChangeThreshold: '5',
        marketCapFilter: '10000000'
      });
      
      await settingsPage.saveSettings();
      
      const hasSuccess = await settingsPage.hasSuccessMessage();
      expect(hasSuccess).toBe(true);
    });
  });

  test.describe('Risk Management Settings', () => {
    test('should configure comprehensive risk parameters', async () => {
      await settingsPage.navigate();
      
      const riskConfig = {
        maxDailyLoss: '1000',
        maxPortfolioRisk: '20',
        riskPerTrade: '2',
        correlationLimit: '0.7',
        volatilityFilter: true,
        emergencyStopEnabled: true,
        autoHedging: false
      };
      
      await settingsPage.configureRiskManagement(riskConfig);
      await settingsPage.saveSettings();
      
      const hasSuccess = await settingsPage.hasSuccessMessage();
      expect(hasSuccess).toBe(true);
    });

    test('should validate risk parameter relationships', async () => {
      await settingsPage.navigate();
      
      // Configure conflicting risk parameters
      await settingsPage.configureRiskManagement({
        maxDailyLoss: '100',
        riskPerTrade: '50' // Risk per trade is 50% of daily limit
      });
      
      await settingsPage.saveSettings();
      
      // Should show validation warning
      const hasWarning = await settingsPage.hasWarningMessage();
      expect(hasWarning).toBe(true);
    });
  });

  test.describe('Notification and Alert Settings', () => {
    test('should configure notification preferences', async () => {
      await settingsPage.navigate();
      
      const notificationConfig = {
        emailAlerts: true,
        pushNotifications: true,
        alertTypes: ['trade_executed', 'target_detected', 'error_occurred'],
        frequency: 'immediate',
        quietHours: {
          enabled: true,
          start: '22:00',
          end: '08:00'
        }
      };
      
      await settingsPage.configureNotifications(notificationConfig);
      await settingsPage.saveSettings();
      
      const hasSuccess = await settingsPage.hasSuccessMessage();
      expect(hasSuccess).toBe(true);
    });

    test('should test notification delivery', async () => {
      await settingsPage.navigate();
      
      // Configure test notification
      await settingsPage.configureNotifications({
        emailAlerts: true,
        alertTypes: ['test']
      });
      
      // Send test notification
      await settingsPage.sendTestNotification();
      
      // Verify test was sent
      const testResult = await settingsPage.getTestNotificationResult();
      expect(testResult).toContain('sent');
    });
  });

  test.describe('Data Management Settings', () => {
    test('should configure data retention settings', async () => {
      await settingsPage.navigate();
      
      const dataConfig = {
        tradeHistoryRetention: '365',
        logRetention: '90',
        analyticsRetention: '180',
        autoCleanup: true,
        backupEnabled: true,
        backupFrequency: 'weekly'
      };
      
      await settingsPage.configureDataManagement(dataConfig);
      await settingsPage.saveSettings();
      
      const hasSuccess = await settingsPage.hasSuccessMessage();
      expect(hasSuccess).toBe(true);
    });

    test('should handle data export workflow', async () => {
      await settingsPage.navigate();
      
      // Initiate data export
      await settingsPage.initiateDataExport(['trades', 'settings', 'analytics']);
      
      // Wait for export to complete
      await helpers.wait.waitForElement('[data-testid="export-complete"]', 30000);
      
      // Verify export file
      const exportStatus = await settingsPage.getExportStatus();
      expect(exportStatus).toContain('completed');
    });

    test('should handle data import workflow', async () => {
      await settingsPage.navigate();
      
      // Prepare test import file
      const importData = {
        settings: {
          positionSize: '200',
          stopLoss: '4'
        }
      };
      
      await settingsPage.importSettings(importData);
      
      // Verify import was successful
      const hasSuccess = await settingsPage.hasSuccessMessage();
      expect(hasSuccess).toBe(true);
      
      // Verify settings were applied
      const importedSettings = await settingsPage.getTradingSettings();
      expect(importedSettings.positionSize).toBe('200');
    });
  });

  test.describe('User Preferences and Interface', () => {
    test('should configure user interface preferences', async () => {
      await settingsPage.navigate();
      
      const uiConfig = {
        theme: 'dark',
        language: 'en',
        timezone: 'UTC',
        dateFormat: 'DD/MM/YYYY',
        numberFormat: 'US',
        dashboardLayout: 'compact',
        autoRefresh: true,
        refreshInterval: '30'
      };
      
      await settingsPage.configureUserPreferences(uiConfig);
      await settingsPage.saveSettings();
      
      // Verify theme change is applied immediately
      const currentTheme = await settingsPage.getCurrentTheme();
      expect(currentTheme).toBe('dark');
    });

    test('should handle accessibility preferences', async () => {
      await settingsPage.navigate();
      
      const accessibilityConfig = {
        highContrast: true,
        fontSize: 'large',
        reducedMotion: true,
        screenReader: true,
        keyboardNavigation: true
      };
      
      await settingsPage.configureAccessibility(accessibilityConfig);
      await settingsPage.saveSettings();
      
      const hasSuccess = await settingsPage.hasSuccessMessage();
      expect(hasSuccess).toBe(true);
    });
  });

  test.describe('Settings Import/Export Workflows', () => {
    test('should export complete settings configuration', async () => {
      await settingsPage.navigate();
      
      // Configure various settings first
      await settingsPage.configureTradingSettings({ positionSize: '300' });
      await settingsPage.configureAutoSnipingSettings({ confidenceThreshold: '75' });
      await settingsPage.saveSettings();
      
      // Export all settings
      await settingsPage.exportAllSettings();
      
      const exportStatus = await settingsPage.getExportStatus();
      expect(exportStatus).toContain('success');
    });

    test('should import and apply settings configuration', async () => {
      await settingsPage.navigate();
      
      const completeConfig = {
        trading: {
          positionSize: '400',
          stopLoss: '3.5',
          takeProfit: '12'
        },
        autoSniping: {
          enabled: true,
          confidenceThreshold: '85'
        },
        risk: {
          maxDailyLoss: '500'
        },
        notifications: {
          emailAlerts: true
        }
      };
      
      await settingsPage.importCompleteConfiguration(completeConfig);
      
      // Verify all settings were applied
      const tradingSettings = await settingsPage.getTradingSettings();
      expect(tradingSettings.positionSize).toBe('400');
      
      const autoSnipingSettings = await settingsPage.getAutoSnipingSettings();
      expect(autoSnipingSettings.confidenceThreshold).toBe('85');
    });
  });

  test.describe('Settings Performance and Reliability', () => {
    test('should handle settings save under load', async () => {
      await settingsPage.navigate();
      
      // Simulate concurrent settings updates
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          settingsPage.configureTradingSettings({
            positionSize: (100 + i * 10).toString()
          })
        );
      }
      
      await Promise.all(promises);
      await settingsPage.saveSettings();
      
      // Verify final state is consistent
      const finalSettings = await settingsPage.getTradingSettings();
      expect(finalSettings).toBeTruthy();
    });

    test('should recover from settings save failures', async ({ page }) => {
      await settingsPage.navigate();
      
      // Mock API failure
      await helpers.api.interceptError('**/api/trading-settings**', 500);
      
      await settingsPage.configureTradingSettings({ positionSize: '250' });
      await settingsPage.saveSettings();
      
      // Should show error message
      const hasError = await settingsPage.hasErrorMessage();
      expect(hasError).toBe(true);
      
      // Restore API and retry
      await helpers.api.clearRoutes();
      await settingsPage.saveSettings();
      
      // Should succeed on retry
      const hasSuccess = await settingsPage.hasSuccessMessage();
      expect(hasSuccess).toBe(true);
    });

    test('should maintain settings during network interruption', async ({ page }) => {
      await settingsPage.navigate();
      
      // Configure settings
      await settingsPage.configureTradingSettings({ positionSize: '350' });
      
      // Simulate network failure during save
      await helpers.error.simulateNetworkFailure();
      await settingsPage.saveSettings();
      
      // Restore network
      await helpers.error.restoreNetwork();
      
      // Settings should be preserved locally
      const settings = await settingsPage.getTradingSettings();
      expect(settings.positionSize).toBe('350');
      
      // Retry save should work
      await settingsPage.saveSettings();
      const hasSuccess = await settingsPage.hasSuccessMessage();
      expect(hasSuccess).toBe(true);
    });
  });

  test.describe('Settings Validation and Security', () => {
    test('should validate settings permissions', async () => {
      await settingsPage.navigate();
      
      // Verify user can only access their own settings
      const userSettings = await settingsPage.getUserSettings();
      expect(userSettings.userId).toBe(TEST_CREDENTIALS.email);
    });

    test('should handle settings encryption', async () => {
      await settingsPage.navigate();
      
      // Configure sensitive settings
      await settingsPage.configureMexcCredentials(
        TEST_CREDENTIALS.apiKey,
        TEST_CREDENTIALS.secretKey
      );
      await settingsPage.saveCredentials();
      
      // Verify credentials are not stored in plain text
      const rawSettings = await settingsPage.getRawSettingsData();
      expect(rawSettings).not.toContain(TEST_CREDENTIALS.apiKey);
      expect(rawSettings).not.toContain(TEST_CREDENTIALS.secretKey);
    });

    test('should validate settings schema', async () => {
      await settingsPage.navigate();
      
      // Try to save invalid settings structure
      await settingsPage.saveInvalidSettings({
        invalidField: 'value',
        positionSize: 'not-a-number'
      });
      
      const hasError = await settingsPage.hasErrorMessage();
      expect(hasError).toBe(true);
    });
  });
});