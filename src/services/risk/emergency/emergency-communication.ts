/**
 * Emergency Communication Manager
 *
 * Handles all emergency communication including notifications, escalations,
 * and stakeholder communications across multiple channels.
 */

import { BrowserCompatibleEventEmitter } from "@/src/lib/browser-compatible-events";
import type {
  CommunicationEntry,
  CommunicationPlan,
  EmergencyContact,
  EmergencySession,
} from "./emergency-types";

/**
 * Communication channel interface
 */
interface Channel {
  type: string;
  send(
    message: string,
    recipient: string,
    urgency: "low" | "medium" | "high" | "critical"
  ): Promise<boolean>;
  isAvailable(): boolean;
}

/**
 * Message template data
 */
interface TemplateData {
  sessionId: string;
  protocolId: string;
  level: string;
  reason: string;
  timestamp: string;
  severity?: number;
  contact?: string;
  [key: string]: any;
}

/**
 * Communication result
 */
interface CommunicationResult {
  success: boolean;
  channel: string;
  recipient: string;
  messageId?: string;
  error?: string;
  timestamp: number;
}

/**
 * Emergency communication manager
 */
export class EmergencyCommunicationManager extends BrowserCompatibleEventEmitter {
  private channels: Map<string, Channel> = new Map();
  private contacts: Map<string, EmergencyContact> = new Map();
  private communicationHistory: CommunicationEntry[] = [];
  private templates: Map<string, string> = new Map();

  private logger = {
    info: (message: string, context?: any) =>
      console.info("[emergency-communication]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[emergency-communication]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error(
        "[emergency-communication]",
        message,
        context || "",
        error || ""
      ),
  };

  constructor() {
    super();
    this.initializeChannels();
    this.initializeTemplates();
  }

  /**
   * Add emergency contact
   */
  addContact(contact: EmergencyContact): void {
    this.contacts.set(contact.id, contact);
    this.logger.info("Emergency contact added", {
      contactId: contact.id,
      name: contact.name,
    });
  }

  /**
   * Remove emergency contact
   */
  removeContact(contactId: string): boolean {
    const removed = this.contacts.delete(contactId);
    if (removed) {
      this.logger.info("Emergency contact removed", { contactId });
    }
    return removed;
  }

  /**
   * Send emergency notification
   */
  async sendEmergencyNotification(
    session: EmergencySession,
    eventType: string,
    communicationPlan: CommunicationPlan,
    context?: Record<string, any>
  ): Promise<CommunicationResult[]> {
    const results: CommunicationResult[] = [];
    const templateData: TemplateData = {
      sessionId: session.id,
      protocolId: session.protocolId,
      level: session.currentLevel,
      reason: session.triggerReason,
      timestamp: new Date().toISOString(),
      ...context,
    };

    this.logger.info("Sending emergency notification", {
      sessionId: session.id,
      eventType,
      channels: communicationPlan.channels,
      stakeholders: communicationPlan.stakeholders,
    });

    // Get message template
    const template =
      communicationPlan.templates[eventType] || this.templates.get(eventType);
    if (!template) {
      this.logger.warn("No template found for event type", { eventType });
      return results;
    }

    const message = this.formatMessage(template, templateData);

    // Send to stakeholders via their preferred channels
    for (const stakeholder of communicationPlan.stakeholders) {
      const contact = this.contacts.get(stakeholder);
      if (!contact) {
        this.logger.warn("Contact not found", { stakeholder });
        continue;
      }

      // Check availability for current time
      if (!this.isContactAvailable(contact)) {
        this.logger.info("Contact not currently available", {
          contactId: contact.id,
          name: contact.name,
        });
        continue;
      }

      // Send via priority channels
      const sortedChannels = contact.channels.sort(
        (a, b) => a.priority - b.priority
      );
      let sent = false;

      for (const contactChannel of sortedChannels) {
        if (!communicationPlan.channels.includes(contactChannel.type)) {
          continue; // Skip channels not enabled for this plan
        }

        const channel = this.channels.get(contactChannel.type);
        if (!channel || !channel.isAvailable()) {
          continue;
        }

        try {
          const success = await channel.send(
            message,
            contactChannel.value,
            this.getUrgencyLevel(session.currentLevel)
          );

          const result: CommunicationResult = {
            success,
            channel: contactChannel.type,
            recipient: contactChannel.value,
            timestamp: Date.now(),
          };

          if (success) {
            result.messageId = this.generateMessageId();
            sent = true;

            // Add to communication log
            const logEntry: CommunicationEntry = {
              timestamp: result.timestamp,
              channel: contactChannel.type,
              message,
              recipient: contact.name,
              status: "sent",
            };

            this.communicationHistory.push(logEntry);
            session.communicationLog.push(logEntry);

            this.logger.info("Notification sent successfully", {
              contactId: contact.id,
              channel: contactChannel.type,
              messageId: result.messageId,
            });
          } else {
            result.error = "Send failed";
            this.logger.warn("Notification send failed", {
              contactId: contact.id,
              channel: contactChannel.type,
            });
          }

          results.push(result);

          if (sent) break; // Stop trying other channels for this contact
        } catch (error) {
          const result: CommunicationResult = {
            success: false,
            channel: contactChannel.type,
            recipient: contactChannel.value,
            error: (error as Error).message,
            timestamp: Date.now(),
          };

          results.push(result);

          this.logger.error("Notification send error", {
            contactId: contact.id,
            channel: contactChannel.type,
            error: (error as Error).message,
          });
        }
      }

      if (!sent) {
        this.logger.warn("Failed to send notification to contact", {
          contactId: contact.id,
        });
      }
    }

    // Emit communication event
    this.emit("notification_sent", {
      sessionId: session.id,
      eventType,
      results,
      timestamp: Date.now(),
    });

    return results;
  }

