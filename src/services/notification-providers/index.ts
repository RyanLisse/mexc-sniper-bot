import { and, count, eq, gte, inArray } from "drizzle-orm";
import {
  alertInstances,
  alertNotifications,
  notificationChannels,
  type SelectAlertInstance,
  type SelectNotificationChannel,
} from "../../db/schemas/alerts";
import { EmailProvider } from "./email-provider";
import { SlackProvider } from "./slack-provider";
import { SMSProvider } from "./sms-provider";
import { TeamsProvider } from "./teams-provider";
import { WebhookProvider } from "./webhook-provider";

export interface NotificationProvider {
  send(
    channel: SelectNotificationChannel,
    alert: SelectAlertInstance,
    message: NotificationMessage
  ): Promise<NotificationResult>;

  validateConfig(config: Record<string, unknown>): Promise<boolean>;
  getProviderType(): string;
}

export interface NotificationMessage {
  subject?: string;
  title: string;
  body: string;
  priority: "low" | "medium" | "high" | "critical";
  alertUrl?: string;
  attachments?: NotificationAttachment[];
  metadata?: Record<string, unknown>;
}

export interface NotificationAttachment {
  name: string;
  content: string;
  contentType: string;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  response?: unknown;
  error?: string;
  rateLimited?: boolean;
}

export interface EscalationStep {
  delay: number; // seconds
  channels: string[];
  condition?: "unresolved" | "unacknowledged";
}

export class NotificationService {
  private db: any;
  private providers: Map<string, NotificationProvider> = new Map();
  private rateLimitCache: Map<string, number[]> = new Map();

  /**
   * Lazy logger initialization to prevent webpack bundling issues
   */
  private get logger(): { info: (message: string, context?: any) => void; warn: (message: string, context?: any) => void; error: (message: string, context?: any, error?: Error) => void; debug: (message: string, context?: any) => void; } {
    if (!this._logger) {
      try {
        this._logger = {
      info: (message: string, context?: any) => console.info('[notification-service]', message, context || ''),
      warn: (message: string, context?: any) => console.warn('[notification-service]', message, context || ''),
      error: (message: string, context?: any, error?: Error) => console.error('[notification-service]', message, context || '', error || ''),
      debug: (message: string, context?: any) => console.debug('[notification-service]', message, context || ''),
    };
      } catch (error) {
        // Fallback to console logging during build time
        this._logger = {
          debug: console.debug.bind(console),
          info: console.info.bind(console),
          warn: console.warn.bind(console),
          error: console.error.bind(console),
          fatal: console.error.bind(console),
        } as any;
      }
    }
    return this._logger;
  }

  constructor(database: any) {
    this.db = database;
    this.initializeProviders();
  }

  private initializeProviders(): void {
    this.providers.set("email", new EmailProvider());
    this.providers.set("slack", new SlackProvider());
    this.providers.set("webhook", new WebhookProvider());
    this.providers.set("sms", new SMSProvider());
    this.providers.set("teams", new TeamsProvider());
  }

  // ==========================================
  // NOTIFICATION SENDING
  // ==========================================

  async sendAlertNotifications(alert: SelectAlertInstance): Promise<void> {
    try {
      // Get applicable notification channels
      const channels = await this.getChannelsForAlert(alert);
      console.info(`Sending alert ${alert.id} to ${channels.length} channels`);

      // Send to each channel
      const notificationPromises = channels.map((channel) =>
        this.sendToChannel(channel, alert, "alert")
      );

      await Promise.allSettled(notificationPromises);

      // Start escalation timer if configured
      await this.scheduleEscalation(alert);
    } catch (error) {
      console.error("Error sending alert notifications:", error);
    }
  }

  async sendResolutionNotifications(alert: SelectAlertInstance): Promise<void> {
    try {
      // Get channels that received the original alert
      const sentNotifications = await this.db
        .select()
        .from(alertNotifications)
        .leftJoin(notificationChannels, eq(alertNotifications.channelId, notificationChannels.id))
        .where(
          and(eq(alertNotifications.alertId, alert.id), eq(alertNotifications.status, "sent"))
        );

      const channels = sentNotifications.map((n) => n.notification_channels);

      // Send resolution notification to each channel
      const notificationPromises = channels.map((channel) =>
        this.sendToChannel(channel, alert, "resolution")
      );

      await Promise.allSettled(notificationPromises);
    } catch (error) {
      console.error("Error sending resolution notifications:", error);
    }
  }

