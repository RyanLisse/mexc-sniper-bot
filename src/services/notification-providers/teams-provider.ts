import type { SelectAlertInstance, SelectNotificationChannel } from "../../db/schemas/alerts";
import type { NotificationMessage, NotificationProvider, NotificationResult } from "./index";

interface TeamsConfig {
  webhookUrl: string;
  mentionUsers?: string[];
  mentionTeams?: string[];
  themeColor?: string;
}

interface TeamsCard {
  "@type": string;
  "@context": string;
  themeColor: string;
  summary: string;
  sections: TeamsSection[];
  potentialAction?: TeamsAction[];
}

interface TeamsSection {
  activityTitle?: string;
  activitySubtitle?: string;
  activityImage?: string;
  facts?: TeamsFact[];
  markdown?: boolean;
  text?: string;
}

interface TeamsFact {
  name: string;
  value: string;
}

interface TeamsAction {
  "@type": string;
  name: string;
  targets: Array<{
    os: string;
    uri: string;
  }>;
}

export class TeamsProvider implements NotificationProvider {
  getProviderType(): string {
    return "teams";
  }

  async validateConfig(config: Record<string, unknown>): Promise<boolean> {
    // Type guard for TeamsConfig
    if (!config || typeof config !== "object") {
      return false;
    }

    const webhookUrl = config.webhookUrl;
    if (!webhookUrl || typeof webhookUrl !== "string") {
      return false;
    }

    // Validate webhook URL format for Microsoft Teams
    const webhookRegex =
      /^https:\/\/[a-zA-Z0-9-]+\.webhook\.office\.com\/webhookb2\/[a-f0-9-]+@[a-f0-9-]+\/IncomingWebhook\/[a-f0-9]+\/[a-f0-9-]+$/;
    return webhookRegex.test(webhookUrl);
  }

  async send(
    channel: SelectNotificationChannel,
    alert: SelectAlertInstance,
    message: NotificationMessage
  ): Promise<NotificationResult> {
    try {
      const config = JSON.parse(channel.config) as TeamsConfig;

      const card = this.buildTeamsCard(config, alert, message);

      // For production, you would make an actual HTTP request to Teams
      // For now, we'll simulate the Teams webhook call

      console.log("Sending Teams notification:", card);

      // In production, you would:
      // const response = await fetch(config.webhookUrl, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(card)
      // });
      //
      // if (!response.ok) {
      //   throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      // }

      return {
        success: true,
        messageId: `teams_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        response: { simulated: true },
      };
    } catch (error) {
      console.error("Teams notification failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown Teams error",
      };
    }
  }

  private buildTeamsCard(
    config: TeamsConfig,
    alert: SelectAlertInstance,
    message: NotificationMessage
  ): TeamsCard {
    const themeColor = config.themeColor || this.getSeverityColor(alert.severity);
    const icon = this.getSeverityIcon(alert.severity);

    // Build mentions
    let mentionsText = "";
    if (config.mentionUsers?.length) {
      mentionsText += config.mentionUsers.map((user) => `<at>${user}</at>`).join(" ");
    }
    if (config.mentionTeams?.length) {
      mentionsText += config.mentionTeams.map((team) => `<at>${team}</at>`).join(" ");
    }

    const sections: TeamsSection[] = [
      {
        activityTitle: `${icon} ${message.title}`,
        activitySubtitle: alert.source,
        facts: [
          { name: "Alert ID", value: alert.id },
          { name: "Severity", value: alert.severity.toUpperCase() },
          { name: "Source", value: alert.source },
          { name: "Metric Value", value: alert.metricValue?.toString() || "N/A" },
        ],
      },
    ];

    // Add additional facts if available
    const additionalFacts: TeamsFact[] = [];

    if (alert.threshold) {
      additionalFacts.push({ name: "Threshold", value: alert.threshold.toString() });
    }

    if (alert.anomalyScore) {
      additionalFacts.push({ name: "Anomaly Score", value: alert.anomalyScore.toFixed(2) });
    }

    if (alert.environment) {
      additionalFacts.push({ name: "Environment", value: alert.environment });
    }

    if (additionalFacts.length > 0) {
      sections.push({
        facts: additionalFacts,
      });
    }

    // Add description if available
    if (alert.description) {
      sections.push({
        text: `**Description:** ${alert.description}`,
        markdown: true,
      });
    }

    // Add timestamp
    sections.push({
      text: `**Triggered:** ${new Date(alert.firstTriggeredAt).toLocaleString()}`,
      markdown: true,
    });

    // Add mentions if any
    if (mentionsText) {
      sections.push({
        text: mentionsText,
        markdown: true,
      });
    }

    const card: TeamsCard = {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      themeColor,
      summary: message.title,
      sections,
    };

    // Add action buttons if alert URL is available
    if (message.alertUrl) {
      card.potentialAction = [
        {
          "@type": "OpenUri",
          name: "View Alert Details",
          targets: [
            {
              os: "default",
              uri: message.alertUrl,
            },
          ],
        },
      ];
    }

    return card;
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case "critical":
        return "#DC2626";
      case "high":
        return "#EA580C";
      case "medium":
        return "#D97706";
      case "low":
        return "#2563EB";
      case "info":
        return "#6B7280";
      default:
        return "#6B7280";
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
}
