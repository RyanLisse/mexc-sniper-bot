import { z } from "zod";

/**
 * Enhanced Component Validation Schemas
 *
 * Comprehensive validation schemas for all component props and form data
 * with enhanced type safety and detailed error messages.
 */

// ============================================================================
// Enhanced Base Schemas
// ============================================================================

const BaseComponentPropsSchema = z.object({
  className: z.string().optional(),
  id: z.string().optional(),
  "data-testid": z.string().optional(),
});

const LoadingStateSchema = z.object({
  isLoading: z.boolean().default(false),
  loadingMessage: z.string().optional(),
});

const ErrorStateSchema = z.object({
  hasError: z.boolean().default(false),
  errorMessage: z.string().optional(),
  errorCode: z.string().optional(),
});

// ============================================================================
// Enhanced Auto-Sniping Schemas
// ============================================================================

export const EnhancedAutoSnipingConfigSchema = z.object({
  enabled: z.boolean().describe("Whether auto-sniping is enabled"),
  maxPositionSize: z
    .number()
    .positive("Position size must be positive")
    .max(100000, "Position size cannot exceed $100,000")
    .describe("Maximum position size in USDT"),
  takeProfitPercentage: z
    .number()
    .min(0.1, "Take profit must be at least 0.1%")
    .max(1000, "Take profit cannot exceed 1000%")
    .describe("Take profit percentage"),
  stopLossPercentage: z
    .number()
    .min(0.1, "Stop loss must be at least 0.1%")
    .max(100, "Stop loss cannot exceed 100%")
    .describe("Stop loss percentage"),
  patternConfidenceThreshold: z
    .number()
    .min(50, "Confidence threshold must be at least 50%")
    .max(100, "Confidence threshold cannot exceed 100%")
    .describe("Minimum pattern confidence required"),
  maxConcurrentTrades: z
    .number()
    .min(1, "Must allow at least 1 concurrent trade")
    .max(20, "Cannot exceed 20 concurrent trades")
    .describe("Maximum number of concurrent trades"),
  enableSafetyChecks: z.boolean().describe("Whether safety checks are enabled"),
  enablePatternDetection: z
    .boolean()
    .describe("Whether pattern detection is enabled"),
  riskLevel: z
    .enum(["conservative", "moderate", "aggressive"])
    .default("moderate"),
  tradingHours: z
    .object({
      enabled: z.boolean().default(false),
      startHour: z.number().min(0).max(23).default(0),
      endHour: z.number().min(0).max(23).default(23),
      timezone: z.string().default("UTC"),
    })
    .optional(),
});

export const EnhancedExecutionStatusSchema = z.enum(
  [
    "idle",
    "initializing",
    "running",
    "paused",
    "stopping",
    "stopped",
    "error",
    "maintenance",
  ],
  {
    errorMap: () => ({ message: "Invalid execution status" }),
  }
);

export const EnhancedExecutionMetricsSchema = z.object({
  totalTrades: z.number().min(0).default(0),
  successfulTrades: z.number().min(0).default(0),
  failedTrades: z.number().min(0).default(0),
  successRate: z.number().min(0).max(100).default(0),
  averageExecutionTime: z.number().min(0).optional(),
  averageSlippage: z.number().min(0).optional(),
  totalPnL: z.number().default(0),
  dailyPnL: z.number().default(0),
  maxDrawdown: z.number().min(0).optional(),
  averageTradeReturn: z.number().optional(),
  sharpeRatio: z.number().optional(),
  winLossRatio: z.number().min(0).optional(),
});

// ============================================================================
// Enhanced Dashboard Component Schemas
// ============================================================================

export const EnhancedDashboardPropsSchema = BaseComponentPropsSchema.extend({
  autoRefresh: z.boolean().default(true),
  refreshInterval: z.number().min(1000).max(300000).default(5000), // 1s to 5min
  showControls: z.boolean().default(true),
  showMetrics: z.boolean().default(true),
  showAlerts: z.boolean().default(true),
  compactMode: z.boolean().default(false),
  theme: z.enum(["light", "dark", "auto"]).default("auto"),
})
  .merge(LoadingStateSchema)
  .merge(ErrorStateSchema);

export const EnhancedExecutionControlsPropsSchema =
  BaseComponentPropsSchema.extend({
    isExecutionActive: z.boolean(),
    executionStatus: EnhancedExecutionStatusSchema,
    metrics: EnhancedExecutionMetricsSchema.optional(),
    showControls: z.boolean().default(true),
    showMetrics: z.boolean().default(true),
    allowEmergencyStop: z.boolean().default(true),
    confirmActions: z.boolean().default(true),
  })
    .merge(LoadingStateSchema)
    .extend({
      isStartingExecution: z.boolean().default(false),
      isPausingExecution: z.boolean().default(false),
      isResumingExecution: z.boolean().default(false),
      isStoppingExecution: z.boolean().default(false),
      isUpdatingConfig: z.boolean().default(false),
    });