  private async sendToChannel(
    channel: SelectNotificationChannel,
    alert: SelectAlertInstance,
    type: "alert" | "resolution" | "escalation"
  ): Promise<void> {
    try {
      // Check rate limiting
      if (await this.isChannelRateLimited(channel)) {
        console.warn(`Channel ${channel.id} is rate limited`);
        await this.recordNotificationAttempt(alert.id, channel.id, "rate_limited");
        return;
      }

      // Get the appropriate provider
      const provider = this.providers.get(channel.type);
      if (!provider) {
        console.error(`No provider found for channel type: ${channel.type}`);
        return;
      }

      // Build notification message
      const message = this.buildNotificationMessage(alert, channel, type);

      // Record attempt
      const notificationId = await this.recordNotificationAttempt(alert.id, channel.id, "pending");

      // Send notification
      const result = await provider.send(channel, alert, message);

      // Update notification record
      await this.updateNotificationResult(notificationId, result);

      // Update rate limiting cache
      this.updateRateLimit(channel);

      console.info(
        `Notification sent to ${channel.name}: ${result.success ? "success" : "failed"}`
      );
    } catch (error) {
      console.error(`Error sending to channel ${channel.name}:`, error);
    }
  }

  // ==========================================
  // ESCALATION MANAGEMENT
  // ==========================================

  private async scheduleEscalation(alert: SelectAlertInstance): Promise<void> {
    // Find applicable escalation policy
    const escalationPolicy = await this.getEscalationPolicy(alert);
    if (!escalationPolicy) {
      return;
    }

    const steps: EscalationStep[] = JSON.parse(escalationPolicy.steps);

    // Schedule first escalation step
    if (steps.length > 0) {
      const firstStep = steps[0];
      setTimeout(() => this.executeEscalationStep(alert, firstStep, 1), firstStep.delay * 1000);
    }
  }

  private async executeEscalationStep(
    alert: SelectAlertInstance,
    step: EscalationStep,
    level: number
  ): Promise<void> {
    try {
      // Check if alert is still active
      const currentAlert = await this.db
        .select()
        .from(alertInstances)
        .where(eq(alertInstances.id, alert.id))
        .limit(1);

      if (currentAlert.length === 0 || currentAlert[0].status !== "firing") {
        console.info(`Alert ${alert.id} is no longer active, skipping escalation`);
        return;
      }

      // Check escalation condition
      if (step.condition === "unacknowledged") {
        // TODO: Check if alert has been acknowledged
      }

      // Get escalation channels
      const channels = await this.db
        .select()
        .from(notificationChannels)
        .where(
          and(
            eq(notificationChannels.isEnabled, true),
            inArray(notificationChannels.id, step.channels)
          )
        );

      // Send escalation notifications
      for (const channel of channels) {
        await this.sendToChannel(channel, alert, "escalation");
      }

      // Update alert escalation level
      await this.db
        .update(alertInstances)
        .set({
          escalationLevel: level,
          lastEscalatedAt: new Date(),
        })
        .where(eq(alertInstances.id, alert.id));

      console.info(`Escalated alert ${alert.id} to level ${level}`);
    } catch (error) {
      console.error(`Error executing escalation step:`, error);
    }
  }

  // ==========================================
  // CHANNEL MANAGEMENT
  // ==========================================

  private async getChannelsForAlert(
    alert: SelectAlertInstance
  ): Promise<SelectNotificationChannel[]> {
    const channels = await this.db
      .select()
      .from(notificationChannels)
      .where(eq(notificationChannels.isEnabled, true));

    return channels.filter((channel) => this.channelMatchesAlert(channel, alert));
  }

  private channelMatchesAlert(
    channel: SelectNotificationChannel,
    alert: SelectAlertInstance
  ): boolean {
    // Check severity filter
    if (channel.severityFilter) {
      const severities = JSON.parse(channel.severityFilter);
      if (!severities.includes(alert.severity)) {
        return false;
      }
    }

    // Check category filter
    if (channel.categoryFilter) {
      const _categories = JSON.parse(channel.categoryFilter);
      // Get rule to check category
      // TODO: Join with alert rules table to get category
    }

    // Check tag filter
    if (channel.tagFilter && alert.labels) {
      const tagFilter = JSON.parse(channel.tagFilter);
      const alertLabels = JSON.parse(alert.labels);

      const hasMatchingTag = tagFilter.some((tag: string) =>
        Object.values(alertLabels).includes(tag)
      );

      if (!hasMatchingTag) {
        return false;
      }
    }

    return true;
  }

