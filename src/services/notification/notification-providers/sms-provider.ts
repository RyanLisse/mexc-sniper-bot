import type {
  SelectAlertInstance,
  SelectNotificationChannel,
} from "@/src/db/schemas/alerts";
import type {
  NotificationMessage,
  NotificationProvider,
  NotificationResult,
} from "./index";

interface SMSConfig {
  provider: "twilio" | "aws_sns" | "nexmo" | "messagebird";
  accountSid?: string; // Twilio
  authToken?: string; // Twilio
  fromPhoneNumber: string;
  toPhoneNumbers: string[];
  region?: string; // AWS SNS
  accessKeyId?: string; // AWS SNS
  secretAccessKey?: string; // AWS SNS
  apiKey?: string; // Nexmo/MessageBird
  apiSecret?: string; // Nexmo/MessageBird
  maxMessageLength?: number;
}

export class SMSProvider implements NotificationProvider {
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
            console.info("[sms-provider]", message, context || ""),
          warn: (message: string, context?: any) =>
            console.warn("[sms-provider]", message, context || ""),
          error: (message: string, context?: any, error?: Error) =>
            console.error(
              "[sms-provider]",
              message,
              context || "",
              error || ""
            ),
          debug: (message: string, context?: any) =>
            console.debug("[sms-provider]", message, context || ""),
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
    return "sms";
  }

  async validateConfig(config: Record<string, unknown>): Promise<boolean> {
    // Type guard for SMSConfig
    if (!config || typeof config !== "object") {
      return false;
    }

    const provider = config.provider;
    const fromPhoneNumber = config.fromPhoneNumber;
    const toPhoneNumbers = config.toPhoneNumbers;

    if (
      !provider ||
      typeof provider !== "string" ||
      !fromPhoneNumber ||
      typeof fromPhoneNumber !== "string" ||
      !Array.isArray(toPhoneNumbers) ||
      toPhoneNumbers.length === 0
    ) {
      return false;
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;

    if (!phoneRegex.test(fromPhoneNumber)) {
      return false;
    }

    for (const phone of toPhoneNumbers) {
      if (typeof phone !== "string" || !phoneRegex.test(phone)) {
        return false;
      }
    }

    // Validate provider-specific configuration
    switch (provider) {
      case "twilio":
        return !!(config.accountSid && config.authToken);
      case "aws_sns":
        return !!(config.accessKeyId && config.secretAccessKey);
      case "nexmo":
      case "messagebird":
        return !!(config.apiKey && config.apiSecret);
      default:
        return false;
    }
  }

  async send(
    channel: SelectNotificationChannel,
    alert: SelectAlertInstance,
    message: NotificationMessage
  ): Promise<NotificationResult> {
    try {
      const config = JSON.parse(channel.config) as SMSConfig;

      const smsText = this.formatSMSMessage(
        message,
        alert,
        config.maxMessageLength || 160
      );

      switch (config.provider) {
        case "twilio":
          return await this.sendViaTwilio(config, smsText);
        case "aws_sns":
          return await this.sendViaAWSSNS(config, smsText);
        case "nexmo":
          return await this.sendViaNexmo(config, smsText);
        case "messagebird":
          return await this.sendViaMessageBird(config, smsText);
        default:
          throw new Error(`Unsupported SMS provider: ${config.provider}`);
      }
    } catch (error) {
      console.error("SMS sending failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown SMS error",
      };
    }
  }

  private formatSMSMessage(
    _message: NotificationMessage,
    alert: SelectAlertInstance,
    maxLength: number
  ): string {
    const severity = alert.severity.toUpperCase();
    const icon = this.getSeverityIcon(alert.severity);

    // Build short message
    let text = `${icon} ${severity}: ${alert.message}`;

    // Add key details if space allows
    const details = [
      `ID: ${alert.id.slice(-8)}`, // Last 8 chars of ID
      `Source: ${alert.source}`,
      `Value: ${alert.metricValue}`,
    ];

    if (alert.threshold) {
      details.push(`Threshold: ${alert.threshold}`);
    }

    const detailsText = details.join(" | ");
    const potentialText = `${text} - ${detailsText}`;

    if (potentialText.length <= maxLength) {
      text = potentialText;
    } else {
      // Truncate to fit length limit
      const availableSpace = maxLength - text.length - 3; // 3 for "..."
      if (availableSpace > 10) {
        text += ` - ${detailsText.slice(0, availableSpace)}...`;
      }
    }

    return text;
  }

  private async sendViaTwilio(
    config: SMSConfig,
    message: string
  ): Promise<NotificationResult> {
    // In production, you would use the Twilio SDK
    // For now, we'll simulate the Twilio API call

    console.info("Sending via Twilio:", {
      from: config.fromPhoneNumber,
      to: config.toPhoneNumbers,
      body: message,
    });

    // Simulate Twilio API call
    // const twilio = require('twilio');
    // const client = twilio(config.accountSid, config.authToken);
    //
    // const promises = config.toPhoneNumbers.map(to =>
    //   client.messages.create({
    //     body: message,
    //     from: config.fromPhoneNumber,
    //     to: to,
    //   })
    // );
    //
    // const results = await Promise.allSettled(promises);

    return {
      success: true,
      messageId: `twilio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      response: {
        simulated: true,
        recipients: config.toPhoneNumbers.length,
      },
    };
  }

  private async sendViaAWSSNS(
    config: SMSConfig,
    message: string
  ): Promise<NotificationResult> {
    // In production, you would use the AWS SDK
    // For now, we'll simulate the AWS SNS API call

    console.info("Sending via AWS SNS:", {
      from: config.fromPhoneNumber,
      to: config.toPhoneNumbers,
      message,
    });

    // Simulate AWS SNS API call
    // const AWS = require('aws-sdk');
    // const sns = new AWS.SNS({
    //   accessKeyId: config.accessKeyId,
    //   secretAccessKey: config.secretAccessKey,
    //   region: config.region || 'us-east-1'
    // });
    //
    // const promises = config.toPhoneNumbers.map(phoneNumber =>
    //   sns.publish({
    //     Message: message,
    //     PhoneNumber: phoneNumber,
    //   }).promise()
    // );
    //
    // const results = await Promise.allSettled(promises);

    return {
      success: true,
      messageId: `aws_sns_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      response: {
        simulated: true,
        recipients: config.toPhoneNumbers.length,
      },
    };
  }

  private async sendViaNexmo(
    config: SMSConfig,
    message: string
  ): Promise<NotificationResult> {
    // In production, you would use the Vonage/Nexmo SDK
    // For now, we'll simulate the Nexmo API call

    console.info("Sending via Nexmo:", {
      from: config.fromPhoneNumber,
      to: config.toPhoneNumbers,
      text: message,
    });

    // Simulate Nexmo API call
    // const Nexmo = require('nexmo');
    // const nexmo = new Nexmo({
    //   apiKey: config.apiKey,
    //   apiSecret: config.apiSecret,
    // });
    //
    // const promises = config.toPhoneNumbers.map(to =>
    //   new Promise((resolve, reject) => {
    //     nexmo.message.sendSms(config.fromPhoneNumber, to, message, (err, responseData) => {
    //       if (err) reject(err);
    //       else resolve(responseData);
    //     });
    //   })
    // );
    //
    // const results = await Promise.allSettled(promises);

    return {
      success: true,
      messageId: `nexmo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      response: {
        simulated: true,
        recipients: config.toPhoneNumbers.length,
      },
    };
  }

  private async sendViaMessageBird(
    config: SMSConfig,
    message: string
  ): Promise<NotificationResult> {
    // In production, you would use the MessageBird SDK
    // For now, we'll simulate the MessageBird API call

    console.info("Sending via MessageBird:", {
      originator: config.fromPhoneNumber,
      recipients: config.toPhoneNumbers,
      body: message,
    });

    // Simulate MessageBird API call
    // const messagebird = require('messagebird')(config.apiKey);
    //
    // const params = {
    //   originator: config.fromPhoneNumber,
    //   recipients: config.toPhoneNumbers,
    //   body: message,
    // };
    //
    // const result = await new Promise((resolve, reject) => {
    //   messagebird.messages.create(params, (err, response) => {
    //     if (err) reject(err);
    //     else resolve(response);
    //   });
    // });

    return {
      success: true,
      messageId: `messagebird_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      response: {
        simulated: true,
        recipients: config.toPhoneNumbers.length,
      },
    };
  }

  private getSeverityIcon(severity: string): string {
    switch (severity) {
      case "critical":
        return "🚨";
      case "high":
        return "⚠️";
      case "medium":
        return "⚡";
      case "low":
        return "ℹ️";
      case "info":
        return "📊";
      default:
        return "📢";
    }
  }
}
