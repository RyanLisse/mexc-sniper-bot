import { Page, expect, Locator } from '@playwright/test';

/**
 * E2E Test Helper Utilities
 * 
 * Common utilities and helpers for E2E tests
 */

// Test credentials
export const TEST_CREDENTIALS = {
  email: process.env.TEST_USER_EMAIL || process.env.AUTH_EMAIL || 'ryan@ryanlisse.com',
  password: process.env.TEST_USER_PASSWORD || process.env.AUTH_PASSWORD || 'Testing2025!',
  apiKey: process.env.MEXC_API_KEY || 'test-api-key',
  secretKey: process.env.MEXC_SECRET_KEY || 'test-secret-key'
};

// Test configuration
export const TEST_CONFIG = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3008',
  timeout: {
    short: 5000,
    medium: 10000,
    long: 30000
  },
  retries: {
    default: 3,
    auth: 5
  }
};

/**
 * Authentication helper
 */
export class AuthHelper {
  constructor(private page: Page) {}

  async signIn(email: string = TEST_CREDENTIALS.email, password: string = TEST_CREDENTIALS.password) {
    await this.page.goto(`${TEST_CONFIG.baseUrl}/auth`);
    await this.page.waitForLoadState('networkidle');
    
    // Wait for auth form to load
    await this.page.waitForSelector('input[type="email"]', { timeout: 15000 });
    
    await this.page.fill('input[type="email"]', email);
    await this.page.fill('input[type="password"]', password);
    await this.page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await this.page.waitForURL('**/dashboard', { timeout: 20000 });
  }

  async signOut() {
    // Try different sign out methods
    const signOutSelectors = [
      'button:has-text("Sign Out")',
      '[data-testid="sign-out"]',
      'button:has-text("Logout")'
    ];

    for (const selector of signOutSelectors) {
      const element = this.page.locator(selector);
      if (await element.isVisible()) {
        await element.click();
        break;
      }
    }

    // If no direct sign out button, try user menu
    const userMenu = this.page.locator('[data-testid="user-menu"], .user-menu, button[aria-label*="user"]');
    if (await userMenu.isVisible()) {
      await userMenu.click();
      await this.page.click('button:has-text("Sign Out"), button:has-text("Logout")');
    }

    // Wait for redirect to auth page
    await this.page.waitForURL('**/auth', { timeout: 10000 });
  }

  async isAuthenticated(): Promise<boolean> {
    return this.page.url().includes('/dashboard');
  }

  async clearAuthState() {
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }
}

/**
 * Wait utilities
 */
export class WaitHelper {
  constructor(private page: Page) {}

  async waitForElement(selector: string, timeout: number = TEST_CONFIG.timeout.medium) {
    await this.page.waitForSelector(selector, { timeout });
  }

  async waitForElementToBeHidden(selector: string, timeout: number = TEST_CONFIG.timeout.medium) {
    await this.page.waitForSelector(selector, { state: 'hidden', timeout });
  }

  async waitForApiResponse(urlPattern: string | RegExp, timeout: number = TEST_CONFIG.timeout.long) {
    return await this.page.waitForResponse(urlPattern, { timeout });
  }

  async waitForLoading(timeout: number = TEST_CONFIG.timeout.long) {
    const loadingSelectors = [
      '[data-testid="loading"]',
      '.loading',
      '.spinner',
      '[aria-label="Loading"]'
    ];

    for (const selector of loadingSelectors) {
      const element = this.page.locator(selector);
      if (await element.isVisible()) {
        await element.waitFor({ state: 'hidden', timeout });
      }
    }
  }

  async waitForNetworkIdle(timeout: number = TEST_CONFIG.timeout.medium) {
    await this.page.waitForLoadState('networkidle', { timeout });
  }
}

/**
 * Form utilities
 */
export class FormHelper {
  constructor(private page: Page) {}

