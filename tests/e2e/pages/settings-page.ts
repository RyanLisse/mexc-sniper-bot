import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base-page';

/**
 * Settings page object model
 */
export class SettingsPage extends BasePage {
  // Page elements
  private readonly pageTitle: Locator;
  private readonly tabsList: Locator;
  
  // API Credentials section
  private readonly apiCredentialsTab: Locator;
  private readonly mexcApiKeyInput: Locator;
  private readonly mexcSecretKeyInput: Locator;
  private readonly testCredentialsButton: Locator;
  private readonly saveCredentialsButton: Locator;
  private readonly credentialsStatus: Locator;
  
  // Trading Settings section
  private readonly tradingSettingsTab: Locator;
  private readonly defaultPositionSize: Locator;
  private readonly stopLossPercentage: Locator;
  private readonly takeProfitPercentage: Locator;
  private readonly maxConcurrentTrades: Locator;
  private readonly riskManagementToggle: Locator;
  
  // Auto-Sniping Settings
  private readonly autoSnipingSettingsTab: Locator;
  private readonly enableAutoSniping: Locator;
  private readonly confidenceThreshold: Locator;
  private readonly maxTargetsPerDay: Locator;
  private readonly advanceNoticeMinutes: Locator;
  
  // Notifications Settings
  private readonly notificationsTab: Locator;
  private readonly emailNotifications: Locator;
  private readonly webhookUrl: Locator;
  private readonly notifyOnTrades: Locator;
  private readonly notifyOnErrors: Locator;
  
  // Account Settings
  private readonly accountTab: Locator;
  private readonly userEmailDisplay: Locator;
  private readonly changePasswordButton: Locator;
  private readonly deleteAccountButton: Locator;
  
  // General elements
  private readonly saveButton: Locator;
  private readonly cancelButton: Locator;
  private readonly successMessage: Locator;
  private readonly errorMessage: Locator;
  private readonly loadingSpinner: Locator;

  constructor(page: Page) {
    super(page);
    
    // Initialize locators
    this.pageTitle = page.locator('h1:has-text("Settings"), h2:has-text("Settings")');
    this.tabsList = page.locator('[role="tablist"]');
    
    // API Credentials
    this.apiCredentialsTab = page.locator('button:has-text("API Credentials"), [data-value="api-credentials"]');
    this.mexcApiKeyInput = page.locator('input[name="apiKey"], input[placeholder*="API Key"]');
    this.mexcSecretKeyInput = page.locator('input[name="secretKey"], input[placeholder*="Secret Key"]');
    this.testCredentialsButton = page.locator('button:has-text("Test Credentials"), button:has-text("Test Connection")');
    this.saveCredentialsButton = page.locator('button:has-text("Save Credentials"), button:has-text("Save")');
    this.credentialsStatus = page.locator('[data-testid="credentials-status"], .credentials-status');
    
    // Trading Settings
    this.tradingSettingsTab = page.locator('button:has-text("Trading"), [data-value="trading"]');
    this.defaultPositionSize = page.locator('input[name="positionSize"], input[placeholder*="Position Size"]');
    this.stopLossPercentage = page.locator('input[name="stopLoss"], input[placeholder*="Stop Loss"]');
    this.takeProfitPercentage = page.locator('input[name="takeProfit"], input[placeholder*="Take Profit"]');
    this.maxConcurrentTrades = page.locator('input[name="maxTrades"], input[placeholder*="Max Trades"]');
    this.riskManagementToggle = page.locator('input[name="riskManagement"], input[type="checkbox"]');
    
    // Auto-Sniping Settings
    this.autoSnipingSettingsTab = page.locator('button:has-text("Auto-Sniping"), [data-value="auto-sniping"]');
    this.enableAutoSniping = page.locator('input[name="enableAutoSniping"], input[type="checkbox"]');
    this.confidenceThreshold = page.locator('input[name="confidenceThreshold"], input[placeholder*="Confidence"]');
    this.maxTargetsPerDay = page.locator('input[name="maxTargets"], input[placeholder*="Max Targets"]');
    this.advanceNoticeMinutes = page.locator('input[name="advanceNotice"], input[placeholder*="Advance Notice"]');
    
    // Notifications
    this.notificationsTab = page.locator('button:has-text("Notifications"), [data-value="notifications"]');
    this.emailNotifications = page.locator('input[name="emailNotifications"], input[type="checkbox"]');
    this.webhookUrl = page.locator('input[name="webhookUrl"], input[placeholder*="Webhook"]');
    this.notifyOnTrades = page.locator('input[name="notifyOnTrades"], input[type="checkbox"]');
    this.notifyOnErrors = page.locator('input[name="notifyOnErrors"], input[type="checkbox"]');
    
    // Account
    this.accountTab = page.locator('button:has-text("Account"), [data-value="account"]');
    this.userEmailDisplay = page.locator('[data-testid="user-email"], .user-email');
    this.changePasswordButton = page.locator('button:has-text("Change Password")');
    this.deleteAccountButton = page.locator('button:has-text("Delete Account")');
    
    // General
    this.saveButton = page.locator('button:has-text("Save"), button[type="submit"]');
    this.cancelButton = page.locator('button:has-text("Cancel")');
    this.successMessage = page.locator('.success, [data-testid="success-message"]');
    this.errorMessage = page.locator('.error, [data-testid="error-message"]');
    this.loadingSpinner = page.locator('.loading, [data-testid="loading"]');
  }

