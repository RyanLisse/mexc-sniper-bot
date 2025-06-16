import { NextRequest, NextResponse } from "next/server";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { db } from "@/src/db";
import { AlertConfigurationService } from "@/src/lib/alert-configuration";
import { NotificationService } from "@/src/services/notification-providers";
import { validateRequest } from "@/src/lib/api-auth";
import { handleApiError } from "@/src/lib/api-response";

const alertConfigService = new AlertConfigurationService(db);
const notificationService = new NotificationService(db);

// ==========================================
// POST /api/alerts/deploy/built-in - Deploy built-in alert rules and channels
// ==========================================
export async function POST(request: NextRequest) {
  try {
    const user = await validateRequest(request);
    // validateRequest already throws if not authenticated, so if we reach here, user is authenticated

    console.log("Deploying built-in alert rules and notification channels...");

    // Deploy built-in alert rules
    const deployedRules = await alertConfigService.deployBuiltInRules(user.id);

    // Deploy example notification channels
    const deployedChannels = await deployExampleNotificationChannels(user.id);

    return NextResponse.json({
      success: true,
      message: "Built-in alerting configuration deployed successfully",
      data: {
        rulesDeployed: deployedRules.length,
        channelsDeployed: deployedChannels.length,
        deployedRules,
        deployedChannels,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Error deploying built-in alerting configuration:", error);
    return handleApiError(error);
  }
}

async function deployExampleNotificationChannels(createdBy: string): Promise<string[]> {
  const deployedChannels: string[] = [];

  // Example Email Channel for Critical Alerts
  try {
    const criticalEmailChannel = {
      name: "Critical Alerts Email",
      type: "email" as const,
      config: {
        smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
        smtpPort: parseInt(process.env.SMTP_PORT || "587"),
        smtpUser: process.env.SMTP_USER || "alerts@example.com",
        smtpPassword: process.env.SMTP_PASSWORD || "password",
        smtpSecure: false,
        fromAddress: process.env.ALERT_FROM_EMAIL || "alerts@mexc-sniper.com",
        fromName: "MEXC Sniper Alert System",
        toAddresses: [process.env.ADMIN_EMAIL || "admin@example.com"],
      },
      severityFilter: ["critical" as const],
      rateLimitPerHour: 20,
      titleTemplate: "🚨 CRITICAL: {{alert.message}}",
      messageTemplate: "URGENT ACTION REQUIRED\n\n{{alert.description}}\n\nSource: {{alert.source}}\nTriggered: {{timestamp}}",
    };

    const emailChannelId = await alertConfigService.createNotificationChannel(
      criticalEmailChannel, 
      createdBy
    );
    deployedChannels.push(emailChannelId);
    console.log("Deployed critical email channel");
  } catch (error) {
    console.warn("Failed to deploy critical email channel:", error);
  }

  // Example Slack Channel for General Alerts
  if (process.env.SLACK_WEBHOOK_URL) {
    try {
      const slackChannel = {
        name: "General Slack Alerts",
        type: "slack" as const,
        config: {
          webhookUrl: process.env.SLACK_WEBHOOK_URL,
          channel: "#alerts",
          username: "MEXC Sniper Bot",
          iconEmoji: ":warning:",
        },
        severityFilter: ["critical" as const, "high" as const, "medium" as const],
        rateLimitPerHour: 100,
        titleTemplate: "{{alert.severity}} Alert: {{alert.message}}",
      };

      const slackChannelId = await alertConfigService.createNotificationChannel(
        slackChannel,
        createdBy
      );
      deployedChannels.push(slackChannelId);
      console.log("Deployed Slack channel");
    } catch (error) {
      console.warn("Failed to deploy Slack channel:", error);
    }
  }

  // Example Webhook Channel for External Monitoring
  if (process.env.MONITORING_WEBHOOK_URL) {
    try {
      const webhookChannel = {
        name: "External Monitoring Webhook",
        type: "webhook" as const,
        config: {
          url: process.env.MONITORING_WEBHOOK_URL,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Source": "mexc-sniper-bot",
          },
          authentication: process.env.MONITORING_WEBHOOK_TOKEN ? {
            type: "bearer",
            token: process.env.MONITORING_WEBHOOK_TOKEN,
          } : undefined,
          retryAttempts: 3,
          retryDelay: 1000,
          timeout: 10000,
        },
        rateLimitPerHour: 1000,
      };

      const webhookChannelId = await alertConfigService.createNotificationChannel(
        webhookChannel,
        createdBy
      );
      deployedChannels.push(webhookChannelId);
      console.log("Deployed webhook channel");
    } catch (error) {
      console.warn("Failed to deploy webhook channel:", error);
    }
  }

  // Example SMS Channel for Critical Alerts (if Twilio credentials are available)
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.ADMIN_PHONE) {
    try {
      const smsChannel = {
        name: "Critical SMS Alerts",
        type: "sms" as const,
        config: {
          provider: "twilio",
          accountSid: process.env.TWILIO_ACCOUNT_SID,
          authToken: process.env.TWILIO_AUTH_TOKEN,
          fromPhoneNumber: process.env.TWILIO_PHONE_NUMBER || "+1234567890",
          toPhoneNumbers: [process.env.ADMIN_PHONE],
          maxMessageLength: 160,
        },
        severityFilter: ["critical" as const],
        rateLimitPerHour: 5,
        titleTemplate: "URGENT: {{alert.message}}",
      };

      const smsChannelId = await alertConfigService.createNotificationChannel(
        smsChannel,
        createdBy
      );
      deployedChannels.push(smsChannelId);
      console.log("Deployed SMS channel");
    } catch (error) {
      console.warn("Failed to deploy SMS channel:", error);
    }
  }

  return deployedChannels;
}