  async fillWithRetry(selector: string, value: string, maxRetries: number = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.page.fill(selector, value);
        const currentValue = await this.page.inputValue(selector);
        if (currentValue === value) {
          return;
        }
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await this.page.waitForTimeout(1000);
      }
    }
  }

  async selectOption(selector: string, option: string | { label?: string; value?: string; index?: number }) {
    if (typeof option === 'string') {
      await this.page.selectOption(selector, option);
    } else {
      await this.page.selectOption(selector, option);
    }
  }

  async toggleCheckbox(selector: string, checked: boolean) {
    const checkbox = this.page.locator(selector);
    const isChecked = await checkbox.isChecked();
    if (isChecked !== checked) {
      await checkbox.click();
    }
  }

  async submitForm(formSelector: string = 'form') {
    await this.page.click(`${formSelector} button[type="submit"]`);
  }

  async clearForm(formSelector: string = 'form') {
    const inputs = this.page.locator(`${formSelector} input`);
    const count = await inputs.count();
    
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const type = await input.getAttribute('type');
      
      if (type === 'checkbox' || type === 'radio') {
        if (await input.isChecked()) {
          await input.uncheck();
        }
      } else {
        await input.clear();
      }
    }
  }
}

/**
 * Navigation utilities
 */
export class NavigationHelper {
  constructor(private page: Page) {}

  async navigateToPath(path: string) {
    const url = path.startsWith('http') ? path : `${TEST_CONFIG.baseUrl}${path}`;
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');
  }

  async navigateAndWait(path: string, waitFor: string | RegExp) {
    await this.navigateToPath(path);
    await this.page.waitForURL(waitFor);
  }

  async refreshPage() {
    await this.page.reload();
    await this.page.waitForLoadState('networkidle');
  }

  async goBack() {
    await this.page.goBack();
    await this.page.waitForLoadState('networkidle');
  }

  async getCurrentUrl(): Promise<string> {
    return this.page.url();
  }
}

/**
 * Screenshot and visual testing utilities
 */
export class VisualHelper {
  constructor(private page: Page) {}

