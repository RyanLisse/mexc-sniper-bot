import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base-page';

/**
 * Authentication page object model
 */
export class AuthPage extends BasePage {
  // Page elements
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly signInButton: Locator;
  private readonly signUpButton: Locator;
  private readonly forgotPasswordLink: Locator;
  private readonly errorMessage: Locator;
  private readonly loadingSpinner: Locator;
  private readonly pageTitle: Locator;
  private readonly signUpLink: Locator;
  private readonly signInLink: Locator;
  private readonly authProvider: Locator;

  constructor(page: Page) {
    super(page);
    
    // Initialize locators
    this.emailInput = page.locator('input[type="email"]');
    this.passwordInput = page.locator('input[type="password"]');
    this.signInButton = page.locator('button[type="submit"]');
    this.signUpButton = page.locator('button:has-text("Sign Up"), button:has-text("Create account")');
    this.forgotPasswordLink = page.locator('a:has-text("Forgot"), a:has-text("Reset")');
    this.errorMessage = page.locator('[role="alert"], .error, [data-testid="error"], .supabase-auth-ui_ui-message');
    this.loadingSpinner = page.locator('[data-testid="loading"], .loading, .spinner');
    this.pageTitle = page.locator('h1');
    this.signUpLink = page.locator('a:has-text("Sign up"), a:has-text("Create account")');
    this.signInLink = page.locator('a:has-text("Sign in"), a:has-text("Login")');
    this.authProvider = page.locator('[data-testid="auth-provider"]');
  }

  /**
   * Navigate to authentication page
   */
  async navigate() {
    await this.goto('/auth');
    await this.waitForPageLoad();
  }

  /**
   * Wait for auth page to load completely
   */
  async waitForPageLoad() {
    await this.waitForElement(this.pageTitle);
    await this.waitForElement(this.emailInput);
    await this.waitForElement(this.passwordInput);
    await this.waitForElement(this.signInButton);
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string) {
    await this.fillFieldWithRetry(this.emailInput, email);
    await this.fillFieldWithRetry(this.passwordInput, password);
    await this.clickWithRetry(this.signInButton);
  }

  /**
   * Sign up with email and password
   */
  async signUp(email: string, password: string) {
    await this.fillFieldWithRetry(this.emailInput, email);
    await this.fillFieldWithRetry(this.passwordInput, password);
    
    // Look for sign up button or toggle to sign up mode
    if (await this.signUpButton.isVisible()) {
      await this.clickWithRetry(this.signUpButton);
    } else if (await this.signUpLink.isVisible()) {
      await this.clickWithRetry(this.signUpLink);
      await this.clickWithRetry(this.signInButton);
    } else {
      throw new Error('Sign up option not found');
    }
  }

  /**
   * Click forgot password link
   */
  async clickForgotPassword() {
    await this.clickWithRetry(this.forgotPasswordLink);
  }

  /**
   * Check if error message is displayed
   */
  async hasErrorMessage(): Promise<boolean> {
    return await this.errorMessage.isVisible();
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string> {
    await this.waitForElement(this.errorMessage);
    return await this.errorMessage.textContent() || '';
  }

  /**
   * Check if loading spinner is visible
   */
  async isLoading(): Promise<boolean> {
    return await this.loadingSpinner.isVisible();
  }

  /**
   * Wait for authentication to complete
   */
  async waitForAuthCompletion(expectedUrl: string = '/dashboard') {
    // Wait for either successful redirect or error message
    await Promise.race([
      this.waitForNavigation(new RegExp(expectedUrl)),
      this.waitForElement(this.errorMessage)
    ]);
  }

  /**
   * Verify page elements are present
   */
  async verifyPageElements() {
    await expect(this.pageTitle).toContainText('MEXC Sniper');
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.signInButton).toBeVisible();
  }

  /**
   * Clear auth form
   */
  async clearForm() {
    await this.emailInput.clear();
    await this.passwordInput.clear();
  }

  /**
   * Check if user is already authenticated and redirected
   */
  async isRedirectedToDashboard(): Promise<boolean> {
    const currentUrl = await this.getCurrentUrl();
    return currentUrl.includes('/dashboard');
  }

  /**
   * Switch between sign in and sign up modes
   */
  async switchToSignUp() {
    if (await this.signUpLink.isVisible()) {
      await this.clickWithRetry(this.signUpLink);
    }
  }

  async switchToSignIn() {
    if (await this.signInLink.isVisible()) {
      await this.clickWithRetry(this.signInLink);
    }
  }

  /**
   * Get current authentication mode
   */
  async getAuthMode(): Promise<'signin' | 'signup' | 'unknown'> {
    const buttonText = await this.signInButton.textContent();
    if (buttonText?.toLowerCase().includes('sign up') || buttonText?.toLowerCase().includes('create')) {
      return 'signup';
    } else if (buttonText?.toLowerCase().includes('sign in') || buttonText?.toLowerCase().includes('login')) {
      return 'signin';
    }
    return 'unknown';
  }

  /**
   * Wait for Supabase Auth UI to fully load
   */
  async waitForSupabaseAuthUI() {
    await this.page.waitForFunction(() => {
      const emailInput = document.querySelector('input[type="email"]');
      const passwordInput = document.querySelector('input[type="password"]');
      const submitButton = document.querySelector('button[type="submit"]');
      return emailInput && passwordInput && submitButton;
    }, { timeout: 15000 });
  }
}