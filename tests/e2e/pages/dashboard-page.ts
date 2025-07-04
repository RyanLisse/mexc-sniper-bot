import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base-page';

/**
 * Dashboard page object model
 */
export class DashboardPage extends BasePage {
  // Header elements
  private readonly pageTitle: Locator;
  private readonly userMenu: Locator;
  private readonly signOutButton: Locator;
  private readonly navigationMenu: Locator;

  // Metrics cards
  private readonly totalBalanceCard: Locator;
  private readonly newListingsCard: Locator;
  private readonly activeTargetsCard: Locator;
  private readonly winRateCard: Locator;

  // Tabs
  private readonly tabsList: Locator;
  private readonly autoSnipingTab: Locator;
  private readonly overviewTab: Locator;
  private readonly patternsTab: Locator;
  private readonly tradesTab: Locator;
  private readonly listingsTab: Locator;
  private readonly manualTradingTab: Locator;

  // Tab content
  private readonly autoSnipingContent: Locator;
  private readonly overviewContent: Locator;
  private readonly patternsContent: Locator;
  private readonly tradesContent: Locator;
  private readonly listingsContent: Locator;
  private readonly manualTradingContent: Locator;

  // Auto-sniping controls
  private readonly autoSnipingToggle: Locator;
  private readonly autoSnipingStatus: Locator;
  private readonly addTargetButton: Locator;
  private readonly configureButton: Locator;

  // Trading elements
  private readonly tradingChart: Locator;
  private readonly tradingTargetsSection: Locator;
  private readonly accountBalanceSection: Locator;
  private readonly activityFeed: Locator;
  private readonly recentTradesTable: Locator;

  // Pattern detection
  private readonly patternDisplay: Locator;
  private readonly aiEnhancedPatterns: Locator;
  private readonly readyLaunches: Locator;

  constructor(page: Page) {
    super(page);
    
    // Initialize locators
    this.pageTitle = page.locator('text=Dashboard');
    this.userMenu = page.locator('[data-testid="user-menu"], .user-menu, button[aria-label*="user"], button[aria-label*="menu"]');
    this.signOutButton = page.locator('button:has-text("Sign Out"), [data-testid="sign-out"], button:has-text("Logout")');
    this.navigationMenu = page.locator('[data-testid="navigation"], .navigation, nav');

    // Metrics cards
    this.totalBalanceCard = page.locator('text=Total Balance').locator('..');
    this.newListingsCard = page.locator('text=New Listings').locator('..');
    this.activeTargetsCard = page.locator('text=Active Targets').locator('..');
    this.winRateCard = page.locator('text=Win Rate').locator('..');

    // Tabs
    this.tabsList = page.locator('[role="tablist"]');
    this.autoSnipingTab = page.locator('[data-value="auto-sniping"], button:has-text("Auto-Sniping")');
    this.overviewTab = page.locator('[data-value="overview"], button:has-text("Overview")');
    this.patternsTab = page.locator('[data-value="patterns"], button:has-text("Pattern Detection")');
    this.tradesTab = page.locator('[data-value="trades"], button:has-text("Trading History")');
    this.listingsTab = page.locator('[data-value="listings"], button:has-text("New Listings")');
    this.manualTradingTab = page.locator('[data-value="manual-trading"], button:has-text("Manual Trading")');

    // Tab content
    this.autoSnipingContent = page.locator('[data-value="auto-sniping"][data-state="active"]');
    this.overviewContent = page.locator('[data-value="overview"][data-state="active"]');
    this.patternsContent = page.locator('[data-value="patterns"][data-state="active"]');
    this.tradesContent = page.locator('[data-value="trades"][data-state="active"]');
    this.listingsContent = page.locator('[data-value="listings"][data-state="active"]');
    this.manualTradingContent = page.locator('[data-value="manual-trading"][data-state="active"]');

    // Auto-sniping controls
    this.autoSnipingToggle = page.locator('[data-testid="auto-sniping-toggle"], input[type="checkbox"]');
    this.autoSnipingStatus = page.locator('[data-testid="auto-sniping-status"]');
    this.addTargetButton = page.locator('button:has-text("Add Target"), button:has-text("Add Section")');
    this.configureButton = page.locator('button:has-text("Configure"), button:has-text("Settings")');

    // Trading elements
    this.tradingChart = page.locator('[data-testid="trading-chart"], .trading-chart');
    this.tradingTargetsSection = page.locator('[data-testid="trading-targets"], .trading-targets');
    this.accountBalanceSection = page.locator('[data-testid="account-balance"], .account-balance');
    this.activityFeed = page.locator('[data-testid="activity-feed"], .activity-feed');
    this.recentTradesTable = page.locator('[data-testid="recent-trades"], .recent-trades, table');

    // Pattern detection
    this.patternDisplay = page.locator('[data-testid="pattern-display"], .pattern-display');
    this.aiEnhancedPatterns = page.locator('[data-testid="ai-patterns"], .ai-patterns');
    this.readyLaunches = page.locator('[data-testid="ready-launches"], .ready-launches');
  }

  /**
   * Navigate to dashboard
   */
  async navigate() {
    await this.goto('/dashboard');
    await this.waitForPageLoad();
  }