  /**
   * Navigate to settings page
   */
  async navigate() {
    await this.goto('/settings');
    await this.waitForPageLoad();
  }

  /**
   * Wait for settings page to load
   */
  async waitForPageLoad() {
    await this.waitForElement(this.pageTitle);
    await this.waitForElement(this.tabsList);
    await this.waitForLoading();
  }

  /**
   * Switch to API Credentials tab
   */
  async switchToApiCredentials() {
    await this.clickWithRetry(this.apiCredentialsTab);
    await this.waitForElement(this.mexcApiKeyInput);
  }

  /**
   * Configure MEXC API credentials
   */
  async configureMexcCredentials(apiKey: string, secretKey: string) {
    await this.switchToApiCredentials();
    await this.fillFieldWithRetry(this.mexcApiKeyInput, apiKey);
    await this.fillFieldWithRetry(this.mexcSecretKeyInput, secretKey);
  }

  /**
   * Test API credentials
   */
  async testCredentials() {
    await this.clickWithRetry(this.testCredentialsButton);
    await this.waitForLoading();
  }

  /**
   * Save API credentials
   */
  async saveCredentials() {
    await this.clickWithRetry(this.saveCredentialsButton);
    await this.waitForLoading();
  }

  /**
   * Get credentials status
   */
  async getCredentialsStatus(): Promise<string> {
    await this.waitForElement(this.credentialsStatus);
    return await this.credentialsStatus.textContent() || '';
  }

  /**
   * Switch to Trading Settings tab
   */
  async switchToTradingSettings() {
    await this.clickWithRetry(this.tradingSettingsTab);
    await this.waitForElement(this.defaultPositionSize);
  }

  /**
   * Configure trading settings
   */
  async configureTradingSettings(settings: {
    positionSize?: string;
    stopLoss?: string;
    takeProfit?: string;
    maxTrades?: string;
    riskManagement?: boolean;
  }) {
    await this.switchToTradingSettings();
    
    if (settings.positionSize) {
      await this.fillFieldWithRetry(this.defaultPositionSize, settings.positionSize);
    }
    if (settings.stopLoss) {
      await this.fillFieldWithRetry(this.stopLossPercentage, settings.stopLoss);
    }
    if (settings.takeProfit) {
      await this.fillFieldWithRetry(this.takeProfitPercentage, settings.takeProfit);
    }
    if (settings.maxTrades) {
      await this.fillFieldWithRetry(this.maxConcurrentTrades, settings.maxTrades);
    }
    if (settings.riskManagement !== undefined) {
      await this.toggleCheckbox(this.riskManagementToggle, settings.riskManagement);
    }
  }

  /**
   * Switch to Auto-Sniping Settings tab
   */
  async switchToAutoSnipingSettings() {
    await this.clickWithRetry(this.autoSnipingSettingsTab);
    await this.waitForElement(this.enableAutoSniping);
  }

