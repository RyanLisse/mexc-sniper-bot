import { NextRequest, NextResponse } from "next/server";
import { createLogger } from '../../../../src/lib/structured-logger';
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { db } from "../../../../src/db";
import { NotificationService } from "../../../../src/services/notification-providers";
import { AlertConfigurationService } from "../../../../src/lib/alert-configuration";
import { validateRequest } from "../../../../src/lib/api-auth";
import { handleApiError } from "../../../../src/lib/api-response";
import { z } from "zod";

const notificationService = new NotificationService(db);
const alertConfigService = new AlertConfigurationService(db);

// ==========================================
// GET /api/alerts/channels - List notification channels
// ==========================================
const logger = createLogger('route');

export async function GET(request: NextRequest) {
  try {
    const user = await validateRequest(request);
    // validateRequest already throws if not authenticated, so if we reach here, user is authenticated

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || undefined;
    const enabled = searchParams.get("enabled") !== null ? searchParams.get("enabled") === "true" : undefined;

    const channels = await alertConfigService.listNotificationChannels({
      type,
      enabled,
    });

    // Format channels for client consumption (hide sensitive config data)
    const formattedChannels = channels.map(channel => ({
      ...channel,
      config: JSON.parse(channel.config),
      severityFilter: channel.severityFilter ? JSON.parse(channel.severityFilter) : null,
      categoryFilter: channel.categoryFilter ? JSON.parse(channel.categoryFilter) : null,
      tagFilter: channel.tagFilter ? JSON.parse(channel.tagFilter) : null,
      // Hide sensitive configuration details
      configSummary: getConfigSummary(channel.type, JSON.parse(channel.config)),
    }));

    return NextResponse.json({
      success: true,
      data: formattedChannels,
      count: formattedChannels.length,
    });
  } catch (error) {
    logger.error("Error fetching notification channels:", { error: error });
    return handleApiError(error);
  }
}

// ==========================================
// POST /api/alerts/channels - Create notification channel
// ==========================================
export async function POST(request: NextRequest) {
  try {
    const user = await validateRequest(request);
    // validateRequest already throws if not authenticated, so if we reach here, user is authenticated

    const body = await request.json();
    
    const channelId = await alertConfigService.createNotificationChannel(body, user.id);

    return NextResponse.json({
      success: true,
      data: { channelId },
      message: "Notification channel created successfully",
    }, { status: 201 });
  } catch (error) {
    logger.error("Error creating notification channel:", { error: error });
    return handleApiError(error);
  }
}

// Helper function to get configuration summary without sensitive data
function getConfigSummary(type: string, config: any): any {
  switch (type) {
    case "email":
      return {
        smtpHost: config.smtpHost,
        fromAddress: config.fromAddress,
        recipients: config.toAddresses?.length || 0,
      };
    
    case "slack":
      return {
        hasWebhook: !!config.webhookUrl,
        channel: config.channel,
        username: config.username,
      };
    
    case "webhook":
      return {
        url: config.url ? `${config.url.split("/")[2]}...` : null,
        method: config.method || "POST",
        hasAuth: !!config.authentication,
      };
    
    case "sms":
      return {
        provider: config.provider,
        fromNumber: config.fromPhoneNumber,
        recipients: config.toPhoneNumbers?.length || 0,
      };
    
    case "teams":
      return {
        hasWebhook: !!config.webhookUrl,
        mentions: (config.mentionUsers?.length || 0) + (config.mentionTeams?.length || 0),
      };
    
    default:
      return {};
  }
}