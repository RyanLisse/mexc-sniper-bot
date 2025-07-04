import { Page, Locator, expect } from '@playwright/test';

/**
 * Base page class with common functionality for all page objects
 */
export class BasePage {
  protected page: Page;
  protected baseUrl: string;

  constructor(page: Page, baseUrl: string = process.env.TEST_BASE_URL || 'http://localhost:3008') {
    this.page = page;
    this.baseUrl = baseUrl;
  }

  /**
   * Navigate to a specific path
   */
  async goto(path: string = '') {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for element to be visible
   */
  async waitForElement(locator: Locator, timeout: number = 10000) {
    await locator.waitFor({ state: 'visible', timeout });
  }

  /**
   * Wait for element to be hidden
   */
  async waitForElementToBeHidden(locator: Locator, timeout: number = 10000) {
    await locator.waitFor({ state: 'hidden', timeout });
  }

  /**
   * Get current URL
   */
  async getCurrentUrl(): Promise<string> {
    return this.page.url();
  }

  /**
   * Wait for navigation to complete
   */
  async waitForNavigation(urlPattern?: string | RegExp, timeout: number = 15000) {
    if (urlPattern) {
      await this.page.waitForURL(urlPattern, { timeout });
    } else {
      await this.page.waitForLoadState('networkidle', { timeout });
    }
  }

  /**
   * Take screenshot
   */
  async takeScreenshot(name: string) {
    await this.page.screenshot({ path: `test-results/${name}.png` });
  }

  /**
   * Clear browser storage
   */
  async clearStorage() {
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }

  /**
   * Wait for API response
   */
  async waitForApiResponse(urlPattern: string | RegExp, timeout: number = 30000) {
    return await this.page.waitForResponse(urlPattern, { timeout });
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    return await this.page.title();
  }

  /**
   * Check if element exists
   */
  async elementExists(selector: string): Promise<boolean> {
    return await this.page.locator(selector).count() > 0;
  }

  /**
   * Scroll to element
   */
  async scrollToElement(locator: Locator) {
    await locator.scrollIntoViewIfNeeded();
  }

  /**
   * Wait for loading to complete
   */
  async waitForLoading(timeout: number = 30000) {
    // Wait for common loading indicators to disappear
    const loadingSelectors = [
      '[data-testid="loading"]',
      '.loading',
      '.spinner',
      '[aria-label="Loading"]',
      'text=Loading...'
    ];

    for (const selector of loadingSelectors) {
      const element = this.page.locator(selector);
      if (await element.isVisible()) {
        await element.waitFor({ state: 'hidden', timeout });
      }
    }
  }

  /**
   * Handle alert dialogs
   */
  async handleAlert(accept: boolean = true) {
    this.page.on('dialog', async (dialog) => {
      if (accept) {
        await dialog.accept();
      } else {
        await dialog.dismiss();
      }
    });
  }

  /**
   * Fill form field with retry logic
   */
  async fillFieldWithRetry(locator: Locator, value: string, maxRetries: number = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await locator.fill(value);
        const currentValue = await locator.inputValue();
        if (currentValue === value) {
          return;
        }
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await this.page.waitForTimeout(1000);
      }
    }
  }

  /**
   * Click with retry logic
   */
  async clickWithRetry(locator: Locator, maxRetries: number = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await locator.click();
        return;
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await this.page.waitForTimeout(1000);
      }
    }
  }
}