  /**
   * Send escalation notification
   */
  async sendEscalationNotification(
    session: EmergencySession,
    fromLevel: string,
    toLevel: string,
    escalationContacts: string[],
    reason: string
  ): Promise<CommunicationResult[]> {
    const results: CommunicationResult[] = [];

    const templateData: TemplateData = {
      sessionId: session.id,
      protocolId: session.protocolId,
      level: toLevel,
      reason,
      timestamp: new Date().toISOString(),
      fromLevel,
      toLevel,
    };

    const template =
      this.templates.get("escalated") ||
      "EMERGENCY ESCALATED: Protocol {protocolId} escalated from {fromLevel} to {toLevel}. Immediate attention required.";

    const message = this.formatMessage(template, templateData);

    for (const contactId of escalationContacts) {
      const contact = this.contacts.get(contactId);
      if (!contact) continue;

      // For escalations, use all available channels (urgent)
      for (const contactChannel of contact.channels) {
        if (!contactChannel.verified) continue;

        const channel = this.channels.get(contactChannel.type);
        if (!channel || !channel.isAvailable()) continue;

        try {
          const success = await channel.send(
            message,
            contactChannel.value,
            "critical"
          );

          results.push({
            success,
            channel: contactChannel.type,
            recipient: contactChannel.value,
            messageId: success ? this.generateMessageId() : undefined,
            timestamp: Date.now(),
          });

          if (success) {
            const logEntry: CommunicationEntry = {
              timestamp: Date.now(),
              channel: contactChannel.type,
              message,
              recipient: contact.name,
              status: "sent",
            };

            this.communicationHistory.push(logEntry);
            session.communicationLog.push(logEntry);
          }
        } catch (error) {
          results.push({
            success: false,
            channel: contactChannel.type,
            recipient: contactChannel.value,
            error: (error as Error).message,
            timestamp: Date.now(),
          });
        }
      }
    }

    this.emit("escalation_sent", {
      sessionId: session.id,
      fromLevel,
      toLevel,
      results,
      timestamp: Date.now(),
    });

    return results;
  }

