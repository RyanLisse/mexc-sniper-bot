/**
 * Communication Module
 *
 * Handles emergency notifications, escalation communications, and messaging.
 * Extracted from advanced-emergency-coordinator.ts for better modularity.
 */

import type {
  EmergencyProtocol,
  EmergencySession,
} from "./protocol-management-module";

export interface CommunicationConfig {
  notificationChannels: string[];
  escalationDelayMs: number;
  maxRetryAttempts: number;
}

export interface NotificationResult {
  success: boolean;
  channel: string;
  recipient: string;
  messageId?: string;
  error?: string;
  timestamp: string;
}

export interface EscalationRule {
  levelSeverity: number;
  delayMs: number;
  recipients: string[];
  channels: string[];
  template: string;
}

export class CommunicationModule {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[communication-module]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[communication-module]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error(
        "[communication-module]",
        message,
        context || "",
        error || ""
      ),
    debug: (message: string, context?: any) =>
      console.debug("[communication-module]", message, context || ""),
  };

  private config: CommunicationConfig;
  private escalationRules: Map<string, EscalationRule[]> = new Map();
  private communicationHistory: Array<{
    sessionId: string;
    timestamp: string;
    type: string;
    recipients: string[];
    success: boolean;
  }> = [];

  constructor(config: CommunicationConfig) {
    this.config = config;
    this.initializeEscalationRules();
  }

  /**
   * Send emergency notifications
   */
  async sendEmergencyNotifications(
    session: EmergencySession,
    protocol: EmergencyProtocol,
    type: "activated" | "escalated" | "resolved",
    context?: Record<string, any>
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    try {
      const message = this.buildNotificationMessage(
        session,
        protocol,
        type,
        context
      );
      const recipients = this.getRecipientsForType(protocol, type);

      this.logger.info("Sending emergency notifications", {
        sessionId: session.id,
        type,
        recipientCount: recipients.length,
        channels: this.config.notificationChannels,
      });

      // Send to each channel
      for (const channel of this.config.notificationChannels) {
        for (const recipient of recipients) {
          const result = await this.sendNotification(
            channel,
            recipient,
            message,
            session.id
          );
          results.push(result);
        }
      }

      // Log communication history
      this.communicationHistory.push({
        sessionId: session.id,
        timestamp: new Date().toISOString(),
        type,
        recipients,
        success: results.every((r) => r.success),
      });

      const successCount = results.filter((r) => r.success).length;
      this.logger.info("Emergency notifications sent", {
        sessionId: session.id,
        type,
        total: results.length,
        successful: successCount,
        failed: results.length - successCount,
      });

      return results;
    } catch (error) {
      this.logger.error("Failed to send emergency notifications", {
        sessionId: session.id,
        type,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return results;
    }
  }

  /**
   * Send escalation notifications
   */
  async sendEscalationNotifications(
    session: EmergencySession,
    protocol: EmergencyProtocol,
    previousLevel: string,
    newLevel: string,
    reason: string
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    try {
      const escalationRules = this.escalationRules.get(protocol.id) || [];
      const newLevelInfo = protocol.levels.find((l) => l.id === newLevel);

      if (!newLevelInfo) {
        throw new Error(`Level not found: ${newLevel}`);
      }

      const applicableRules = escalationRules.filter(
        (rule) => rule.levelSeverity <= newLevelInfo.severity
      );

      for (const rule of applicableRules) {
        const message = this.buildEscalationMessage(
          session,
          protocol,
          previousLevel,
          newLevel,
          reason,
          rule.template
        );

        for (const channel of rule.channels) {
          for (const recipient of rule.recipients) {
            const result = await this.sendNotification(
              channel,
              recipient,
              message,
              session.id
            );
            results.push(result);
          }
        }
      }

      this.logger.info("Escalation notifications sent", {
        sessionId: session.id,
        previousLevel,
        newLevel,
        rulesApplied: applicableRules.length,
        notificationsSent: results.length,
      });

      return results;
    } catch (error) {
      this.logger.error("Failed to send escalation notifications", {
        sessionId: session.id,
        previousLevel,
        newLevel,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return results;
    }
  }

  /**
   * Send individual notification
   */
  private async sendNotification(
    channel: string,
    recipient: string,
    message: string,
    sessionId: string
  ): Promise<NotificationResult> {
    const timestamp = new Date().toISOString();

    try {
      // Simulate notification sending based on channel
      const result = await this.executeNotification(
        channel,
        recipient,
        message
      );

      this.logger.debug("Notification sent", {
        channel,
        recipient,
        sessionId,
        success: result.success,
      });

      return {
        success: result.success,
        channel,
        recipient,
        messageId: result.messageId,
        error: result.error,
        timestamp,
      };
    } catch (error) {
      this.logger.error("Notification failed", {
        channel,
        recipient,
        sessionId,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return {
        success: false,
        channel,
        recipient,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp,
      };
    }
  }

  /**
   * Execute notification based on channel type
   */
  private async executeNotification(
    channel: string,
    recipient: string,
    message: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Simulate different notification channels
    switch (channel.toLowerCase()) {
      case "console":
        console.log(`[EMERGENCY NOTIFICATION] To: ${recipient}\n${message}`);
        return { success: true, messageId: `console_${Date.now()}` };

      case "webhook":
        // Simulate webhook call
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { success: true, messageId: `webhook_${Date.now()}` };

      case "email":
        // Simulate email sending
        await new Promise((resolve) => setTimeout(resolve, 200));
        return { success: true, messageId: `email_${Date.now()}` };

      case "sms":
        // Simulate SMS sending
        await new Promise((resolve) => setTimeout(resolve, 150));
        return { success: true, messageId: `sms_${Date.now()}` };

      case "slack":
        // Simulate Slack notification
        await new Promise((resolve) => setTimeout(resolve, 120));
        return { success: true, messageId: `slack_${Date.now()}` };

      default:
        return { success: false, error: `Unknown channel: ${channel}` };
    }
  }

  /**
   * Build notification message
   */
  private buildNotificationMessage(
    session: EmergencySession,
    protocol: EmergencyProtocol,
    type: "activated" | "escalated" | "resolved",
    context?: Record<string, any>
  ): string {
    const timestamp = new Date().toISOString();

    switch (type) {
      case "activated":
        return `🚨 EMERGENCY ACTIVATED 🚨

Session ID: ${session.id}
Protocol: ${protocol.name}
Level: ${session.currentLevel}
Triggered by: ${session.triggeredBy}
Reason: ${session.reason}
Time: ${timestamp}

${context ? `Additional Context:\n${JSON.stringify(context, null, 2)}` : ""}

This is an automated emergency notification.`;

      case "escalated":
        return `⚠️ EMERGENCY ESCALATED ⚠️

Session ID: ${session.id}
Protocol: ${protocol.name}
New Level: ${session.currentLevel}
Time: ${timestamp}

${context ? `Escalation Details:\n${JSON.stringify(context, null, 2)}` : ""}

Immediate attention required.`;

      case "resolved":
        return `✅ EMERGENCY RESOLVED ✅

Session ID: ${session.id}
Protocol: ${protocol.name}
Resolution Method: ${session.resolution?.method || "Unknown"}
Verified by: ${session.resolution?.verifiedBy || "Unknown"}
Time: ${timestamp}

${session.resolution?.notes ? `Notes: ${session.resolution.notes}` : ""}

Emergency situation has been resolved.`;

      default:
        return `Emergency notification for session ${session.id}`;
    }
  }

  /**
   * Build escalation message
   */
  private buildEscalationMessage(
    session: EmergencySession,
    protocol: EmergencyProtocol,
    previousLevel: string,
    newLevel: string,
    reason: string,
    template: string
  ): string {
    return template
      .replace("{session_id}", session.id)
      .replace("{protocol_name}", protocol.name)
      .replace("{previous_level}", previousLevel)
      .replace("{new_level}", newLevel)
      .replace("{reason}", reason)
      .replace("{timestamp}", new Date().toISOString());
  }

  /**
   * Get recipients for notification type
   */
  private getRecipientsForType(
    protocol: EmergencyProtocol,
    type: "activated" | "escalated" | "resolved"
  ): string[] {
    switch (type) {
      case "activated":
        return protocol.communicationPlan.internal;
      case "escalated":
        return [
          ...protocol.communicationPlan.internal,
          ...protocol.communicationPlan.escalation,
        ];
      case "resolved":
        return [
          ...protocol.communicationPlan.internal,
          ...protocol.communicationPlan.external,
        ];
      default:
        return protocol.communicationPlan.internal;
    }
  }

  /**
   * Initialize escalation rules
   */
  private initializeEscalationRules(): void {
    // Critical System Failure escalation rules
    this.escalationRules.set("critical_system_failure", [
      {
        levelSeverity: 3,
        delayMs: 0, // Immediate
        recipients: ["ops_team", "engineering"],
        channels: ["console", "webhook"],
        template:
          "🚨 CRITICAL: Emergency escalated to {new_level} for session {session_id}. Reason: {reason}. Time: {timestamp}",
      },
      {
        levelSeverity: 6,
        delayMs: 300000, // 5 minutes
        recipients: ["management", "cto"],
        channels: ["email", "sms"],
        template:
          "🚨 URGENT: Critical system failure escalated to {new_level}. Session: {session_id}. Immediate intervention required. Time: {timestamp}",
      },
    ]);

    // Market Disruption escalation rules
    this.escalationRules.set("market_disruption", [
      {
        levelSeverity: 2,
        delayMs: 0,
        recipients: ["trading_team", "risk_management"],
        channels: ["console", "slack"],
        template:
          "⚠️ Market disruption escalated to {new_level}. Session: {session_id}. Reason: {reason}. Time: {timestamp}",
      },
    ]);

    this.logger.info("Escalation rules initialized", {
      rulesCount: Array.from(this.escalationRules.values()).reduce(
        (sum, rules) => sum + rules.length,
        0
      ),
    });
  }

  /**
   * Test communication systems
   */
  async testCommunicationSystems(): Promise<{
    success: boolean;
    channelResults: Record<string, boolean>;
    errors: string[];
  }> {
    const channelResults: Record<string, boolean> = {};
    const errors: string[] = [];

    for (const channel of this.config.notificationChannels) {
      try {
        const result = await this.executeNotification(
          channel,
          "test_recipient",
          "Emergency communication system test"
        );
        channelResults[channel] = result.success;

        if (!result.success && result.error) {
          errors.push(`${channel}: ${result.error}`);
        }
      } catch (error) {
        channelResults[channel] = false;
        errors.push(
          `${channel}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    const allSuccessful = Object.values(channelResults).every(
      (success) => success
    );

    this.logger.info("Communication systems test completed", {
      success: allSuccessful,
      channelResults,
      errorsFound: errors.length,
    });

    return {
      success: allSuccessful,
      channelResults,
      errors,
    };
  }

  /**
   * Get communication statistics
   */
  getCommunicationStatistics(): {
    totalNotifications: number;
    notificationsByType: Record<string, number>;
    notificationsByChannel: Record<string, number>;
    successRate: number;
  } {
    const notificationsByType = this.communicationHistory.reduce(
      (acc, comm) => {
        acc[comm.type] = (acc[comm.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const successfulNotifications = this.communicationHistory.filter(
      (comm) => comm.success
    ).length;
    const successRate =
      this.communicationHistory.length > 0
        ? successfulNotifications / this.communicationHistory.length
        : 0;

    // Simulate channel statistics
    const notificationsByChannel = this.config.notificationChannels.reduce(
      (acc, channel) => {
        acc[channel] = Math.floor(Math.random() * 10); // Simulated data
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalNotifications: this.communicationHistory.length,
      notificationsByType,
      notificationsByChannel,
      successRate,
    };
  }

  /**
   * Clean old communication history
   */
  cleanOldCommunications(maxAge: number): number {
    const cutoffTime = Date.now() - maxAge;
    const initialCount = this.communicationHistory.length;

    this.communicationHistory = this.communicationHistory.filter((comm) => {
      const commTime = new Date(comm.timestamp).getTime();
      return commTime > cutoffTime;
    });

    const removedCount = initialCount - this.communicationHistory.length;

    if (removedCount > 0) {
      this.logger.info("Old communications cleaned from history", {
        removedCount,
        remainingCount: this.communicationHistory.length,
      });
    }

    return removedCount;
  }
}
