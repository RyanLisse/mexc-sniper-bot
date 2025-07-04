import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base-page';

/**
 * Monitoring page object model
 */
export class MonitoringPage extends BasePage {
  // Page elements
  private readonly pageTitle: Locator;
  private readonly tabsList: Locator;
  
  // System Overview tab
  private readonly systemOverviewTab: Locator;
  private readonly systemHealthCard: Locator;
  private readonly apiStatusCard: Locator;
  private readonly databaseStatusCard: Locator;
  private readonly websocketStatusCard: Locator;
  
  // Performance tab
  private readonly performanceTab: Locator;
  private readonly performanceMetrics: Locator;
  private readonly responseTimeChart: Locator;
  private readonly throughputChart: Locator;
  private readonly errorRateChart: Locator;
  
  // Trading Analytics tab
  private readonly tradingAnalyticsTab: Locator;
  private readonly tradingPerformanceCard: Locator;
  private readonly profitLossChart: Locator;
  private readonly winRateMetric: Locator;
  private readonly totalTradesMetric: Locator;
  
  // Alerts tab
  private readonly alertsTab: Locator;
  private readonly activeAlerts: Locator;
  private readonly alertsHistory: Locator;
  private readonly alertsSettings: Locator;
  
  // Real-time Monitoring tab
  private readonly realTimeTab: Locator;
  private readonly liveDataFeed: Locator;
  private readonly activeConnections: Locator;
  private readonly marketDataStream: Locator;
  
  // Agent Status
  private readonly agentStatusSection: Locator;
  private readonly calendarAgent: Locator;
  private readonly patternAgent: Locator;
  private readonly tradingAgent: Locator;
  private readonly safetyAgent: Locator;
  private readonly orchestratorAgent: Locator;
  
  // Controls
  private readonly refreshButton: Locator;
  private readonly exportButton: Locator;
  private readonly settingsButton: Locator;
  private readonly emergencyStopButton: Locator;
  
  // Status indicators
  private readonly statusIndicators: Locator;
  private readonly loadingSpinner: Locator;
  private readonly lastUpdated: Locator;

  constructor(page: Page) {
    super(page);
    
    // Initialize locators
    this.pageTitle = page.locator('h1:has-text("Monitoring"), h2:has-text("System Monitoring")');
    this.tabsList = page.locator('[role="tablist"]');
    
    // System Overview
    this.systemOverviewTab = page.locator('button:has-text("System Overview"), [data-value="system"]');
    this.systemHealthCard = page.locator('[data-testid="system-health"], .system-health');
    this.apiStatusCard = page.locator('[data-testid="api-status"], .api-status');
    this.databaseStatusCard = page.locator('[data-testid="database-status"], .database-status');
    this.websocketStatusCard = page.locator('[data-testid="websocket-status"], .websocket-status');
    
    // Performance
    this.performanceTab = page.locator('button:has-text("Performance"), [data-value="performance"]');
    this.performanceMetrics = page.locator('[data-testid="performance-metrics"], .performance-metrics');
    this.responseTimeChart = page.locator('[data-testid="response-time-chart"], .response-time-chart');
    this.throughputChart = page.locator('[data-testid="throughput-chart"], .throughput-chart');
    this.errorRateChart = page.locator('[data-testid="error-rate-chart"], .error-rate-chart');
    
    // Trading Analytics
    this.tradingAnalyticsTab = page.locator('button:has-text("Trading Analytics"), [data-value="trading"]');
    this.tradingPerformanceCard = page.locator('[data-testid="trading-performance"], .trading-performance');
    this.profitLossChart = page.locator('[data-testid="profit-loss-chart"], .profit-loss-chart');
    this.winRateMetric = page.locator('[data-testid="win-rate"], .win-rate');
    this.totalTradesMetric = page.locator('[data-testid="total-trades"], .total-trades');
    
    // Alerts
    this.alertsTab = page.locator('button:has-text("Alerts"), [data-value="alerts"]');
    this.activeAlerts = page.locator('[data-testid="active-alerts"], .active-alerts');
    this.alertsHistory = page.locator('[data-testid="alerts-history"], .alerts-history');
    this.alertsSettings = page.locator('[data-testid="alerts-settings"], .alerts-settings');
    
    // Real-time
    this.realTimeTab = page.locator('button:has-text("Real-time"), [data-value="realtime"]');
    this.liveDataFeed = page.locator('[data-testid="live-data-feed"], .live-data-feed');
    this.activeConnections = page.locator('[data-testid="active-connections"], .active-connections');
    this.marketDataStream = page.locator('[data-testid="market-data-stream"], .market-data-stream');
    
    // Agent Status
    this.agentStatusSection = page.locator('[data-testid="agent-status"], .agent-status');
    this.calendarAgent = page.locator('[data-testid="calendar-agent"], .calendar-agent');
    this.patternAgent = page.locator('[data-testid="pattern-agent"], .pattern-agent');
    this.tradingAgent = page.locator('[data-testid="trading-agent"], .trading-agent');
    this.safetyAgent = page.locator('[data-testid="safety-agent"], .safety-agent');
    this.orchestratorAgent = page.locator('[data-testid="orchestrator-agent"], .orchestrator-agent');
    
    // Controls
    this.refreshButton = page.locator('button:has-text("Refresh"), [data-testid="refresh-button"]');
    this.exportButton = page.locator('button:has-text("Export"), [data-testid="export-button"]');
    this.settingsButton = page.locator('button:has-text("Settings"), [data-testid="settings-button"]');
    this.emergencyStopButton = page.locator('button:has-text("Emergency Stop"), [data-testid="emergency-stop"]');
    
    // Status indicators
    this.statusIndicators = page.locator('[data-testid="status-indicators"], .status-indicators');
    this.loadingSpinner = page.locator('.loading, [data-testid="loading"]');
    this.lastUpdated = page.locator('[data-testid="last-updated"], .last-updated');
  }

