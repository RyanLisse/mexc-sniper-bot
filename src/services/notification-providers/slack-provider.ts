import type { SelectAlertInstance, SelectNotificationChannel } from "../../db/schemas/alerts";
import type { NotificationMessage, NotificationProvider, NotificationResult } from "./index";

interface SlackConfig {
  webhookUrl: string;
  channel?: string;
  username?: string;
  iconEmoji?: string;
  iconUrl?: string;
  mentionUsers?: string[];
  mentionChannels?: string[];
  threadTs?: string;
}

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
  };
  fields?: Array<{
    type: string;
    text: string;
  }>;
  elements?: Array<{
    type: string;
    text?:
      | string
      | {
          type: string;
          text: string;
        };
    url?: string;
    style?: string;
  }>;
  accessory?: unknown;
}

export class SlackProvider implements NotificationProvider {
  private get logger(): ReturnType<typeof createSafeLogger> {
    if (!this._logger) {
      try {
        this._logger = {
      info: (message: string, context?: any) => console.info('[slack-provider]', message, context || ''),
      warn: (message: string, context?: any) => console.warn('[slack-provider]', message, context || ''),
      error: (message: string, context?: any, error?: Error) => console.error('[slack-provider]', message, context || '', error || ''),
      debug: (message: string, context?: any) => console.debug('[slack-provider]', message, context || ''),
    };
      } catch {
        // Fallback during build time
        this._logger = {
          debug: console.debug.bind(console),
          info: console.info.bind(console),
          warn: console.warn.bind(console),
          error: console.error.bind(console),
        } as any;
      }
    }
    return this._logger;
  }

  getProviderType(): string {
    return "slack";
  }

  async validateConfig(config: Record<string, unknown>): Promise<boolean> {
    // Type guard for SlackConfig
    if (!config || typeof config !== "object") {
      return false;
    }

    const webhookUrl = config.webhookUrl;
    if (!webhookUrl || typeof webhookUrl !== "string") {
      return false;
    }

    // Validate webhook URL format
    const webhookRegex =
      /^https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[a-zA-Z0-9]+$/;
    return webhookRegex.test(webhookUrl);
  }

  async send(
    channel: SelectNotificationChannel,
    alert: SelectAlertInstance,
    message: NotificationMessage
  ): Promise<NotificationResult> {
    try {
      const config = JSON.parse(channel.config) as SlackConfig;

      const payload = this.buildSlackPayload(config, alert, message);

      // For production, you would make an actual HTTP request to Slack
      // For now, we'll simulate the Slack API call

      console.info("Sending Slack notification:", payload);

      // In production, you would:
      // const response = await fetch(config.webhookUrl, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(payload)
      // });

      return {
        success: true,
        messageId: `slack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        response: { simulated: true },
      };
    } catch (error) {
      console.error("Slack notification failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown Slack error",
      };
    }
  }

  private buildSlackPayload(
    config: SlackConfig,
    alert: SelectAlertInstance,
    message: NotificationMessage
  ): Record<string, unknown> {
    const color = this.getSeverityColor(alert.severity);
    const icon = this.getSeverityIcon(alert.severity);

    // Build mentions
    let mentions = "";
    if (config.mentionUsers?.length) {
      mentions += config.mentionUsers.map((user) => `<@${user}>`).join(" ");
    }
    if (config.mentionChannels?.length) {
      mentions += config.mentionChannels.map((ch) => `<#${ch}>`).join(" ");
    }

    const blocks: SlackBlock[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${icon} ${message.title}`,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Alert ID:*\n${alert.id}`,
          },
          {
            type: "mrkdwn",
            text: `*Severity:*\n${alert.severity.toUpperCase()}`,
          },
          {
            type: "mrkdwn",
            text: `*Source:*\n${alert.source}`,
          },
          {
            type: "mrkdwn",
            text: `*Metric Value:*\n${alert.metricValue}`,
          },
        ],
      },
    ];

    // Add threshold and anomaly score if available
    if (alert.threshold || alert.anomalyScore) {
      const additionalFields = [];

      if (alert.threshold) {
        additionalFields.push({
          type: "mrkdwn",
          text: `*Threshold:*\n${alert.threshold}`,
        });
      }

      if (alert.anomalyScore) {
        additionalFields.push({
          type: "mrkdwn",
          text: `*Anomaly Score:*\n${alert.anomalyScore.toFixed(2)}`,
        });
      }

      blocks.push({
        type: "section",
        fields: additionalFields,
      });
    }

    // Add description
    if (alert.description) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Description:*\n${alert.description}`,
        },
      });
    }

    // Add timestamp
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Triggered: <!date^${Math.floor(alert.firstTriggeredAt.getTime() / 1000)}^{date_short_pretty} at {time}|${alert.firstTriggeredAt.toISOString()}>`,
        },
      ],
    });

    // Add action buttons if alert URL is available
    if (message.alertUrl) {
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "View Alert Details",
            },
            url: message.alertUrl,
            style: this.getButtonStyle(alert.severity),
          },
        ],
      });
    }

    const payload: Record<string, unknown> = {
      text: message.title,
      blocks,
      attachments: [
        {
          color,
          fallback: message.title,
        },
      ],
    };

    // Add channel-specific configuration
    if (config.channel) {
      payload.channel = config.channel;
    }

    if (config.username) {
      payload.username = config.username;
    }

    if (config.iconEmoji) {
      payload.icon_emoji = config.iconEmoji;
    } else if (config.iconUrl) {
      payload.icon_url = config.iconUrl;
    }

    if (config.threadTs) {
      payload.thread_ts = config.threadTs;
    }

    // Add mentions to the main text if any
    if (mentions) {
      payload.text = `${mentions}\n${message.title}`;
    }

    return payload;
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case "critical":
        return "#dc2626";
      case "high":
        return "#ea580c";
      case "medium":
        return "#d97706";
      case "low":
        return "#2563eb";
      case "info":
        return "#6b7280";
      default:
        return "#6b7280";
    }
  }

  private getSeverityIcon(severity: string): string {
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
        return "ℹ️";
      default:
        return "⚪";
    }
  }

  private getButtonStyle(severity: string): string {
    switch (severity) {
      case "critical":
      case "high":
        return "danger";
      case "medium":
        return "primary";
      default:
        return "default";
    }
  }
}
