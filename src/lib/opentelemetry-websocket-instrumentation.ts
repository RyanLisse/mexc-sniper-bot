/**
 * OpenTelemetry WebSocket Instrumentation
 * Minimal implementation for build optimization
 */

export interface WebSocketInstrumentationConfig {
  enabled: boolean;
  traceConnections: boolean;
  traceMessages: boolean;
  includeMessageContent: boolean;
}

class WebSocketInstrumentation {
  private config: WebSocketInstrumentationConfig = {
    enabled: process.env.NODE_ENV === "production",
    traceConnections: false,
    traceMessages: false,
    includeMessageContent: false,
  };

  initialize(config?: Partial<WebSocketInstrumentationConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    if (this.config.enabled) {
      console.log("WebSocket instrumentation initialized");
    }
  }

  traceConnection(
    connectionId: string,
    event: "connect" | "disconnect",
    metadata?: any
  ): void {
    if (!this.config.enabled || !this.config.traceConnections) {
      return;
    }

    console.debug("WebSocket Connection:", {
      connectionId,
      event,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }

  traceMessage(
    connectionId: string,
    direction: "inbound" | "outbound",
    messageType: string,
    content?: any
  ): void {
    if (!this.config.enabled || !this.config.traceMessages) {
      return;
    }

    console.debug("WebSocket Message:", {
      connectionId,
      direction,
      messageType,
      content: this.config.includeMessageContent ? content : "[hidden]",
      timestamp: new Date().toISOString(),
    });
  }

  recordWebSocketMetric(
    metricName: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    if (!this.config.enabled) {
      return;
    }

    console.debug("WebSocket Metric:", {
      metric: metricName,
      value,
      labels,
      timestamp: new Date().toISOString(),
    });
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }
}

export const webSocketInstrumentation = new WebSocketInstrumentation();

export function initializeWebSocketInstrumentation(
  config?: Partial<WebSocketInstrumentationConfig>
): void {
  webSocketInstrumentation.initialize(config);
}

export function instrumentChannelOperation(
  channel: string,
  operation: string,
  metadata?: any
): void {
  webSocketInstrumentation.traceMessage(
    channel,
    "outbound",
    operation,
    metadata
  );
}

export function instrumentWebSocketSend(connectionId: string, data: any): void {
  webSocketInstrumentation.traceMessage(connectionId, "outbound", "send", data);
}
