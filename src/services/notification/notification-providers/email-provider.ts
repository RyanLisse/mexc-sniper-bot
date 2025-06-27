import type { SelectAlertInstance, SelectNotificationChannel } from "@/src/db/schemas/alerts";
import type { NotificationMessage, NotificationProvider, NotificationResult } from "./index";

interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  smtpSecure?: boolean;
  fromAddress: string;
  fromName?: string;
  toAddresses: string[];
  ccAddresses?: string[];
  bccAddresses?: string[];
}

export class EmailProvider implements NotificationProvider {
  private _logger: any;
  private get logger(): {
    info: (message: string, context?: any) => void;
    warn: (message: string, context?: any) => void;
    error: (message: string, context?: any, error?: Error) => void;
    debug: (message: string, context?: any) => void;
  } {
    if (!this._logger) {
      try {
        this._logger = {
          info: (message: string, context?: any) =>
            console.info("[email-provider]", message, context || ""),
          warn: (message: string, context?: any) =>
            console.warn("[email-provider]", message, context || ""),
          error: (message: string, context?: any, error?: Error) =>
            console.error("[email-provider]", message, context || "", error || ""),
          debug: (message: string, context?: any) =>
            console.debug("[email-provider]", message, context || ""),
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
    return "email";
  }

  async validateConfig(config: Record<string, unknown>): Promise<boolean> {
    // Type guard for EmailConfig
    if (!config || typeof config !== "object") {
      return false;
    }

    const required = [
      "smtpHost",
      "smtpPort",
      "smtpUser",
      "smtpPassword",
      "fromAddress",
      "toAddresses",
    ];

    const hasAllRequired = required.every(
      (field) => config[field] !== undefined && config[field] !== ""
    );

    if (!hasAllRequired) {
      return false;
    }

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const fromAddress = config.fromAddress as string;
    const toAddresses = config.toAddresses as string[];

    if (!emailRegex.test(fromAddress)) {
      return false;
    }

    if (!Array.isArray(toAddresses)) {
      return false;
    }

    for (const email of toAddresses) {
      if (typeof email !== "string" || !emailRegex.test(email)) {
        return false;
      }
    }

    return true;
  }

  async send(
    channel: SelectNotificationChannel,
    alert: SelectAlertInstance,
    message: NotificationMessage
  ): Promise<NotificationResult> {
    try {
      const config = JSON.parse(channel.config) as EmailConfig;

      // For production, you would use a real SMTP library like nodemailer
      // For now, we'll simulate the email sending

      const emailData = {
        from: `${config.fromName || "MEXC Alert System"} <${config.fromAddress}>`,
        to: config.toAddresses.join(", "),
        cc: config.ccAddresses?.join(", "),
        bcc: config.bccAddresses?.join(", "),
        subject: message.subject || message.title,
        html: this.formatEmailHTML(message, alert),
        text: this.formatEmailText(message, alert),
      };

      // Simulate email sending (replace with actual SMTP implementation)
      console.info("Sending email:", emailData);

      // In production, you would:
      // const nodemailer = require('nodemailer');
      // const transporter = nodemailer.createTransporter({...});
      // const result = await transporter.sendMail(emailData);

      return {
        success: true,
        messageId: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        response: { simulated: true },
      };
    } catch (error) {
      console.error("Email sending failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown email error",
      };
    }
  }

  private formatEmailHTML(message: NotificationMessage, alert: SelectAlertInstance): string {
    const priorityColor = this.getPriorityColor(message.priority);
    const severityIcon = this.getSeverityIcon(alert.severity);

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>${message.title}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: ${priorityColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .alert-details { background: white; padding: 15px; border-radius: 4px; margin: 15px 0; }
            .metric-value { font-size: 24px; font-weight: bold; color: ${priorityColor}; }
            .timestamp { color: #666; font-size: 14px; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
            .button { display: inline-block; background: ${priorityColor}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${severityIcon} ${message.title}</h1>
            </div>
            <div class="content">
              <div class="alert-details">
                <p><strong>Alert ID:</strong> ${alert.id}</p>
                <p><strong>Source:</strong> ${alert.source}</p>
                <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
                <p><strong>Metric Value:</strong> <span class="metric-value">${alert.metricValue}</span></p>
                ${alert.threshold ? `<p><strong>Threshold:</strong> ${alert.threshold}</p>` : ""}
                ${alert.anomalyScore ? `<p><strong>Anomaly Score:</strong> ${alert.anomalyScore.toFixed(2)}</p>` : ""}
                <p class="timestamp"><strong>Triggered:</strong> ${new Date(alert.firstTriggeredAt).toLocaleString()}</p>
              </div>

              <div class="description">
                ${message.body.replace(/\n/g, "<br>")}
              </div>

              ${message.alertUrl ? `<a href="${message.alertUrl}" class="button">View Alert Details</a>` : ""}
            </div>
            <div class="footer">
              <p>This is an automated alert from the MEXC Sniper Bot AI System.</p>
              <p>If you believe this is a false positive, please review the alert rules or contact your system administrator.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private formatEmailText(message: NotificationMessage, alert: SelectAlertInstance): string {
    return `
${message.title}

Alert Details:
- Alert ID: ${alert.id}
- Source: ${alert.source}
- Severity: ${alert.severity.toUpperCase()}
- Metric Value: ${alert.metricValue}
${alert.threshold ? `- Threshold: ${alert.threshold}` : ""}
${alert.anomalyScore ? `- Anomaly Score: ${alert.anomalyScore.toFixed(2)}` : ""}
- Triggered: ${new Date(alert.firstTriggeredAt).toLocaleString()}

Description:
${message.body}

${message.alertUrl ? `View Details: ${message.alertUrl}` : ""}

---
This is an automated alert from the MEXC Sniper Bot AI System.
    `.trim();
  }

  private getPriorityColor(priority: string): string {
    switch (priority) {
      case "critical":
        return "#dc2626";
      case "high":
        return "#ea580c";
      case "medium":
        return "#d97706";
      case "low":
        return "#2563eb";
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
}
