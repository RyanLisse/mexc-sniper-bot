import type { SelectAlertInstance, SelectNotificationChannel } from "@/src/db/schemas/alerts";
import type { NotificationMessage, NotificationProvider, NotificationResult } from "./index";

interface WebhookConfig {
  url: string;
  method?: "POST" | "PUT" | "PATCH";
  headers?: Record<string, string>;
  authentication?: {
    type: "bearer" | "basic" | "api_key";
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
    apiKeyHeader?: string;
  };
  retryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
  payloadFormat?: "json" | "form" | "custom";
  customPayloadTemplate?: string;
}

export class WebhookProvider implements NotificationProvider {
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
            console.info("[webhook-provider]", message, context || ""),
          warn: (message: string, context?: any) =>
            console.warn("[webhook-provider]", message, context || ""),
          error: (message: string, context?: any, error?: Error) =>
            console.error("[webhook-provider]", message, context || "", error || ""),
          debug: (message: string, context?: any) =>
            console.debug("[webhook-provider]", message, context || ""),
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
    return "webhook";
  }

  async validateConfig(config: Record<string, unknown>): Promise<boolean> {
    // Type guard for WebhookConfig
    if (!config || typeof config !== "object") {
      return false;
    }

    const url = config.url;
    if (!url || typeof url !== "string") {
      return false;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return false;
    }

    // Validate method
    const method = config.method;
    if (method && typeof method === "string" && !["POST", "PUT", "PATCH"].includes(method)) {
      return false;
    }

    // Validate authentication config if provided
    const authentication = config.authentication;
    if (authentication && typeof authentication === "object") {
      const auth = authentication as any;
      switch (auth.type) {
        case "bearer":
          if (!auth.token) return false;
          break;
        case "basic":
          if (!auth.username || !auth.password) return false;
          break;
        case "api_key":
          if (!auth.apiKey || !auth.apiKeyHeader) return false;
          break;
      }
    }

    return true;
  }

  async send(
    channel: SelectNotificationChannel,
    alert: SelectAlertInstance,
    message: NotificationMessage
  ): Promise<NotificationResult> {
    const config = JSON.parse(channel.config) as WebhookConfig;
    const maxRetries = config.retryAttempts || 3;
    const retryDelay = config.retryDelay || 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.makeWebhookRequest(config, alert, message);

        if (result.success) {
          return result;
        }

        // If not the last attempt, wait before retrying
        if (attempt < maxRetries) {
          await this.delay(retryDelay * attempt);
        } else {
          return result; // Return the last failed attempt
        }
      } catch (error) {
        console.error(`Webhook attempt ${attempt} failed:`, error);

        if (attempt >= maxRetries) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown webhook error",
          };
        }

        await this.delay(retryDelay * attempt);
      }
    }

    return {
      success: false,
      error: "Maximum retry attempts exceeded",
    };
  }

  private async makeWebhookRequest(
    config: WebhookConfig,
    alert: SelectAlertInstance,
    message: NotificationMessage
  ): Promise<NotificationResult> {
    try {
      const headers = this.buildHeaders(config);
      const payload = this.buildPayload(config, alert, message);
      const method = config.method || "POST";
      const _timeout = config.timeout || 30000;

      // For production, you would make an actual HTTP request
      // For now, we'll simulate the webhook call

      console.info("Sending webhook:", {
        url: config.url,
        method,
        headers,
        payload,
      });

      // In production, you would:
      // const controller = new AbortController();
      // const timeoutId = setTimeout(() => controller.abort(), timeout);
      //
      // const response = await fetch(config.url, {
      //   method,
      //   headers,
      //   body: this.formatPayload(payload, config.payloadFormat),
      //   signal: controller.signal
      // });
      //
      // clearTimeout(timeoutId);
      //
      // if (!response.ok) {
      //   throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      // }
      //
      // const responseData = await response.text();

      return {
        success: true,
        messageId: `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        response: { simulated: true },
      };
    } catch (error) {
      console.error("Webhook request failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown webhook error",
      };
    }
  }

  private buildHeaders(config: WebhookConfig): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "MEXC-Sniper-Bot-Alerting/1.0",
      ...config.headers,
    };

    // Add authentication headers
    if (config.authentication) {
      const auth = config.authentication;
      switch (auth.type) {
        case "bearer":
          headers.Authorization = `Bearer ${auth.token}`;
          break;
        case "basic": {
          const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString("base64");
          headers.Authorization = `Basic ${credentials}`;
          break;
        }
        case "api_key":
          headers[auth.apiKeyHeader!] = auth.apiKey!;
          break;
      }
    }

    return headers;
  }

  private buildPayload(
    config: WebhookConfig,
    alert: SelectAlertInstance,
    message: NotificationMessage
  ): Record<string, unknown> {
    if (config.customPayloadTemplate) {
      return this.buildCustomPayload(config.customPayloadTemplate, alert, message);
    }

    return this.buildStandardPayload(alert, message);
  }

  private buildStandardPayload(
    alert: SelectAlertInstance,
    message: NotificationMessage
  ): Record<string, unknown> {
    return {
      event: "alert",
      timestamp: new Date().toISOString(),
      alert: {
        id: alert.id,
        status: alert.status,
        severity: alert.severity,
        message: alert.message,
        description: alert.description,
        metricValue: alert.metricValue,
        threshold: alert.threshold,
        anomalyScore: alert.anomalyScore,
        source: alert.source,
        sourceId: alert.sourceId,
        environment: alert.environment,
        firstTriggeredAt: new Date(alert.firstTriggeredAt).toISOString(),
        lastTriggeredAt: new Date(alert.lastTriggeredAt).toISOString(),
        escalationLevel: alert.escalationLevel,
        correlationId: alert.correlationId,
        labels: alert.labels ? JSON.parse(alert.labels) : {},
        additionalData: alert.additionalData ? JSON.parse(alert.additionalData) : {},
      },
      notification: {
        title: message.title,
        body: message.body,
        priority: message.priority,
        alertUrl: message.alertUrl,
      },
      system: {
        name: "MEXC Sniper Bot",
        version: "1.0.0",
        environment: process.env.NODE_ENV || "production",
      },
    };
  }

  private buildCustomPayload(
    template: string,
    alert: SelectAlertInstance,
    message: NotificationMessage
  ): Record<string, unknown> {
    // Replace template variables with actual values
    const variables = {
      "alert.id": alert.id,
      "alert.status": alert.status,
      "alert.severity": alert.severity,
      "alert.message": alert.message,
      "alert.description": alert.description || "",
      "alert.metricValue": alert.metricValue?.toString() || "",
      "alert.threshold": alert.threshold?.toString() || "",
      "alert.anomalyScore": alert.anomalyScore?.toString() || "",
      "alert.source": alert.source,
      "alert.sourceId": alert.sourceId || "",
      "alert.environment": alert.environment || "",
      "alert.firstTriggeredAt": new Date(alert.firstTriggeredAt).toISOString(),
      "alert.lastTriggeredAt": new Date(alert.lastTriggeredAt).toISOString(),
      "alert.escalationLevel": alert.escalationLevel?.toString() || "0",
      "message.title": message.title,
      "message.body": message.body,
      "message.priority": message.priority,
      "message.alertUrl": message.alertUrl || "",
      timestamp: new Date().toISOString(),
      "system.name": "MEXC Sniper Bot",
      "system.version": "1.0.0",
      "system.environment": process.env.NODE_ENV || "production",
    };

    let processedTemplate = template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      processedTemplate = processedTemplate.replace(new RegExp(placeholder, "g"), value);
    }

    try {
      return JSON.parse(processedTemplate);
    } catch (error) {
      console.error("Failed to parse custom payload template:", error);
      return this.buildStandardPayload(alert, message);
    }
  }

  private formatPayload(payload: Record<string, unknown>, format?: string): string {
    switch (format) {
      case "form":
        return new URLSearchParams(
          Object.entries(payload).map(([key, value]) => [key, String(value)])
        ).toString();
      case "custom":
        // For custom format, the payload should already be formatted
        return typeof payload === "string" ? payload : JSON.stringify(payload);
      default:
        return JSON.stringify(payload);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