  /**
   * Check if contact is available based on timezone and availability windows
   */
  private isContactAvailable(contact: EmergencyContact): boolean {
    if (!contact.availability || contact.availability.length === 0) {
      return true; // Assume available if no restrictions
    }

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

    for (const window of contact.availability) {
      if (window.dayOfWeek === dayOfWeek) {
        // Simple time check (in production, would handle timezone conversion)
        const currentTime = now.getHours() * 100 + now.getMinutes();
        const startTime = parseInt(window.startTime.replace(":", ""));
        const endTime = parseInt(window.endTime.replace(":", ""));

        if (currentTime >= startTime && currentTime <= endTime) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get urgency level based on emergency level
   */
  private getUrgencyLevel(
    level: string
  ): "low" | "medium" | "high" | "critical" {
    // In production, this would map emergency levels to urgency
    if (level.includes("level_1")) return "medium";
    if (level.includes("level_2")) return "high";
    if (level.includes("level_3") || level.includes("containment"))
      return "critical";
    return "medium";
  }

  /**
   * Format message template with data
   */
  private formatMessage(template: string, data: TemplateData): string {
    let message = template;

    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{${key}}`;
      message = message.replace(new RegExp(placeholder, "g"), String(value));
    }

    return message;
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Initialize communication channels
   */
  private initializeChannels(): void {
    // Slack channel implementation
    this.channels.set("slack", {
      type: "slack",
      async send(
        message: string,
        recipient: string,
        urgency: string
      ): Promise<boolean> {
        // Mock implementation - replace with real Slack API calls
        console.log(
          `[SLACK] ${urgency.toUpperCase()}: ${message} -> ${recipient}`
        );
        return true;
      },
      isAvailable(): boolean {
        return true; // Check Slack API availability
      },
    });

    // Email channel implementation
    this.channels.set("email", {
      type: "email",
      async send(
        message: string,
        recipient: string,
        urgency: string
      ): Promise<boolean> {
        // Mock implementation - replace with real email service
        console.log(
          `[EMAIL] ${urgency.toUpperCase()}: ${message} -> ${recipient}`
        );
        return true;
      },
      isAvailable(): boolean {
        return true; // Check email service availability
      },
    });

    // SMS channel implementation
    this.channels.set("sms", {
      type: "sms",
      async send(
        message: string,
        recipient: string,
        urgency: string
      ): Promise<boolean> {
        // Mock implementation - replace with real SMS service
        console.log(
          `[SMS] ${urgency.toUpperCase()}: ${message} -> ${recipient}`
        );
        return true;
      },
      isAvailable(): boolean {
        return true; // Check SMS service availability
      },
    });

    // Phone channel implementation
    this.channels.set("phone", {
      type: "phone",
      async send(
        message: string,
        recipient: string,
        urgency: string
      ): Promise<boolean> {
        // Mock implementation - replace with real voice call service
        console.log(
          `[PHONE] ${urgency.toUpperCase()}: ${message} -> ${recipient}`
        );
        return urgency === "critical"; // Only make calls for critical alerts
      },
      isAvailable(): boolean {
        return true; // Check voice service availability
      },
    });

    this.logger.info("Communication channels initialized", {
      channels: Array.from(this.channels.keys()),
    });
  }

  /**
   * Initialize message templates
   */
  private initializeTemplates(): void {
    this.templates.set(
      "activated",
      "🚨 EMERGENCY PROTOCOL ACTIVATED\n" +
        "Protocol: {protocolId}\n" +
        "Level: {level}\n" +
        "Reason: {reason}\n" +
        "Session: {sessionId}\n" +
        "Time: {timestamp}"
    );

    this.templates.set(
      "escalated",
      "⚠️ EMERGENCY ESCALATED\n" +
        "Protocol: {protocolId}\n" +
        "From: {fromLevel} → To: {toLevel}\n" +
        "Reason: {reason}\n" +
        "Session: {sessionId}\n" +
        "IMMEDIATE ATTENTION REQUIRED"
    );

    this.templates.set(
      "resolved",
      "✅ EMERGENCY RESOLVED\n" +
        "Protocol: {protocolId}\n" +
        "Level: {level}\n" +
        "Session: {sessionId}\n" +
        "Resolution Time: {timestamp}\n" +
        "Normal operations resumed"
    );

    this.templates.set(
      "test",
      "🧪 EMERGENCY PROTOCOL TEST\n" +
        "Protocol: {protocolId}\n" +
        "This is a scheduled test of emergency procedures.\n" +
        "No action required."
    );

    this.logger.info("Message templates initialized", {
      templates: Array.from(this.templates.keys()),
    });
  }

  /**
   * Add custom message template
   */
  addTemplate(eventType: string, template: string): void {
    this.templates.set(eventType, template);
    this.logger.info("Template added", { eventType });
  }

  /**
   * Get communication history
   */
  getCommunicationHistory(limit?: number): CommunicationEntry[] {
    return limit
      ? this.communicationHistory.slice(-limit)
      : [...this.communicationHistory];
  }

  /**
   * Get communication statistics
   */
  getStatistics(): {
    totalCommunications: number;
    byChannel: Record<string, number>;
    byStatus: Record<string, number>;
    last24Hours: number;
  } {
    const last24Hours = Date.now() - 24 * 60 * 60 * 1000;

    const byChannel: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let recent = 0;

    for (const entry of this.communicationHistory) {
      // Count by channel
      byChannel[entry.channel] = (byChannel[entry.channel] || 0) + 1;

      // Count by status
      byStatus[entry.status] = (byStatus[entry.status] || 0) + 1;

      // Count recent
      if (entry.timestamp > last24Hours) {
        recent++;
      }
    }

    return {
      totalCommunications: this.communicationHistory.length,
      byChannel,
      byStatus,
      last24Hours: recent,
    };
  }

  /**
   * Test communication channels
   */
  async testChannels(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [channelType, channel] of this.channels) {
      try {
        // Send test message
        const testMessage = "Emergency communication system test";
        const success = await channel.send(
          testMessage,
          "test@example.com",
          "low"
        );
        results[channelType] = success && channel.isAvailable();
      } catch (error) {
        results[channelType] = false;
        this.logger.error("Channel test failed", {
          channel: channelType,
          error: (error as Error).message,
        });
      }
    }

    this.logger.info("Channel test completed", { results });
    return results;
  }

  /**
   * Cleanup old communication history
   */
  cleanupHistory(maxAge: number = 30 * 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAge;
    const initialLength = this.communicationHistory.length;

    this.communicationHistory = this.communicationHistory.filter(
      (entry) => entry.timestamp > cutoff
    );

    const removed = initialLength - this.communicationHistory.length;

    if (removed > 0) {
      this.logger.info("Communication history cleaned up", {
        removedEntries: removed,
        remainingEntries: this.communicationHistory.length,
      });
    }

    return removed;
  }

  /**
   * Shutdown communication manager
   */
  async shutdown(): Promise<void> {
    this.logger.info("Shutting down communication manager");

    // Clear channels and contacts
    this.channels.clear();
    this.contacts.clear();
    this.templates.clear();

    this.removeAllListeners();
  }
}