export const EnhancedConfigEditorPropsSchema = BaseComponentPropsSchema.extend({
  config: EnhancedAutoSnipingConfigSchema,
  tempConfig: EnhancedAutoSnipingConfigSchema.partial().optional(),
  configEditMode: z.boolean().default(false),
  allowAdvancedSettings: z.boolean().default(false),
  showValidationErrors: z.boolean().default(true),
  autoSave: z.boolean().default(false),
  autoSaveDelay: z.number().min(500).max(10000).default(2000),
})
  .merge(LoadingStateSchema)
  .extend({
    isUpdatingConfig: z.boolean().default(false),
    isSavingConfig: z.boolean().default(false),
    isValidatingConfig: z.boolean().default(false),
  });

// ============================================================================
// Enhanced Form Validation Schemas
// ============================================================================

export const EnhancedConfigFormSchema = EnhancedAutoSnipingConfigSchema.extend({
  // Additional form-specific validations
  confirmRiskySettings: z.boolean().optional(),
}).refine(
  (data) => {
    const isRisky =
      data.takeProfitPercentage > 100 ||
      data.stopLossPercentage > 20 ||
      data.maxConcurrentTrades > 10;
    return !isRisky || data.confirmRiskySettings === true;
  },
  {
    message: "Must confirm risky settings when using high-risk parameters",
    path: ["confirmRiskySettings"],
  }
);

export const EnhancedPositionFormSchema = z.object({
  symbol: z
    .string()
    .min(1, "Symbol is required")
    .regex(/^[A-Z0-9]+$/, "Symbol must be uppercase alphanumeric"),
  side: z.enum(["BUY", "SELL"]),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  price: z.coerce.number().positive("Price must be positive").optional(),
  orderType: z
    .enum(["MARKET", "LIMIT", "STOP_LOSS", "TAKE_PROFIT"])
    .default("MARKET"),
  timeInForce: z.enum(["GTC", "IOC", "FOK"]).default("GTC"),
  stopPrice: z.coerce.number().positive().optional(),
  takeProfitPrice: z.coerce.number().positive().optional(),
  reduceOnly: z.boolean().default(false),
});

// ============================================================================
// Enhanced Alert and Notification Schemas
// ============================================================================

export const EnhancedAlertSeveritySchema = z.enum(
  ["info", "success", "warning", "error", "critical"],
  {
    errorMap: () => ({ message: "Invalid alert severity level" }),
  }
);

export const EnhancedExecutionAlertSchema = z.object({
  id: z.string().uuid("Alert ID must be a valid UUID"),
  type: z.enum([
    "execution",
    "validation",
    "performance",
    "safety",
    "system",
    "market",
    "pattern",
    "risk",
  ]),
  severity: EnhancedAlertSeveritySchema,
  title: z.string().min(1).max(200, "Alert title cannot exceed 200 characters"),
  message: z
    .string()
    .min(1)
    .max(1000, "Alert message cannot exceed 1000 characters"),
  timestamp: z.string().datetime().or(z.date()),
  symbol: z.string().optional(),
  acknowledged: z.boolean().default(false),
  acknowledgedBy: z.string().optional(),
  acknowledgedAt: z.string().datetime().optional(),
  resolvedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
  actions: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        action: z.string(),
        variant: z
          .enum(["primary", "secondary", "danger"])
          .default("secondary"),
      })
    )
    .default([]),
});

// ============================================================================
// Enhanced Trading Position Schemas
// ============================================================================

export const EnhancedExecutionPositionSchema = z.object({
  id: z.string().uuid("Position ID must be a valid UUID"),
  symbol: z.string().min(1, "Symbol is required"),
  side: z.enum(["BUY", "SELL"]),
  entryPrice: z.coerce.number().positive("Entry price must be positive"),
  currentPrice: z.coerce.number().positive("Current price must be positive"),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  notionalValue: z.coerce.number().positive("Notional value must be positive"),
  entryTime: z.string().datetime().or(z.date()),
  status: z.enum([
    "open",
    "partially_filled",
    "filled",
    "cancelled",
    "expired",
    "rejected",
  ]),
  pnl: z.coerce.number().optional(),
  pnlPercentage: z.coerce.number().optional(),
  unrealizedPnl: z.coerce.number().optional(),
  realizedPnl: z.coerce.number().optional(),
  stopLossPrice: z.coerce.number().positive().optional(),
  takeProfitPrice: z.coerce.number().positive().optional(),
  executionQuality: z
    .object({
      slippage: z.number(),
      executionTime: z.number().min(0), // milliseconds
      fillRate: z.number().min(0).max(1), // percentage as decimal
    })
    .optional(),
  patternMatch: z.object({
    patternType: z.string(),
    confidence: z.number().min(0).max(100),
    advanceTime: z.number().optional(), // hours detected in advance
    accuracy: z.number().min(0).max(100).optional(),
  }),
  riskMetrics: z
    .object({
      exposurePercentage: z.number().min(0).max(100),
      leverageRatio: z.number().min(0).optional(),
      marginRequirement: z.number().min(0).optional(),
      valueAtRisk: z.number().optional(),
    })
    .optional(),
});

