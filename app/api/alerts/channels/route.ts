import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db";
import { AlertConfigurationService } from "@/src/lib/alert-configuration";
import { validateRequest } from "@/src/lib/api-auth";
import { handleApiError } from "@/src/lib/api-response";

// ==========================================
// GET /api/alerts/channels - List notification channels
// ==========================================

export async function GET(request: NextRequest) {
  try {
    const _user = await validateRequest(request);
    // validateRequest already throws if not authenticated, so if we reach here, user is authenticated

    // Initialize services at runtime
    const alertConfigService = new AlertConfigurationService(db);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const enabledParam = searchParams.get("enabled");
    const enabled = enabledParam !== null ? enabledParam === "true" : undefined;

    const channelFilters: { type?: string; enabled?: boolean } = {};
    if (type) channelFilters.type = type;
    if (enabled !== undefined) channelFilters.enabled = enabled;

    const channels =
      await alertConfigService.listNotificationChannels(channelFilters);

    // Format channels for client consumption (hide sensitive config data)
    const formattedChannels = channels.map((channel) => {
      const parsedConfig = channel.config ? JSON.parse(channel.config) : {};
      return {
        ...channel,
        config: parsedConfig,
        severityFilter: channel.severityFilter
          ? JSON.parse(channel.severityFilter)
          : null,
        categoryFilter: channel.categoryFilter
          ? JSON.parse(channel.categoryFilter)
          : null,
        tagFilter: channel.tagFilter ? JSON.parse(channel.tagFilter) : null,
        // Hide sensitive configuration details
        configSummary: getConfigSummary(channel.type, parsedConfig),
      };
    });

    return NextResponse.json({
      success: true,
      data: formattedChannels,
      count: formattedChannels.length,
    });
  } catch (error) {
    console.error("Error fetching notification channels:", { error: error });
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

    // Initialize services at runtime
    const alertConfigService = new AlertConfigurationService(db);

    const body = await request.json();

    const channelId = await alertConfigService.createNotificationChannel(
      body,
      user.id
    );

    return NextResponse.json(
      {
        success: true,
        data: { channelId },
        message: "Notification channel created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating notification channel:", { error: error });
    return handleApiError(error);
  }
}

interface NotificationConfig {
  // Email config
  smtpHost?: string;
  fromAddress?: string;
  toAddresses?: string[];

  // Slack/Teams config
  webhookUrl?: string;
  channel?: string;
  username?: string;
  mentionUsers?: string[];
  mentionTeams?: string[];

  // Webhook config
  url?: string;
  method?: string;
  authentication?: Record<string, unknown>;

  // SMS config
  provider?: string;
  fromPhoneNumber?: string;
  toPhoneNumbers?: string[];

  [key: string]: unknown;
}

interface ConfigSummary {
  smtpHost?: string;
  fromAddress?: string;
  recipients?: number;
  hasWebhook?: boolean;
  channel?: string;
  username?: string;
  url?: string | null;
  method?: string;
  hasAuth?: boolean;
  provider?: string;
  fromNumber?: string;
  mentions?: number;
}

// Helper function to get configuration summary without sensitive data
function getConfigSummary(
  type: string,
  config: NotificationConfig
): ConfigSummary {
  switch (type) {
    case "email":
      return {
        smtpHost: config.smtpHost,
        fromAddress: config.fromAddress,
        recipients: config.toAddresses?.length ?? 0,
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
        method: config.method ?? "POST",
        hasAuth: !!config.authentication,
      };

    case "sms":
      return {
        provider: config.provider,
        fromNumber: config.fromPhoneNumber,
        recipients: config.toPhoneNumbers?.length ?? 0,
      };

    case "teams":
      return {
        hasWebhook: !!config.webhookUrl,
        mentions:
          (config.mentionUsers?.length ?? 0) +
          (config.mentionTeams?.length ?? 0),
      };

    default:
      return {};
  }
}