  /**
   * Wait for dashboard to load completely
   */
  async waitForPageLoad() {
    await this.waitForElement(this.pageTitle);
    await this.waitForElement(this.tabsList);
    await this.waitForLoading();
  }

  /**
   * Sign out from dashboard
   */
  async signOut() {
    // Try direct sign out button first
    if (await this.signOutButton.isVisible()) {
      await this.clickWithRetry(this.signOutButton);
    } else {
      // Try user menu approach
      await this.clickWithRetry(this.userMenu);
      await this.waitForElement(this.signOutButton);
      await this.clickWithRetry(this.signOutButton);
    }
    
    // Wait for redirect to auth page
    await this.waitForNavigation(/\/auth/);
  }

  /**
   * Get metric card value
   */
  async getMetricValue(cardName: string): Promise<string> {
    const card = this.page.locator(`text=${cardName}`).locator('..');
    const value = card.locator('.text-3xl, .text-2xl, .metric-value').first();
    await this.waitForElement(value);
    return await value.textContent() || '';
  }

  /**
   * Switch to specific tab
   */
  async switchToTab(tabName: string) {
    const tabMap: { [key: string]: Locator } = {
      'auto-sniping': this.autoSnipingTab,
      'overview': this.overviewTab,
      'patterns': this.patternsTab,
      'trades': this.tradesTab,
      'listings': this.listingsTab,
      'manual-trading': this.manualTradingTab
    };

    const tab = tabMap[tabName];
    if (!tab) {
      throw new Error(`Unknown tab: ${tabName}`);
    }

    await this.clickWithRetry(tab);
    await this.waitForTabContent(tabName);
  }

  /**
   * Wait for tab content to load
   */
  async waitForTabContent(tabName: string) {
    const contentMap: { [key: string]: Locator } = {
      'auto-sniping': this.autoSnipingContent,
      'overview': this.overviewContent,
      'patterns': this.patternsContent,
      'trades': this.tradesContent,
      'listings': this.listingsContent,
      'manual-trading': this.manualTradingContent
    };

    const content = contentMap[tabName];
    if (content) {
      await this.waitForElement(content);
    }
  }

  /**
   * Toggle auto-sniping on/off
   */
  async toggleAutoSniping() {
    await this.switchToTab('auto-sniping');
    await this.clickWithRetry(this.autoSnipingToggle);
  }

  /**
   * Get auto-sniping status
   */
  async getAutoSnipingStatus(): Promise<string> {
    await this.switchToTab('auto-sniping');
    await this.waitForElement(this.autoSnipingStatus);
    return await this.autoSnipingStatus.textContent() || '';
  }

  /**
   * Add new snipe target
   */
  async addSnipeTarget() {
    await this.switchToTab('auto-sniping');
    await this.clickWithRetry(this.addTargetButton);
  }

  /**
   * Check if trading chart is visible
   */
  async isTradingChartVisible(): Promise<boolean> {
    return await this.tradingChart.isVisible();
  }

  /**
   * Get recent trades count
   */
  async getRecentTradesCount(): Promise<number> {
    await this.switchToTab('trades');
    const rows = this.recentTradesTable.locator('tr');
    return await rows.count();
  }

  /**
   * Get patterns count
   */
  async getPatternsCount(): Promise<number> {
    await this.switchToTab('patterns');
    const patterns = this.patternDisplay.locator('[data-testid="pattern-item"], .pattern-item');
    return await patterns.count();
  }

  /**
   * Get listings count
   */
  async getListingsCount(): Promise<number> {
    await this.switchToTab('listings');
    const listings = this.listingsContent.locator('[data-testid="listing-item"], .listing-item');
    return await listings.count();
  }

  /**
   * Verify dashboard elements are present
   */
  async verifyDashboardElements() {
    await expect(this.pageTitle).toBeVisible();
    await expect(this.tabsList).toBeVisible();
    await expect(this.totalBalanceCard).toBeVisible();
    await expect(this.newListingsCard).toBeVisible();
    await expect(this.activeTargetsCard).toBeVisible();
    await expect(this.winRateCard).toBeVisible();
  }

  /**
   * Wait for metrics to load
   */
  async waitForMetrics() {
    await this.waitForElement(this.totalBalanceCard);
    await this.waitForElement(this.newListingsCard);
    await this.waitForElement(this.activeTargetsCard);
    await this.waitForElement(this.winRateCard);
  }

  /**
   * Get all tab badges (counts)
   */
  async getTabBadges(): Promise<{ [key: string]: number }> {
    const badges: { [key: string]: number } = {};
    
    const patternsBadge = this.patternsTab.locator('.rounded-full');
    const listingsBadge = this.listingsTab.locator('.rounded-full');
    
    if (await patternsBadge.isVisible()) {
      badges.patterns = parseInt(await patternsBadge.textContent() || '0');
    }
    
    if (await listingsBadge.isVisible()) {
      badges.listings = parseInt(await listingsBadge.textContent() || '0');
    }
    
    return badges;
  }

  /**
   * Check if user is authenticated (not redirected to auth)
   */
  async isAuthenticated(): Promise<boolean> {
    const currentUrl = await this.getCurrentUrl();
    return currentUrl.includes('/dashboard');
  }
}