// ============================================================================
// Enhanced WebSocket Event Schemas
// ============================================================================

export const EnhancedWebSocketEventSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    "price_update",
    "execution_update",
    "config_update",
    "alert",
    "status_change",
    "pattern_detected",
    "system_health",
  ]),
  timestamp: z.string().datetime(),
  data: z.record(z.unknown()),
  source: z.string(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
});

// ============================================================================
// Enhanced Performance Monitoring Schemas
// ============================================================================

export const EnhancedPerformanceMetricsSchema = z.object({
  systemHealth: z.object({
    cpuUsage: z.number().min(0).max(100),
    memoryUsage: z.number().min(0).max(100),
    diskUsage: z.number().min(0).max(100),
    networkLatency: z.number().min(0),
    databaseConnections: z.number().min(0),
    cacheHitRate: z.number().min(0).max(100),
  }),
  tradingMetrics: EnhancedExecutionMetricsSchema,
  apiMetrics: z.object({
    requestsPerMinute: z.number().min(0),
    averageResponseTime: z.number().min(0),
    errorRate: z.number().min(0).max(100),
    rateLimitUsage: z.number().min(0).max(100),
  }),
  patternDetectionMetrics: z.object({
    patternsDetected: z.number().min(0),
    detectionAccuracy: z.number().min(0).max(100),
    averageConfidence: z.number().min(0).max(100),
    processingTime: z.number().min(0),
  }),
});

// ============================================================================
// Validation Helper Functions
// ============================================================================

export function validateComponentProps<T extends z.ZodSchema>(
  schema: T,
  props: unknown,
  componentName?: string
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  try {
    const result = schema.parse(props);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");
      const componentPrefix = componentName
        ? `${componentName} component: `
        : "";
      return {
        success: false,
        error: `${componentPrefix}Props validation failed: ${errorMessage}`,
      };
    }
    return { success: false, error: "Unknown component validation error" };
  }
}

export function validateFormData<T extends z.ZodSchema>(
  schema: T,
  formData: unknown,
  formName?: string
):
  | { success: true; data: z.infer<T> }
  | { success: false; error: string; fieldErrors?: Record<string, string> } {
  try {
    const result = schema.parse(formData);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors: Record<string, string> = {};
      error.errors.forEach((err) => {
        const fieldPath = err.path.join(".");
        fieldErrors[fieldPath] = err.message;
      });

      const errorMessage = error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");
      const formPrefix = formName ? `${formName} form: ` : "";

      return {
        success: false,
        error: `${formPrefix}Validation failed: ${errorMessage}`,
        fieldErrors,
      };
    }
    return { success: false, error: "Unknown form validation error" };
  }
}

// ============================================================================
// Type Exports
// ============================================================================

export type EnhancedAutoSnipingConfig = z.infer<
  typeof EnhancedAutoSnipingConfigSchema
>;
export type EnhancedExecutionStatus = z.infer<
  typeof EnhancedExecutionStatusSchema
>;
export type EnhancedExecutionMetrics = z.infer<
  typeof EnhancedExecutionMetricsSchema
>;
export type EnhancedDashboardProps = z.infer<
  typeof EnhancedDashboardPropsSchema
>;
export type EnhancedExecutionControlsProps = z.infer<
  typeof EnhancedExecutionControlsPropsSchema
>;
export type EnhancedConfigEditorProps = z.infer<
  typeof EnhancedConfigEditorPropsSchema
>;
export type EnhancedConfigForm = z.infer<typeof EnhancedConfigFormSchema>;
export type EnhancedPositionForm = z.infer<typeof EnhancedPositionFormSchema>;
export type EnhancedAlertSeverity = z.infer<typeof EnhancedAlertSeveritySchema>;
export type EnhancedExecutionAlert = z.infer<
  typeof EnhancedExecutionAlertSchema
>;
export type EnhancedExecutionPosition = z.infer<
  typeof EnhancedExecutionPositionSchema
>;
export type EnhancedWebSocketEvent = z.infer<
  typeof EnhancedWebSocketEventSchema
>;
export type EnhancedPerformanceMetrics = z.infer<
  typeof EnhancedPerformanceMetricsSchema
>;