  /**
   * Configure auto-sniping settings
   */
  async configureAutoSnipingSettings(settings: {
    enabled?: boolean;
    confidenceThreshold?: string;
    maxTargets?: string;
    advanceNotice?: string;
  }) {
    await this.switchToAutoSnipingSettings();
    
    if (settings.enabled !== undefined) {
      await this.toggleCheckbox(this.enableAutoSniping, settings.enabled);
    }
    if (settings.confidenceThreshold) {
      await this.fillFieldWithRetry(this.confidenceThreshold, settings.confidenceThreshold);
    }
    if (settings.maxTargets) {
      await this.fillFieldWithRetry(this.maxTargetsPerDay, settings.maxTargets);
    }
    if (settings.advanceNotice) {
      await this.fillFieldWithRetry(this.advanceNoticeMinutes, settings.advanceNotice);
    }
  }

  /**
   * Switch to Notifications tab
   */
  async switchToNotifications() {
    await this.clickWithRetry(this.notificationsTab);
    await this.waitForElement(this.emailNotifications);
  }

  /**
   * Configure notifications
   */
  async configureNotifications(settings: {
    email?: boolean;
    webhook?: string;
    notifyOnTrades?: boolean;
    notifyOnErrors?: boolean;
  }) {
    await this.switchToNotifications();
    
    if (settings.email !== undefined) {
      await this.toggleCheckbox(this.emailNotifications, settings.email);
    }
    if (settings.webhook) {
      await this.fillFieldWithRetry(this.webhookUrl, settings.webhook);
    }
    if (settings.notifyOnTrades !== undefined) {
      await this.toggleCheckbox(this.notifyOnTrades, settings.notifyOnTrades);
    }
    if (settings.notifyOnErrors !== undefined) {
      await this.toggleCheckbox(this.notifyOnErrors, settings.notifyOnErrors);
    }
  }

  /**
   * Switch to Account tab
   */
  async switchToAccount() {
    await this.clickWithRetry(this.accountTab);
    await this.waitForElement(this.userEmailDisplay);
  }

  /**
   * Get user email
   */
  async getUserEmail(): Promise<string> {
    await this.switchToAccount();
    return await this.userEmailDisplay.textContent() || '';
  }

  /**
   * Save settings
   */
  async saveSettings() {
    await this.clickWithRetry(this.saveButton);
    await this.waitForLoading();
  }

  /**
   * Cancel settings changes
   */
  async cancelSettings() {
    await this.clickWithRetry(this.cancelButton);
  }

  /**
   * Check if success message is displayed
   */
  async hasSuccessMessage(): Promise<boolean> {
    return await this.successMessage.isVisible();
  }

  /**
   * Check if error message is displayed
   */
  async hasErrorMessage(): Promise<boolean> {
    return await this.errorMessage.isVisible();
  }