  /**
   * Navigate to monitoring page
   */
  async navigate() {
    await this.goto('/monitoring');
    await this.waitForPageLoad();
  }

  /**
   * Wait for monitoring page to load
   */
  async waitForPageLoad() {
    await this.waitForElement(this.pageTitle);
    await this.waitForElement(this.tabsList);
    await this.waitForLoading();
  }

  /**
   * Switch to System Overview tab
   */
  async switchToSystemOverview() {
    await this.clickWithRetry(this.systemOverviewTab);
    await this.waitForElement(this.systemHealthCard);
  }

  /**
   * Switch to Performance tab
   */
  async switchToPerformance() {
    await this.clickWithRetry(this.performanceTab);
    await this.waitForElement(this.performanceMetrics);
  }

  /**
   * Switch to Trading Analytics tab
   */
  async switchToTradingAnalytics() {
    await this.clickWithRetry(this.tradingAnalyticsTab);
    await this.waitForElement(this.tradingPerformanceCard);
  }

  /**
   * Switch to Alerts tab
   */
  async switchToAlerts() {
    await this.clickWithRetry(this.alertsTab);
    await this.waitForElement(this.activeAlerts);
  }

  /**
   * Switch to Real-time tab
   */
  async switchToRealTime() {
    await this.clickWithRetry(this.realTimeTab);
    await this.waitForElement(this.liveDataFeed);
  }

  /**
   * Get system health status
   */
  async getSystemHealthStatus(): Promise<string> {
    await this.switchToSystemOverview();
    await this.waitForElement(this.systemHealthCard);
    return await this.systemHealthCard.textContent() || '';
  }

  /**
   * Get API status
   */
  async getApiStatus(): Promise<string> {
    await this.switchToSystemOverview();
    await this.waitForElement(this.apiStatusCard);
    return await this.apiStatusCard.textContent() || '';
  }

  /**
   * Get database status
   */
  async getDatabaseStatus(): Promise<string> {
    await this.switchToSystemOverview();
    await this.waitForElement(this.databaseStatusCard);
    return await this.databaseStatusCard.textContent() || '';
  }

  /**
   * Get websocket status
   */
  async getWebsocketStatus(): Promise<string> {
    await this.switchToSystemOverview();
    await this.waitForElement(this.websocketStatusCard);
    return await this.websocketStatusCard.textContent() || '';
  }