  // ==========================================
  // RATE LIMITING
  // ==========================================

  private async isChannelRateLimited(channel: SelectNotificationChannel): Promise<boolean> {
    const oneHourAgo = Date.now() - 3600000;

    const recentNotifications = await this.db
      .select({ count: count() })
      .from(alertNotifications)
      .where(
        and(
          eq(alertNotifications.channelId, channel.id),
          gte(alertNotifications.createdAt, new Date(oneHourAgo)),
          eq(alertNotifications.status, "sent")
        )
      );

    const notificationCount = recentNotifications[0]?.count || 0;
    return notificationCount >= channel.rateLimitPerHour;
  }

  private updateRateLimit(channel: SelectNotificationChannel): void {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    if (!this.rateLimitCache.has(channel.id)) {
      this.rateLimitCache.set(channel.id, []);
    }

    const timestamps = this.rateLimitCache.get(channel.id)!;

    // Add current timestamp
    timestamps.push(now);

    // Remove old timestamps
    const filtered = timestamps.filter((ts) => ts > oneHourAgo);
    this.rateLimitCache.set(channel.id, filtered);
  }

  // ==========================================
  // MESSAGE BUILDING
  // ==========================================

  private buildNotificationMessage(
    alert: SelectAlertInstance,
    channel: SelectNotificationChannel,
    type: "alert" | "resolution" | "escalation"
  ): NotificationMessage {
    const baseTitle =
      type === "resolution"
        ? `🟢 RESOLVED: ${alert.message}`
        : type === "escalation"
          ? `🔺 ESCALATED: ${alert.message}`
          : `${this.getSeverityEmoji(alert.severity)} ${alert.message}`;

    const baseBody = this.buildMessageBody(alert, type);

    // Apply custom templates if configured
    const title = this.applyTemplate(channel.titleTemplate, baseTitle, alert);
    const body = this.applyTemplate(channel.messageTemplate, baseBody, alert);

    return {
      title,
      body,
      subject: title,
      priority: this.mapSeverityToPriority(alert.severity),
      alertUrl: `${process.env.NEXT_PUBLIC_APP_URL}/alerts/${alert.id}`,
      metadata: {
        alertId: alert.id,
        severity: alert.severity,
        source: alert.source,
        type,
      },
    };
  }

  private buildMessageBody(alert: SelectAlertInstance, type: string): string {
    const sections = [
      `**Alert ID:** ${alert.id}`,
      `**Source:** ${alert.source}`,
      `**Severity:** ${alert.severity.toUpperCase()}`,
      `**Metric Value:** ${alert.metricValue}`,
    ];

    if (alert.threshold) {
      sections.push(`**Threshold:** ${alert.threshold}`);
    }

    if (alert.anomalyScore) {
      sections.push(`**Anomaly Score:** ${alert.anomalyScore.toFixed(2)}`);
    }

    if (alert.description) {
      sections.push(`**Description:** ${alert.description}`);
    }

    if (type === "resolution" && alert.resolutionNotes) {
      sections.push(`**Resolution:** ${alert.resolutionNotes}`);
    }

    sections.push(`**Triggered:** ${new Date(alert.firstTriggeredAt).toISOString()}`);

    return sections.join("\n");
  }