  /**
   * Get success message text
   */
  async getSuccessMessage(): Promise<string> {
    await this.waitForElement(this.successMessage);
    return await this.successMessage.textContent() || '';
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string> {
    await this.waitForElement(this.errorMessage);
    return await this.errorMessage.textContent() || '';
  }

  /**
   * Toggle checkbox helper
   */
  private async toggleCheckbox(checkbox: Locator, enabled: boolean) {
    const isChecked = await checkbox.isChecked();
    if (isChecked !== enabled) {
      await this.clickWithRetry(checkbox);
    }
  }

  /**
   * Verify settings page elements
   */
  async verifySettingsElements() {
    await expect(this.pageTitle).toBeVisible();
    await expect(this.tabsList).toBeVisible();
    await expect(this.apiCredentialsTab).toBeVisible();
    await expect(this.tradingSettingsTab).toBeVisible();
  }

  // Extended methods for comprehensive testing

  /**
   * Clear API credentials
   */
  async clearApiCredentials() {
    await this.switchToApiCredentials();
    await this.mexcApiKeyInput.clear();
    await this.mexcSecretKeyInput.clear();
  }

  /**
   * Configure advanced trading settings
   */
  async configureAdvancedTradingSettings(settings: any) {
    await this.switchToTradingSettings();
    // Implementation for advanced settings
    for (const [key, value] of Object.entries(settings)) {
      const input = this.page.locator(`input[name="${key}"], select[name="${key}"]`);
      if (await input.isVisible()) {
        if (typeof value === 'boolean') {
          await this.toggleCheckbox(input, value);
        } else {
          await this.fillFieldWithRetry(input, value.toString());
        }
      }
    }
  }

  /**
   * Get trading settings
   */
  async getTradingSettings() {
    await this.switchToTradingSettings();
    return {
      positionSize: await this.defaultPositionSize.inputValue(),
      stopLoss: await this.stopLossPercentage.inputValue(),
      takeProfit: await this.takeProfitPercentage.inputValue(),
      maxTrades: await this.maxConcurrentTrades.inputValue(),
      riskManagement: await this.riskManagementToggle.isChecked()
    };
  }

  /**
   * Get auto-sniping settings
   */
  async getAutoSnipingSettings() {
    await this.switchToAutoSnipingSettings();
    return {
      enabled: await this.enableAutoSniping.isChecked(),
      confidenceThreshold: await this.confidenceThreshold.inputValue(),
      maxTargets: await this.maxTargetsPerDay.inputValue(),
      advanceNotice: await this.advanceNoticeMinutes.inputValue()
    };
  }

  /**
   * Configure risk management settings
   */
  async configureRiskManagement(settings: any) {
    const riskTab = this.page.locator('button:has-text("Risk Management"), [data-value="risk"]');
    await this.clickWithRetry(riskTab);
    
    for (const [key, value] of Object.entries(settings)) {
      const input = this.page.locator(`input[name="${key}"], select[name="${key}"]`);
      if (await input.isVisible()) {
        if (typeof value === 'boolean') {
          await this.toggleCheckbox(input, value);
        } else {
          await this.fillFieldWithRetry(input, value.toString());
        }
      }
    }
  }

  /**
   * Configure notification preferences
   */
  async configureNotifications(config: any) {
    await this.switchToNotifications();
    
    if (config.emailAlerts !== undefined) {
      await this.toggleCheckbox(this.emailNotifications, config.emailAlerts);
    }
    
    if (config.alertTypes) {
      for (const alertType of config.alertTypes) {
        const checkbox = this.page.locator(`input[name="${alertType}"]`);
        if (await checkbox.isVisible()) {
          await this.toggleCheckbox(checkbox, true);
        }
      }
    }
    
    if (config.quietHours) {
      const quietHoursToggle = this.page.locator('input[name="quietHoursEnabled"]');
      if (await quietHoursToggle.isVisible()) {
        await this.toggleCheckbox(quietHoursToggle, config.quietHours.enabled);
      }
    }
  }

  /**
   * Send test notification
   */
  async sendTestNotification() {
    const testButton = this.page.locator('button:has-text("Send Test"), [data-testid="test-notification"]');
    await this.clickWithRetry(testButton);
  }

  /**
   * Get test notification result
   */
  async getTestNotificationResult(): Promise<string> {
    const result = this.page.locator('[data-testid="test-result"]');
    await this.waitForElement(result);
    return await result.textContent() || '';
  }

  /**
   * Configure data management settings
   */
  async configureDataManagement(config: any) {
    const dataTab = this.page.locator('button:has-text("Data Management"), [data-value="data"]');
    await this.clickWithRetry(dataTab);
    
    for (const [key, value] of Object.entries(config)) {
      const input = this.page.locator(`input[name="${key}"], select[name="${key}"]`);
      if (await input.isVisible()) {
        if (typeof value === 'boolean') {
          await this.toggleCheckbox(input, value);
        } else {
          await this.fillFieldWithRetry(input, value.toString());
        }
      }
    }
  }

  /**
   * Initiate data export
   */
  async initiateDataExport(dataTypes: string[]) {
    const exportTab = this.page.locator('button:has-text("Export"), [data-value="export"]');
    await this.clickWithRetry(exportTab);
    
    for (const dataType of dataTypes) {
      const checkbox = this.page.locator(`input[name="${dataType}"]`);
      if (await checkbox.isVisible()) {
        await this.toggleCheckbox(checkbox, true);
      }
    }
    
    const exportButton = this.page.locator('button:has-text("Start Export")');
    await this.clickWithRetry(exportButton);
  }

  /**
   * Get export status
   */
  async getExportStatus(): Promise<string> {
    const status = this.page.locator('[data-testid="export-status"]');
    return await status.textContent() || '';
  }

  /**
   * Import settings from data
   */
  async importSettings(data: any) {
    const importTab = this.page.locator('button:has-text("Import"), [data-value="import"]');
    await this.clickWithRetry(importTab);
    
    // Simulate file upload or paste data
    const importArea = this.page.locator('[data-testid="import-area"]');
    await importArea.fill(JSON.stringify(data));
    
    const importButton = this.page.locator('button:has-text("Import Settings")');
    await this.clickWithRetry(importButton);
  }

  /**
   * Configure user interface preferences
   */
  async configureUserPreferences(config: any) {
    const uiTab = this.page.locator('button:has-text("Interface"), [data-value="interface"]');
    await this.clickWithRetry(uiTab);
    
    for (const [key, value] of Object.entries(config)) {
      const element = this.page.locator(`select[name="${key}"], input[name="${key}"]`);
      if (await element.isVisible()) {
        if (element.locator('option').count() > 0) {
          await element.selectOption(value.toString());
        } else if (typeof value === 'boolean') {
          await this.toggleCheckbox(element, value);
        } else {
          await this.fillFieldWithRetry(element, value.toString());
        }
      }
    }
  }

  /**
   * Get current theme
   */
  async getCurrentTheme(): Promise<string> {
    const themeSelect = this.page.locator('select[name="theme"]');
    return await themeSelect.inputValue();
  }

  /**
   * Configure accessibility settings
   */
  async configureAccessibility(config: any) {
    const accessibilityTab = this.page.locator('button:has-text("Accessibility"), [data-value="accessibility"]');
    await this.clickWithRetry(accessibilityTab);
    
    for (const [key, value] of Object.entries(config)) {
      const element = this.page.locator(`select[name="${key}"], input[name="${key}"]`);
      if (await element.isVisible()) {
        if (typeof value === 'boolean') {
          await this.toggleCheckbox(element, value);
        } else {
          await element.selectOption(value.toString());
        }
      }
    }
  }

  /**
   * Export all settings configuration
   */
  async exportAllSettings() {
    const exportButton = this.page.locator('button:has-text("Export All Settings")');
    await this.clickWithRetry(exportButton);
  }

  /**
   * Import complete configuration
   */
  async importCompleteConfiguration(config: any) {
    const importButton = this.page.locator('button:has-text("Import Configuration")');
    await this.clickWithRetry(importButton);
    
    // Simulate configuration import
    const configArea = this.page.locator('[data-testid="config-import"]');
    await configArea.fill(JSON.stringify(config));
    
    const applyButton = this.page.locator('button:has-text("Apply Configuration")');
    await this.clickWithRetry(applyButton);
  }

  /**
   * Get user settings including user ID
   */
  async getUserSettings() {
    return {
      userId: await this.getUserEmail(),
      // Add other user-specific settings
    };
  }

  /**
   * Get raw settings data for security verification
   */
  async getRawSettingsData(): Promise<string> {
    // This would typically inspect the DOM or make an API call
    const settingsJson = await this.page.evaluate(() => {
      return JSON.stringify(localStorage.getItem('settings') || '{}');
    });
    return settingsJson;
  }

  /**
   * Save invalid settings for validation testing
   */
  async saveInvalidSettings(invalidData: any) {
    // Directly manipulate form with invalid data
    await this.page.evaluate((data) => {
      const form = document.querySelector('form');
      if (form) {
        Object.entries(data).forEach(([key, value]) => {
          const input = form.querySelector(`[name="${key}"]`) as HTMLInputElement;
          if (input) {
            input.value = value as string;
          }
        });
      }
    }, invalidData);
    
    await this.saveSettings();
  }

  /**
   * Check for warning messages
   */
  async hasWarningMessage(): Promise<boolean> {
    const warning = this.page.locator('.warning, [data-testid="warning-message"]');
    return await warning.isVisible();
  }

  /**
   * Select pattern types for auto-sniping
   */
  async selectPatternTypes(patternTypes: string[]) {
    await this.switchToAutoSnipingSettings();
    
    for (const patternType of patternTypes) {
      const checkbox = this.page.locator(`input[name="pattern_${patternType}"]`);
      if (await checkbox.isVisible()) {
        await this.toggleCheckbox(checkbox, true);
      }
    }
  }

  /**
   * Configure pattern parameters
   */
  async configurePatternParameters(params: any) {
    for (const [key, value] of Object.entries(params)) {
      const input = this.page.locator(`input[name="${key}"]`);
      if (await input.isVisible()) {
        await this.fillFieldWithRetry(input, value.toString());
      }
    }
  }
}