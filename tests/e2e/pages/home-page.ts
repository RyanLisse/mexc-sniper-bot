import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base-page';

/**
 * Home page object model
 */
export class HomePage extends BasePage {
  // Header elements
  private readonly logo: Locator;
  private readonly appName: Locator;
  private readonly signInButton: Locator;
  private readonly getStartedButton: Locator;

  // Hero section
  private readonly heroTitle: Locator;
  private readonly heroDescription: Locator;
  private readonly heroGetStartedButton: Locator;
  private readonly heroSignInButton: Locator;
  private readonly aiBadge: Locator;

  // Features section
  private readonly featuresGrid: Locator;
  private readonly patternDetectionCard: Locator;
  private readonly multiAgentCard: Locator;
  private readonly analyticsCard: Locator;

  // Statistics section
  private readonly performanceCard: Locator;
  private readonly uptimeMetric: Locator;
  private readonly advanceNoticeMetric: Locator;
  private readonly agentsMetric: Locator;
  private readonly monitoringMetric: Locator;

  // How it works section
  private readonly howItWorksSection: Locator;
  private readonly monitorStep: Locator;
  private readonly analyzeStep: Locator;
  private readonly executeStep: Locator;

  // Call to action
  private readonly ctaSection: Locator;
  private readonly ctaButton: Locator;

  constructor(page: Page) {
    super(page);
    
    // Initialize locators
    this.logo = page.locator('[data-testid="logo"], .h-8.w-8');
    this.appName = page.locator('text=MEXC Sniper');
    this.signInButton = page.locator('header button:has-text("Sign In")');
    this.getStartedButton = page.locator('header button:has-text("Get Started")');

    // Hero section
    this.heroTitle = page.locator('h1:has-text("MEXC Sniper Bot")');
    this.heroDescription = page.locator('text=Advanced AI-powered cryptocurrency trading platform');
    this.heroGetStartedButton = page.locator('main button:has-text("Get Started")');
    this.heroSignInButton = page.locator('main button:has-text("Sign In")');
    this.aiBadge = page.locator('text=AI-Powered Trading System');

    // Features section
    this.featuresGrid = page.locator('.grid.md\\:grid-cols-3');
    this.patternDetectionCard = page.locator('text=Pattern Detection').locator('..');
    this.multiAgentCard = page.locator('text=Multi-Agent System').locator('..');
    this.analyticsCard = page.locator('text=Real-time Analytics').locator('..');

    // Statistics section
    this.performanceCard = page.locator('text=Platform Performance').locator('..');
    this.uptimeMetric = page.locator('text=99.5%');
    this.advanceNoticeMetric = page.locator('text=3.5hrs');
    this.agentsMetric = page.locator('text=5 Agents');
    this.monitoringMetric = page.locator('text=24/7');

    // How it works section
    this.howItWorksSection = page.locator('text=How It Works').locator('..');
    this.monitorStep = page.locator('text=Monitor Listings');
    this.analyzeStep = page.locator('text=Analyze Patterns');
    this.executeStep = page.locator('text=Execute Trades');

    // Call to action
    this.ctaSection = page.locator('text=Ready to Start Trading?').locator('..');
    this.ctaButton = page.locator('text=Sign Up Now');
  }

  /**
   * Navigate to home page
   */
  async navigate() {
    await this.goto('/');
    await this.waitForPageLoad();
  }

  /**
   * Wait for home page to load completely
   */
  async waitForPageLoad() {
    await this.waitForElement(this.heroTitle);
    await this.waitForElement(this.appName);
    await this.waitForLoading();
  }

  /**
   * Click sign in button in header
   */
  async clickHeaderSignIn() {
    await this.clickWithRetry(this.signInButton);
    await this.waitForNavigation(/\/auth/);
  }

  /**
   * Click get started button in header
   */
  async clickHeaderGetStarted() {
    await this.clickWithRetry(this.getStartedButton);
    await this.waitForNavigation(/\/auth/);
  }

  /**
   * Click get started button in hero section
   */
  async clickHeroGetStarted() {
    await this.clickWithRetry(this.heroGetStartedButton);
    await this.waitForNavigation(/\/auth/);
  }

  /**
   * Click sign in button in hero section
   */
  async clickHeroSignIn() {
    await this.clickWithRetry(this.heroSignInButton);
    await this.waitForNavigation(/\/auth/);
  }

  /**
   * Click sign up now button in CTA section
   */
  async clickSignUpNow() {
    await this.scrollToElement(this.ctaButton);
    await this.clickWithRetry(this.ctaButton);
    await this.waitForNavigation(/\/auth/);
  }

  /**
   * Verify all page elements are present
   */
  async verifyPageElements() {
    await expect(this.logo).toBeVisible();
    await expect(this.appName).toBeVisible();
    await expect(this.signInButton).toBeVisible();
    await expect(this.getStartedButton).toBeVisible();
    await expect(this.heroTitle).toBeVisible();
    await expect(this.heroDescription).toBeVisible();
    await expect(this.aiBadge).toBeVisible();
  }

  /**
   * Verify features section
   */
  async verifyFeaturesSection() {
    await expect(this.featuresGrid).toBeVisible();
    await expect(this.patternDetectionCard).toBeVisible();
    await expect(this.multiAgentCard).toBeVisible();
    await expect(this.analyticsCard).toBeVisible();
  }

  /**
   * Verify statistics section
   */
  async verifyStatisticsSection() {
    await expect(this.performanceCard).toBeVisible();
    await expect(this.uptimeMetric).toBeVisible();
    await expect(this.advanceNoticeMetric).toBeVisible();
    await expect(this.agentsMetric).toBeVisible();
    await expect(this.monitoringMetric).toBeVisible();
  }

  /**
   * Verify how it works section
   */
  async verifyHowItWorksSection() {
    await expect(this.howItWorksSection).toBeVisible();
    await expect(this.monitorStep).toBeVisible();
    await expect(this.analyzeStep).toBeVisible();
    await expect(this.executeStep).toBeVisible();
  }

  /**
   * Verify call to action section
   */
  async verifyCallToActionSection() {
    await expect(this.ctaSection).toBeVisible();
    await expect(this.ctaButton).toBeVisible();
  }

  /**
   * Scroll to features section
   */
  async scrollToFeatures() {
    await this.scrollToElement(this.featuresGrid);
  }

  /**
   * Scroll to statistics section
   */
  async scrollToStatistics() {
    await this.scrollToElement(this.performanceCard);
  }

  /**
   * Scroll to how it works section
   */
  async scrollToHowItWorks() {
    await this.scrollToElement(this.howItWorksSection);
  }

  /**
   * Scroll to call to action section
   */
  async scrollToCallToAction() {
    await this.scrollToElement(this.ctaSection);
  }

  /**
   * Get all statistics values
   */
  async getStatistics(): Promise<{ [key: string]: string }> {
    return {
      uptime: await this.uptimeMetric.textContent() || '',
      advanceNotice: await this.advanceNoticeMetric.textContent() || '',
      agents: await this.agentsMetric.textContent() || '',
      monitoring: await this.monitoringMetric.textContent() || ''
    };
  }

  /**
   * Check if user is authenticated (would be redirected to dashboard)
   */
  async isUserAuthenticated(): Promise<boolean> {
    const currentUrl = await this.getCurrentUrl();
    return currentUrl.includes('/dashboard');
  }

  /**
   * Verify responsive design elements
   */
  async verifyResponsiveDesign() {
    // Check if elements are properly responsive
    await expect(this.featuresGrid).toHaveClass(/grid/);
    await expect(this.featuresGrid).toHaveClass(/md:grid-cols-3/);
  }
}