  private applyTemplate(
    template: string | null,
    defaultValue: string,
    alert: SelectAlertInstance
  ): string {
    if (!template) {
      return defaultValue;
    }

    return template
      .replace(/\{\{alert\.id\}\}/g, alert.id)
      .replace(/\{\{alert\.message\}\}/g, alert.message)
      .replace(/\{\{alert\.severity\}\}/g, alert.severity)
      .replace(/\{\{alert\.source\}\}/g, alert.source)
      .replace(/\{\{alert\.value\}\}/g, alert.metricValue?.toString() || "")
      .replace(/\{\{alert\.threshold\}\}/g, alert.threshold?.toString() || "")
      .replace(/\{\{timestamp\}\}/g, new Date().toISOString());
  }

  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case "critical":
        return "🔴";
      case "high":
        return "🟠";
      case "medium":
        return "🟡";
      case "low":
        return "🔵";
      case "info":
        return "⚪";
      default:
        return "⚪";
    }
  }

  private mapSeverityToPriority(severity: string): "low" | "medium" | "high" | "critical" {
    switch (severity) {
      case "critical":
        return "critical";
      case "high":
        return "high";
      case "medium":
        return "medium";
      default:
        return "low";
    }
  }

  // ==========================================
  // DATABASE OPERATIONS
  // ==========================================

  private async recordNotificationAttempt(
    alertId: string,
    channelId: string,
    status: string
  ): Promise<string> {
    const notificationId = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await this.db.insert(alertNotifications).values({
      id: notificationId,
      alertId,
      channelId,
      status,
      attempts: 1,
      lastAttemptAt: new Date(),
      message: "", // Will be updated later
      createdAt: new Date(),
    });

    return notificationId;
  }

  private async updateNotificationResult(
    notificationId: string,
    result: NotificationResult
  ): Promise<void> {
    const updateData: any = {
      status: result.success ? "sent" : "failed",
      response: result.response ? JSON.stringify(result.response) : null,
      errorMessage: result.error,
    };

    if (result.success) {
      updateData.sentAt = new Date();
    }

    await this.db
      .update(alertNotifications)
      .set(updateData)
      .where(eq(alertNotifications.id, notificationId));
  }

  private async getEscalationPolicy(_alert: SelectAlertInstance) {
    // TODO: Implement escalation policy lookup
    // This would typically be based on alert severity, source, or other criteria
    return null;
  }

  // ==========================================
  // PUBLIC API METHODS
  // ==========================================

  async createNotificationChannel(
    name: string,
    type: string,
    config: Record<string, unknown>,
    createdBy: string,
    options: {
      severityFilter?: string[];
      categoryFilter?: string[];
      tagFilter?: string[];
      isDefault?: boolean;
      rateLimitPerHour?: number;
      messageTemplate?: string;
      titleTemplate?: string;
    } = {}
  ): Promise<string> {
    const channelId = `channel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Validate configuration with provider
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`Unsupported notification type: ${type}`);
    }

    const isValid = await provider.validateConfig(config);
    if (!isValid) {
      throw new Error(`Invalid configuration for ${type} provider`);
    }

    await this.db.insert(notificationChannels).values({
      id: channelId,
      name,
      type,
      config: JSON.stringify(config),
      severityFilter: options.severityFilter ? JSON.stringify(options.severityFilter) : null,
      categoryFilter: options.categoryFilter ? JSON.stringify(options.categoryFilter) : null,
      tagFilter: options.tagFilter ? JSON.stringify(options.tagFilter) : null,
      isEnabled: true,
      isDefault: options.isDefault || false,
      rateLimitPerHour: options.rateLimitPerHour || 100,
      messageTemplate: options.messageTemplate,
      titleTemplate: options.titleTemplate,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy,
    });

    console.info(`Created notification channel: ${channelId}`);
    return channelId;
  }

  async testNotificationChannel(channelId: string): Promise<NotificationResult> {
    const channel = await this.db
      .select()
      .from(notificationChannels)
      .where(eq(notificationChannels.id, channelId))
      .limit(1);

    if (channel.length === 0) {
      throw new Error("Channel not found");
    }

    const provider = this.providers.get(channel[0].type);
    if (!provider) {
      throw new Error(`No provider found for type: ${channel[0].type}`);
    }

    // Create test alert
    const testAlert: SelectAlertInstance = {
      id: "test_alert",
      ruleId: "test_rule",
      status: "firing",
      severity: "info",
      message: "Test notification",
      description: "This is a test notification to verify channel configuration",
      metricValue: 42,
      source: "test",
      environment: "test",
      escalationLevel: 0,
      firstTriggeredAt: new Date(),
      lastTriggeredAt: new Date(),
      sourceId: null,
      threshold: null,
      anomalyScore: null,
      correlationId: null,
      parentAlertId: null,
      lastEscalatedAt: null,
      resolvedAt: null,
      resolvedBy: null,
      resolutionNotes: null,
      additionalData: null,
      labels: null,
    };

    const message = this.buildNotificationMessage(testAlert, channel[0], "alert");
    return await provider.send(channel[0], testAlert, message);
  }

  async getChannelStatistics(channelId: string, hours = 24) {
    const cutoff = Date.now() - hours * 3600000;

    const stats = await this.db
      .select({
        total: count(),
        sent: count(eq(alertNotifications.status, "sent")),
        failed: count(eq(alertNotifications.status, "failed")),
        rateLimited: count(eq(alertNotifications.status, "rate_limited")),
      })
      .from(alertNotifications)
      .where(
        and(
          eq(alertNotifications.channelId, channelId),
          gte(alertNotifications.createdAt, new Date(cutoff))
        )
      );

    return stats[0] || { total: 0, sent: 0, failed: 0, rateLimited: 0 };
  }
}

export default NotificationService;