  /**
   * Get agent statuses
   */
  async getAgentStatuses(): Promise<{ [key: string]: string }> {
    await this.switchToSystemOverview();
    
    const statuses: { [key: string]: string } = {};
    
    if (await this.calendarAgent.isVisible()) {
      statuses.calendar = await this.calendarAgent.textContent() || '';
    }
    if (await this.patternAgent.isVisible()) {
      statuses.pattern = await this.patternAgent.textContent() || '';
    }
    if (await this.tradingAgent.isVisible()) {
      statuses.trading = await this.tradingAgent.textContent() || '';
    }
    if (await this.safetyAgent.isVisible()) {
      statuses.safety = await this.safetyAgent.textContent() || '';
    }
    if (await this.orchestratorAgent.isVisible()) {
      statuses.orchestrator = await this.orchestratorAgent.textContent() || '';
    }
    
    return statuses;
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<{ [key: string]: string }> {
    await this.switchToPerformance();
    
    const metrics: { [key: string]: string } = {};
    
    if (await this.responseTimeChart.isVisible()) {
      metrics.responseTime = await this.responseTimeChart.textContent() || '';
    }
    if (await this.throughputChart.isVisible()) {
      metrics.throughput = await this.throughputChart.textContent() || '';
    }
    if (await this.errorRateChart.isVisible()) {
      metrics.errorRate = await this.errorRateChart.textContent() || '';
    }
    
    return metrics;
  }

  /**
   * Get trading analytics
   */
  async getTradingAnalytics(): Promise<{ [key: string]: string }> {
    await this.switchToTradingAnalytics();
    
    const analytics: { [key: string]: string } = {};
    
    if (await this.winRateMetric.isVisible()) {
      analytics.winRate = await this.winRateMetric.textContent() || '';
    }
    if (await this.totalTradesMetric.isVisible()) {
      analytics.totalTrades = await this.totalTradesMetric.textContent() || '';
    }
    
    return analytics;
  }

  /**
   * Get active alerts count
   */
  async getActiveAlertsCount(): Promise<number> {
    await this.switchToAlerts();
    const alertItems = this.activeAlerts.locator('.alert-item, [data-testid="alert-item"]');
    return await alertItems.count();
  }

  /**
   * Get real-time data status
   */
  async getRealTimeDataStatus(): Promise<string> {
    await this.switchToRealTime();
    await this.waitForElement(this.liveDataFeed);
    return await this.liveDataFeed.textContent() || '';
  }

  /**
   * Refresh monitoring data
   */
  async refreshData() {
    await this.clickWithRetry(this.refreshButton);
    await this.waitForLoading();
  }

  /**
   * Export monitoring data
   */
  async exportData() {
    await this.clickWithRetry(this.exportButton);
  }

  /**
   * Trigger emergency stop
   */
  async triggerEmergencyStop() {
    await this.clickWithRetry(this.emergencyStopButton);
    await this.handleAlert(true); // Accept the confirmation dialog
  }

  /**
   * Check if emergency stop is active
   */
  async isEmergencyStopActive(): Promise<boolean> {
    const stopButton = this.emergencyStopButton;
    const buttonText = await stopButton.textContent();
    return buttonText?.toLowerCase().includes('active') || false;
  }

  /**
   * Get last updated timestamp
   */
  async getLastUpdated(): Promise<string> {
    if (await this.lastUpdated.isVisible()) {
      return await this.lastUpdated.textContent() || '';
    }
    return '';
  }

  /**
   * Check if data is currently loading
   */
  async isLoading(): Promise<boolean> {
    return await this.loadingSpinner.isVisible();
  }

  /**
   * Wait for real-time data updates
   */
  async waitForRealTimeUpdates(timeout: number = 30000) {
    await this.switchToRealTime();
    
    // Wait for live data feed to show activity
    await this.page.waitForFunction(() => {
      const feed = document.querySelector('[data-testid="live-data-feed"], .live-data-feed');
      return feed && feed.textContent && feed.textContent.trim() !== '';
    }, { timeout });
  }

  /**
   * Verify monitoring page elements
   */
  async verifyMonitoringElements() {
    await expect(this.pageTitle).toBeVisible();
    await expect(this.tabsList).toBeVisible();
    await expect(this.systemOverviewTab).toBeVisible();
    await expect(this.performanceTab).toBeVisible();
    await expect(this.tradingAnalyticsTab).toBeVisible();
    await expect(this.alertsTab).toBeVisible();
    await expect(this.realTimeTab).toBeVisible();
  }

  /**
   * Verify system health indicators
   */
  async verifySystemHealth() {
    await this.switchToSystemOverview();
    
    await expect(this.systemHealthCard).toBeVisible();
    await expect(this.apiStatusCard).toBeVisible();
    await expect(this.databaseStatusCard).toBeVisible();
    await expect(this.websocketStatusCard).toBeVisible();
  }

  /**
   * Verify all agents are running
   */
  async verifyAgentsRunning() {
    const agentStatuses = await this.getAgentStatuses();
    
    for (const [agent, status] of Object.entries(agentStatuses)) {
      expect(status.toLowerCase()).toContain('running');
    }
  }

  // Extended methods for comprehensive administrative and monitoring testing

  /**
   * Get all health statuses for components
   */
  async getAllHealthStatuses(): Promise<{ [key: string]: string }> {
    const healthStatuses: { [key: string]: string } = {};
    
    const components = ['database', 'api', 'websocket', 'trading-engine'];
    for (const component of components) {
      const statusElement = this.page.locator(`[data-testid="${component}-health"]`);
      if (await statusElement.isVisible()) {
        const statusText = await statusElement.textContent() || '';
        // Extract status from text (healthy, warning, critical)
        if (statusText.toLowerCase().includes('healthy')) {
          healthStatuses[component] = 'healthy';
        } else if (statusText.toLowerCase().includes('warning')) {
          healthStatuses[component] = 'warning';
        } else if (statusText.toLowerCase().includes('critical')) {
          healthStatuses[component] = 'critical';
        } else {
          healthStatuses[component] = 'unknown';
        }
      }
    }
    
    return healthStatuses;
  }

  /**
   * Refresh health status
   */
  async refreshHealthStatus() {
    const refreshHealthButton = this.page.locator('button:has-text("Refresh Health"), [data-testid="refresh-health"]');
    await this.clickWithRetry(refreshHealthButton);
    await this.waitForLoading();
  }

  /**
   * Get health alert message
   */
  async getHealthAlertMessage(): Promise<string> {
    const alertMessage = this.page.locator('[data-testid="health-alert"] .alert-message');
    return await alertMessage.textContent() || '';
  }

  /**
   * Get system metrics including CPU, memory, etc.
   */
  async getSystemMetrics() {
    const metricsSection = this.page.locator('[data-testid="system-metrics"]');
    
    return {
      cpuUsage: await this.getMetricValue('cpu-usage'),
      memoryUsage: await this.getMetricValue('memory-usage'),
      activeConnections: await this.getMetricValue('active-connections'),
      requestsPerMinute: await this.getMetricValue('requests-per-minute'),
      timestamp: await this.getMetricValue('timestamp')
    };
  }

  /**
   * Helper to get metric value by name
   */
  async getMetricValue(metricName: string): Promise<string> {
    const metric = this.page.locator(`[data-testid="${metricName}"]`);
    return await metric.textContent() || '';
  }

  /**
   * Navigate to user management
   */
  async navigateToUserManagement() {
    await this.goto('/monitoring/users');
    await this.waitForPageLoad();
  }

  /**
   * Get user statistics
   */
  async getUserStatistics() {
    return {
      totalUsers: parseInt(await this.getMetricValue('total-users') || '0'),
      activeUsers: parseInt(await this.getMetricValue('active-users') || '0'),
      newUsers: parseInt(await this.getMetricValue('new-users') || '0')
    };
  }

  /**
   * Search for a user
   */
  async searchUser(email: string) {
    const searchInput = this.page.locator('input[placeholder*="Search users"], [data-testid="user-search"]');
    await this.fillFieldWithRetry(searchInput, email);
    
    const searchButton = this.page.locator('button:has-text("Search"), [data-testid="search-button"]');
    await this.clickWithRetry(searchButton);
  }

  /**
   * Check if user is displayed in results
   */
  async isUserDisplayed(email: string): Promise<boolean> {
    const userRow = this.page.locator(`tr:has-text("${email}"), [data-user-email="${email}"]`);
    return await userRow.isVisible();
  }

  /**
   * View user details
   */
  async viewUserDetails(email: string) {
    const userRow = this.page.locator(`tr:has-text("${email}")`);
    const viewButton = userRow.locator('button:has-text("View"), [data-action="view"]');
    await this.clickWithRetry(viewButton);
  }

  /**
   * View active sessions
   */
  async viewActiveSessions() {
    const sessionsTab = this.page.locator('button:has-text("Active Sessions"), [data-value="sessions"]');
    await this.clickWithRetry(sessionsTab);
  }

  /**
   * Get active sessions data
   */
  async getActiveSessions() {
    const sessionRows = this.page.locator('[data-testid="sessions-table"] tbody tr');
    const sessions = [];
    
    const count = await sessionRows.count();
    for (let i = 0; i < count; i++) {
      const row = sessionRows.nth(i);
      sessions.push({
        userId: await row.locator('td:nth-child(1)').textContent() || '',
        sessionId: await row.locator('td:nth-child(2)').textContent() || '',
        createdAt: await row.locator('td:nth-child(3)').textContent() || ''
      });
    }
    
    return sessions;
  }

  /**
   * Navigate to trading system administration
   */
  async navigateToTradingSystem() {
    await this.goto('/monitoring/trading');
    await this.waitForPageLoad();
  }

  /**
   * Get trading system statistics
   */
  async getTradingSystemStats() {
    return {
      activeTargets: parseInt(await this.getMetricValue('active-targets') || '0'),
      successRate: await this.getMetricValue('success-rate'),
      totalTrades: parseInt(await this.getMetricValue('total-trades') || '0')
    };
  }

  /**
   * Activate emergency stop
   */
  async activateEmergencyStop() {
    const emergencyButton = this.page.locator('button:has-text("Emergency Stop"), [data-testid="emergency-stop"]');
    await this.clickWithRetry(emergencyButton);
    
    const confirmButton = this.page.locator('button:has-text("Confirm"), [data-testid="confirm-emergency"]');
    await this.clickWithRetry(confirmButton);
  }

  /**
   * Get emergency stop status
   */
  async getEmergencyStopStatus(): Promise<string> {
    const status = this.page.locator('[data-testid="emergency-status"]');
    return await status.textContent() || '';
  }

  /**
   * Get trading status
   */
  async getTradingStatus(): Promise<string> {
    const status = this.page.locator('[data-testid="trading-status"]');
    return await status.textContent() || '';
  }

  /**
   * Deactivate emergency stop
   */
  async deactivateEmergencyStop() {
    const resumeButton = this.page.locator('button:has-text("Resume Trading"), [data-testid="resume-trading"]');
    await this.clickWithRetry(resumeButton);
  }

  /**
   * Update system configuration
   */
  async updateSystemConfiguration(config: any) {
    const configTab = this.page.locator('button:has-text("Configuration"), [data-value="config"]');
    await this.clickWithRetry(configTab);
    
    for (const [key, value] of Object.entries(config)) {
      const input = this.page.locator(`input[name="${key}"], select[name="${key}"]`);
      if (await input.isVisible()) {
        if (typeof value === 'boolean') {
          const isChecked = await input.isChecked();
          if (isChecked !== value) {
            await this.clickWithRetry(input);
          }
        } else {
          await this.fillFieldWithRetry(input, value.toString());
        }
      }
    }
    
    const saveButton = this.page.locator('button:has-text("Save Configuration")');
    await this.clickWithRetry(saveButton);
  }

  /**
   * Get system configuration
   */
  async getSystemConfiguration() {
    const config: any = {};
    
    const configInputs = this.page.locator('[data-testid="config-form"] input, [data-testid="config-form"] select');
    const count = await configInputs.count();
    
    for (let i = 0; i < count; i++) {
      const input = configInputs.nth(i);
      const name = await input.getAttribute('name');
      const type = await input.getAttribute('type');
      
      if (name) {
        if (type === 'checkbox') {
          config[name] = await input.isChecked();
        } else {
          config[name] = await input.inputValue();
        }
      }
    }
    
    return config;
  }

  /**
   * Check for success message
   */
  async hasSuccessMessage(): Promise<boolean> {
    const success = this.page.locator('.success, [data-testid="success-message"]');
    return await success.isVisible();
  }

  /**
   * Navigate to database administration
   */
  async navigateToDatabaseAdmin() {
    await this.goto('/monitoring/database');
    await this.waitForPageLoad();
  }

  /**
   * Get database statistics
   */
  async getDatabaseStatistics() {
    return {
      connectionCount: parseInt(await this.getMetricValue('db-connections') || '0'),
      queryCount: parseInt(await this.getMetricValue('db-queries') || '0'),
      avgResponseTime: await this.getMetricValue('db-response-time')
    };
  }

  /**
   * Optimize database
   */
  async optimizeDatabase() {
    const optimizeButton = this.page.locator('button:has-text("Optimize Database")');
    await this.clickWithRetry(optimizeButton);
  }

  /**
   * Get optimization result
   */
  async getOptimizationResult() {
    const result = this.page.locator('[data-testid="optimization-result"]');
    const resultText = await result.textContent() || '';
    
    return {
      status: resultText.includes('completed') ? 'completed' : 'running',
      improvementPercent: parseInt(resultText.match(/(\d+)%/)?.[1] || '0')
    };
  }

  /**
   * Configure data archival
   */
  async configureDataArchival(config: any) {
    const archivalTab = this.page.locator('button:has-text("Data Archival"), [data-value="archival"]');
    await this.clickWithRetry(archivalTab);
    
    for (const [key, value] of Object.entries(config)) {
      const input = this.page.locator(`input[name="${key}"]`);
      if (await input.isVisible()) {
        if (typeof value === 'boolean') {
          const isChecked = await input.isChecked();
          if (isChecked !== value) {
            await this.clickWithRetry(input);
          }
        } else {
          await this.fillFieldWithRetry(input, value.toString());
        }
      }
    }
  }

  /**
   * Start data archival process
   */
  async startDataArchival() {
    const startButton = this.page.locator('button:has-text("Start Archival")');
    await this.clickWithRetry(startButton);
  }

  /**
   * Get archival status
   */
  async getArchivalStatus(): Promise<string> {
    const status = this.page.locator('[data-testid="archival-status"]');
    return await status.textContent() || '';
  }

  /**
   * Navigate to security monitoring
   */
  async navigateToSecurity() {
    await this.goto('/monitoring/security');
    await this.waitForPageLoad();
  }

  /**
   * Get security metrics
   */
  async getSecurityMetrics() {
    return {
      failedLoginAttempts: parseInt(await this.getMetricValue('failed-logins') || '0'),
      suspiciousActivity: parseInt(await this.getMetricValue('suspicious-activity') || '0'),
      blockedIPs: parseInt(await this.getMetricValue('blocked-ips') || '0')
    };
  }

  /**
   * Filter audit logs
   */
  async filterAuditLogs(filters: any) {
    for (const [key, value] of Object.entries(filters)) {
      const filterElement = this.page.locator(`select[name="${key}"], input[name="${key}"]`);
      if (await filterElement.isVisible()) {
        if (filterElement.locator('option').count() > 0) {
          await filterElement.selectOption(value.toString());
        } else {
          await this.fillFieldWithRetry(filterElement, value.toString());
        }
      }
    }
    
    const applyButton = this.page.locator('button:has-text("Apply Filters")');
    await this.clickWithRetry(applyButton);
  }

  /**
   * Get audit logs
   */
  async getAuditLogs() {
    const logRows = this.page.locator('[data-testid="audit-logs-table"] tbody tr');
    const logs = [];
    
    const count = await logRows.count();
    for (let i = 0; i < count; i++) {
      const row = logRows.nth(i);
      logs.push({
        timestamp: await row.locator('td:nth-child(1)').textContent() || '',
        eventType: await row.locator('td:nth-child(2)').textContent() || '',
        userId: await row.locator('td:nth-child(3)').textContent() || ''
      });
    }
    
    return logs;
  }

  /**
   * Refresh security incidents
   */
  async refreshSecurityIncidents() {
    const refreshButton = this.page.locator('button:has-text("Refresh Incidents")');
    await this.clickWithRetry(refreshButton);
  }

  /**
   * Acknowledge security incident
   */
  async acknowledgeSecurityIncident(incidentId: string) {
    const incident = this.page.locator(`[data-incident-id="${incidentId}"]`);
    const ackButton = incident.locator('button:has-text("Acknowledge")');
    await this.clickWithRetry(ackButton);
  }

  /**
   * Get incident status
   */
  async getIncidentStatus(incidentId: string): Promise<string> {
    const incident = this.page.locator(`[data-incident-id="${incidentId}"]`);
    const status = incident.locator('[data-testid="incident-status"]');
    return await status.textContent() || '';
  }

  /**
   * Navigate to performance monitoring
   */
  async navigateToPerformance() {
    await this.goto('/monitoring/performance');
    await this.waitForPageLoad();
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics() {
    return {
      avgResponseTime: await this.getMetricValue('avg-response-time'),
      requestsPerSecond: parseFloat(await this.getMetricValue('requests-per-second') || '0'),
      errorRate: parseFloat(await this.getMetricValue('error-rate') || '0')
    };
  }

  /**
   * Configure performance alerts
   */
  async configurePerformanceAlerts(config: any) {
    const alertsTab = this.page.locator('button:has-text("Performance Alerts"), [data-value="perf-alerts"]');
    await this.clickWithRetry(alertsTab);
    
    for (const [key, value] of Object.entries(config)) {
      const input = this.page.locator(`input[name="${key}"]`);
      if (await input.isVisible()) {
        if (typeof value === 'boolean') {
          const isChecked = await input.isChecked();
          if (isChecked !== value) {
            await this.clickWithRetry(input);
          }
        } else {
          await this.fillFieldWithRetry(input, value.toString());
        }
      }
    }
    
    const saveButton = this.page.locator('button:has-text("Save Alert Configuration")');
    await this.clickWithRetry(saveButton);
  }

  /**
   * Refresh performance metrics
   */
  async refreshPerformanceMetrics() {
    const refreshButton = this.page.locator('button:has-text("Refresh Metrics")');
    await this.clickWithRetry(refreshButton);
  }

  /**
   * Get active performance alerts
   */
  async getActivePerformanceAlerts() {
    const alertRows = this.page.locator('[data-testid="performance-alerts"] .alert-item');
    const alerts = [];
    
    const count = await alertRows.count();
    for (let i = 0; i < count; i++) {
      const alert = alertRows.nth(i);
      alerts.push({
        type: await alert.locator('.alert-type').textContent() || '',
        message: await alert.locator('.alert-message').textContent() || '',
        severity: await alert.locator('.alert-severity').textContent() || ''
      });
    }
    
    return alerts;
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(config: any) {
    const reportTab = this.page.locator('button:has-text("Generate Report"), [data-value="reports"]');
    await this.clickWithRetry(reportTab);
    
    // Configure report parameters
    for (const [key, value] of Object.entries(config)) {
      const element = this.page.locator(`select[name="${key}"], input[name="${key}"]`);
      if (await element.isVisible()) {
        if (element.locator('option').count() > 0) {
          await element.selectOption(value.toString());
        } else if (typeof value === 'boolean') {
          const isChecked = await element.isChecked();
          if (isChecked !== value) {
            await this.clickWithRetry(element);
          }
        } else {
          await this.fillFieldWithRetry(element, value.toString());
        }
      }
    }
    
    const generateButton = this.page.locator('button:has-text("Generate Report")');
    await this.clickWithRetry(generateButton);
  }

  /**
   * Get report status
   */
  async getReportStatus(): Promise<string> {
    const status = this.page.locator('[data-testid="report-status"]');
    return await status.textContent() || '';
  }

  /**
   * Download performance report
   */
  async downloadPerformanceReport() {
    const downloadButton = this.page.locator('button:has-text("Download Report")');
    await this.clickWithRetry(downloadButton);
  }

  /**
   * Get download status
   */
  async getDownloadStatus(): Promise<string> {
    const status = this.page.locator('[data-testid="download-status"]');
    return await status.textContent() || '';
  }

  /**
   * Navigate to system configuration
   */
  async navigateToSystemConfig() {
    await this.goto('/monitoring/system-config');
    await this.waitForPageLoad();
  }

  /**
   * Update global configuration
   */
  async updateGlobalConfiguration(config: any) {
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'object' && value !== null) {
        // Handle nested config objects
        for (const [subKey, subValue] of Object.entries(value)) {
          const input = this.page.locator(`input[name="${key}.${subKey}"]`);
          if (await input.isVisible()) {
            await this.fillFieldWithRetry(input, subValue.toString());
          }
        }
      } else {
        const input = this.page.locator(`input[name="${key}"], select[name="${key}"]`);
        if (await input.isVisible()) {
          if (typeof value === 'boolean') {
            const isChecked = await input.isChecked();
            if (isChecked !== value) {
              await this.clickWithRetry(input);
            }
          } else {
            await this.fillFieldWithRetry(input, value.toString());
          }
        }
      }
    }
    
    const saveButton = this.page.locator('button:has-text("Save Global Configuration")');
    await this.clickWithRetry(saveButton);
  }

  /**
   * Navigate to feature flags
   */
  async navigateToFeatureFlags() {
    await this.goto('/monitoring/feature-flags');
    await this.waitForPageLoad();
  }

  /**
   * Update feature flags
   */
  async updateFeatureFlags(flags: any) {
    for (const [flag, enabled] of Object.entries(flags)) {
      const toggle = this.page.locator(`input[name="${flag}"]`);
      if (await toggle.isVisible()) {
        const isChecked = await toggle.isChecked();
        if (isChecked !== enabled) {
          await this.clickWithRetry(toggle);
        }
      }
    }
    
    const saveButton = this.page.locator('button:has-text("Save Feature Flags")');
    await this.clickWithRetry(saveButton);
  }

  /**
   * Get feature flags
   */
  async getFeatureFlags() {
    const flags: any = {};
    
    const flagToggles = this.page.locator('[data-testid="feature-flags-form"] input[type="checkbox"]');
    const count = await flagToggles.count();
    
    for (let i = 0; i < count; i++) {
      const toggle = flagToggles.nth(i);
      const name = await toggle.getAttribute('name');
      if (name) {
        flags[name] = await toggle.isChecked();
      }
    }
    
    return flags;
  }

  /**
   * Navigate to environment configuration
   */
  async navigateToEnvironmentConfig() {
    await this.goto('/monitoring/environment');
    await this.waitForPageLoad();
  }

  /**
   * Get environment variables (non-sensitive only)
   */
  async getEnvironmentVariables() {
    const envVars: any = {};
    
    const envTable = this.page.locator('[data-testid="env-vars-table"] tbody tr');
    const count = await envTable.count();
    
    for (let i = 0; i < count; i++) {
      const row = envTable.nth(i);
      const name = await row.locator('td:nth-child(1)').textContent();
      const value = await row.locator('td:nth-child(2)').textContent();
      
      if (name && value && !value.includes('***')) {
        envVars[name] = value;
      }
    }
    
    return envVars;
  }

  /**
   * Update environment variable
   */
  async updateEnvironmentVariable(name: string, value: string) {
    const row = this.page.locator(`tr:has-text("${name}")`);
    const editButton = row.locator('button:has-text("Edit")');
    await this.clickWithRetry(editButton);
    
    const input = this.page.locator(`input[name="env-${name}"]`);
    await this.fillFieldWithRetry(input, value);
    
    const saveButton = this.page.locator('button:has-text("Save")');
    await this.clickWithRetry(saveButton);
  }

  // Additional utility methods for comprehensive testing
  
  /**
   * Refresh all dashboards
   */
  async refreshAllDashboards() {
    const refreshAllButton = this.page.locator('button:has-text("Refresh All"), [data-testid="refresh-all"]');
    await this.clickWithRetry(refreshAllButton);
    await this.waitForLoading();
  }

  /**
   * Get current metrics with timestamp
   */
  async getCurrentMetrics() {
    return {
      cpuUsage: parseFloat(await this.getMetricValue('cpu-usage') || '0'),
      memoryUsage: parseFloat(await this.getMetricValue('memory-usage') || '0'),
      timestamp: await this.getMetricValue('metrics-timestamp') || new Date().toISOString()
    };
  }

  /**
   * Set performance thresholds
   */
  async setPerformanceThresholds(thresholds: any) {
    const thresholdsTab = this.page.locator('button:has-text("Thresholds"), [data-value="thresholds"]');
    await this.clickWithRetry(thresholdsTab);
    
    for (const [metric, value] of Object.entries(thresholds)) {
      const input = this.page.locator(`input[name="${metric}-threshold"]`);
      if (await input.isVisible()) {
        await this.fillFieldWithRetry(input, value.toString());
      }
    }
    
    const saveButton = this.page.locator('button:has-text("Save Thresholds")');
    await this.clickWithRetry(saveButton);
  }

  /**
   * Refresh metrics
   */
  async refreshMetrics() {
    const refreshButton = this.page.locator('button:has-text("Refresh"), [data-testid="refresh-metrics"]');
    await this.clickWithRetry(refreshButton);
  }

  /**
   * Get active alert count
   */
  async getActiveAlertCount(): Promise<number> {
    const alertCount = this.page.locator('[data-testid="alert-count"]');
    const countText = await alertCount.textContent() || '0';
    return parseInt(countText.match(/\d+/)?.[0] || '0');
  }

  // Navigation methods for specialized monitoring sections

  /**
   * Navigate to trading metrics
   */
  async navigateToTradingMetrics() {
    await this.goto('/monitoring/trading-metrics');
    await this.waitForPageLoad();
  }

  /**
   * Get trading performance metrics
   */
  async getTradingPerformanceMetrics() {
    return {
      avgOrderExecutionTime: await this.getMetricValue('avg-execution-time'),
      patternDetectionLatency: await this.getMetricValue('pattern-latency'),
      successRate: parseFloat(await this.getMetricValue('success-rate') || '0')
    };
  }

  /**
   * Navigate to trading analytics
   */
  async navigateToTradingAnalytics() {
    await this.goto('/monitoring/trading-analytics');
    await this.waitForPageLoad();
  }

  /**
   * Get trading analytics data
   */
  async getTradingAnalytics() {
    return {
      totalTrades: parseInt(await this.getMetricValue('total-trades') || '0'),
      winRate: await this.getMetricValue('win-rate'),
      avgProfitPerTrade: await this.getMetricValue('avg-profit'),
      sharpeRatio: await this.getMetricValue('sharpe-ratio'),
      timePeriod: await this.getMetricValue('time-period')
    };
  }

  /**
   * Select time period for analytics
   */
  async selectTimePeriod(period: string) {
    const periodSelect = this.page.locator('select[name="timePeriod"], [data-testid="time-period-select"]');
    await periodSelect.selectOption(period);
    await this.waitForLoading();
  }

  /**
   * Navigate to pattern analytics
   */
  async navigateToPatternAnalytics() {
    await this.goto('/monitoring/pattern-analytics');
    await this.waitForPageLoad();
  }

  /**
   * Get pattern analytics data
   */
  async getPatternAnalytics() {
    return {
      totalPatterns: parseInt(await this.getMetricValue('total-patterns') || '0'),
      avgConfidence: parseFloat(await this.getMetricValue('avg-confidence') || '0'),
      successfulTargets: parseInt(await this.getMetricValue('successful-targets') || '0')
    };
  }

  /**
   * Generate trading report
   */
  async generateTradingReport(config: any) {
    const reportSection = this.page.locator('[data-testid="report-generation"]');
    
    // Configure date range
    if (config.dateRange) {
      const startDate = this.page.locator('input[name="startDate"]');
      const endDate = this.page.locator('input[name="endDate"]');
      await this.fillFieldWithRetry(startDate, config.dateRange.start);
      await this.fillFieldWithRetry(endDate, config.dateRange.end);
    }
    
    // Select metrics to include
    if (config.includeMetrics) {
      for (const metric of config.includeMetrics) {
        const checkbox = this.page.locator(`input[name="metric-${metric}"]`);
        if (await checkbox.isVisible()) {
          await checkbox.check();
        }
      }
    }
    
    // Set other options
    if (config.groupBy) {
      const groupBySelect = this.page.locator('select[name="groupBy"]');
      await groupBySelect.selectOption(config.groupBy);
    }
    
    if (config.format) {
      const formatSelect = this.page.locator('select[name="format"]');
      await formatSelect.selectOption(config.format);
    }
    
    const generateButton = this.page.locator('button:has-text("Generate Report")');
    await this.clickWithRetry(generateButton);
  }

  /**
   * Get report generation status
   */
  async getReportGenerationStatus(): Promise<string> {
    const status = this.page.locator('[data-testid="report-generation-status"]');
    return await status.textContent() || '';
  }

  /**
   * Preview generated report
   */
  async previewGeneratedReport() {
    const previewButton = this.page.locator('button:has-text("Preview Report")');
    await this.clickWithRetry(previewButton);
  }
}