  async takeScreenshot(name: string, options?: { fullPage?: boolean; clip?: any }) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}-${timestamp}.png`;
    
    await this.page.screenshot({
      path: `test-results/screenshots/${filename}`,
      fullPage: options?.fullPage || false,
      clip: options?.clip,
      ...options
    });
    
    return filename;
  }

  async compareScreenshot(name: string, options?: any) {
    await expect(this.page).toHaveScreenshot(`${name}.png`, {
      threshold: 0.2,
      ...options
    });
  }

  async compareElement(selector: string, name: string, options?: any) {
    const element = this.page.locator(selector);
    await expect(element).toHaveScreenshot(`${name}.png`, {
      threshold: 0.2,
      ...options
    });
  }

  async maskDynamicContent() {
    // Mask elements that change frequently
    const dynamicSelectors = [
      '[data-testid="timestamp"]',
      '.timestamp',
      '[data-dynamic]',
      '.real-time-data',
      '.live-price',
      '.current-time'
    ];

    for (const selector of dynamicSelectors) {
      const elements = this.page.locator(selector);
      const count = await elements.count();
      
      for (let i = 0; i < count; i++) {
        await elements.nth(i).evaluate(el => {
          el.style.backgroundColor = '#cccccc';
          el.style.color = '#cccccc';
        });
      }
    }
  }
}

/**
 * API testing utilities
 */
export class ApiHelper {
  constructor(private page: Page) {}

  async interceptResponse(urlPattern: string | RegExp, mockResponse: any) {
    await this.page.route(urlPattern, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse)
      });
    });
  }

  async interceptError(urlPattern: string | RegExp, status: number = 500, error: string = 'Server Error') {
    await this.page.route(urlPattern, route => {
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ error })
      });
    });
  }

  async monitorApiCalls(urlPattern: string | RegExp): Promise<any[]> {
    const apiCalls: any[] = [];
    
    this.page.on('response', response => {
      if (typeof urlPattern === 'string' && response.url().includes(urlPattern)) {
        apiCalls.push({
          url: response.url(),
          status: response.status(),
          headers: response.headers()
        });
      } else if (urlPattern instanceof RegExp && urlPattern.test(response.url())) {
        apiCalls.push({
          url: response.url(),
          status: response.status(),
          headers: response.headers()
        });
      }
    });
    
    return apiCalls;
  }

  async clearRoutes() {
    await this.page.unroute('**/*');
  }
}

/**
 * Performance testing utilities
 */
export class PerformanceHelper {
  constructor(private page: Page) {}

  async measurePageLoad(url: string): Promise<number> {
    const startTime = Date.now();
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');
    const endTime = Date.now();
    
    return endTime - startTime;
  }

  async measureInteraction(action: () => Promise<void>): Promise<number> {
    const startTime = Date.now();
    await action();
    const endTime = Date.now();
    
    return endTime - startTime;
  }

  async getPerformanceMetrics() {
    return await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
      };
    });
  }
}

/**
 * Accessibility testing utilities
 */
export class AccessibilityHelper {
  constructor(private page: Page) {}

  async checkKeyboardNavigation() {
    // Tab through all focusable elements
    const focusableElements = await this.page.$$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    
    for (let i = 0; i < Math.min(focusableElements.length, 10); i++) {
      await this.page.keyboard.press('Tab');
      await this.page.waitForTimeout(100);
    }
  }

  async checkAriaLabels() {
    const elementsWithoutLabels = await this.page.$$('button:not([aria-label]):not([aria-labelledby]), input:not([aria-label]):not([aria-labelledby])');
    return elementsWithoutLabels.length;
  }

  async checkColorContrast() {
    // Basic color contrast check
    return await this.page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      let contrastIssues = 0;
      
      elements.forEach(el => {
        const styles = window.getComputedStyle(el);
        const bg = styles.backgroundColor;
        const color = styles.color;
        
        // Simple check for default colors (would need more sophisticated contrast calculation)
        if (bg === 'rgb(255, 255, 255)' && color === 'rgb(255, 255, 255)') {
          contrastIssues++;
        }
      });
      
      return contrastIssues;
    });
  }
}

/**
 * Error handling utilities
 */
export class ErrorHelper {
  constructor(private page: Page) {}

  async captureConsoleErrors(): Promise<string[]> {
    const errors: string[] = [];
    
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    this.page.on('pageerror', error => {
      errors.push(error.message);
    });
    
    return errors;
  }

  async handleUnexpectedDialogs() {
    this.page.on('dialog', async dialog => {
      console.log(`Dialog appeared: ${dialog.message()}`);
      await dialog.accept();
    });
  }

  async simulateNetworkFailure() {
    await this.page.setOfflineMode(true);
  }

  async restoreNetwork() {
    await this.page.setOfflineMode(false);
  }
}

/**
 * Test data utilities
 */
export class TestDataHelper {
  static generateRandomEmail(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `test-${timestamp}-${random}@example.com`;
  }

  static generateRandomString(length: number = 10): string {
    return Math.random().toString(36).substring(2, length + 2);
  }

  static generateRandomNumber(min: number = 1, max: number = 100): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  static generateTradingData() {
    return {
      symbol: 'BTCUSDT',
      quantity: this.generateRandomNumber(1, 10).toString(),
      price: this.generateRandomNumber(30000, 70000).toString(),
      stopLoss: this.generateRandomNumber(1, 10).toString(),
      takeProfit: this.generateRandomNumber(5, 20).toString()
    };
  }
}

/**
 * Combined helper class for easy access
 */
export class E2EHelpers {
  public auth: AuthHelper;
  public wait: WaitHelper;
  public form: FormHelper;
  public navigation: NavigationHelper;
  public visual: VisualHelper;
  public api: ApiHelper;
  public performance: PerformanceHelper;
  public accessibility: AccessibilityHelper;
  public error: ErrorHelper;

  constructor(page: Page) {
    this.auth = new AuthHelper(page);
    this.wait = new WaitHelper(page);
    this.form = new FormHelper(page);
    this.navigation = new NavigationHelper(page);
    this.visual = new VisualHelper(page);
    this.api = new ApiHelper(page);
    this.performance = new PerformanceHelper(page);
    this.accessibility = new AccessibilityHelper(page);
    this.error = new ErrorHelper(page);
  }
}