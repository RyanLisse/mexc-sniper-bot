/**
 * Initialization Manager
 * Handles service initialization, configuration, and lifecycle management
 */

import { BrowserCompatibleEventEmitter } from "@/src/lib/browser-compatible-events";
import { toSafeError } from "@/src/lib/error-type-utils";
import { UnifiedMexcServiceV2 } from "@/src/services/api/unified-mexc-service-v2";
import { ComprehensiveSafetyCoordinator } from "@/src/services/risk/comprehensive-safety-coordinator";
import type {
  CoreTradingConfig,
  ModuleContext,
  ServiceResponse,
} from "../types";
import { validateConfig } from "../types";

export class InitializationManager extends BrowserCompatibleEventEmitter {
  private config: CoreTradingConfig;
  private isInitialized = false;
  private isHealthy = true;
  private startTime = new Date();
  private mexcService: UnifiedMexcServiceV2;
  private safetyCoordinator: ComprehensiveSafetyCoordinator | null = null;

  constructor(config: Partial<CoreTradingConfig> = {}) {
    super();

    // Validate and set configuration
    this.config = validateConfig({
      apiKey: process.env.MEXC_API_KEY || "",
      secretKey: process.env.MEXC_SECRET_KEY || "",
      ...config,
    });

    // Initialize MEXC service
    this.mexcService = new UnifiedMexcServiceV2({
      apiKey: this.config.apiKey,
      secretKey: this.config.secretKey,
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      enableCaching: this.config.enableCaching,
      cacheTTL: this.config.cacheTTL,
    });
  }

  async initialize(): Promise<ServiceResponse<void>> {
    try {
      if (this.isInitialized) {
        return {
          success: true,
          data: undefined,
          timestamp: new Date().toISOString(),
        };
      }

      // Initialize safety coordinator if enabled
      if (this.config.enableCircuitBreaker) {
        try {
          if (!this.safetyCoordinator) {
            this.safetyCoordinator = new ComprehensiveSafetyCoordinator({
              apiKey: this.config.apiKey,
              secretKey: this.config.secretKey,
            });
          }

          const maxStartAttempts = 3;
          let startAttempts = 0;

          while (startAttempts < maxStartAttempts) {
            try {
              await this.safetyCoordinator.initialize();
              break;
            } catch (error) {
              startAttempts++;
              if (startAttempts >= maxStartAttempts) {
                throw new Error(
                  `Failed to initialize safety coordinator after ${maxStartAttempts} attempts: ${toSafeError(error).message}`
                );
              }
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }
        } catch (error) {
          return {
            success: false,
            error: toSafeError(error).message,
            timestamp: new Date().toISOString(),
          };
        }
      }

      this.isInitialized = true;
      this.emit("initialized");

      return {
        success: true,
        data: undefined,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: toSafeError(error).message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async shutdown(): Promise<ServiceResponse<void>> {
    try {
      if (!this.isInitialized) {
        return {
          success: true,
          data: undefined,
          timestamp: new Date().toISOString(),
        };
      }

      // Shutdown safety coordinator
      if (this.safetyCoordinator) {
        try {
          await this.safetyCoordinator.shutdown();
        } catch (error) {
          console.warn("Error during safety coordinator shutdown:", error);
        }
      }

      this.isInitialized = false;
      this.emit("shutdown");

      return {
        success: true,
        data: undefined,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: toSafeError(error).message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  createModuleContext(): ModuleContext {
    return {
      config: this.config,
      mexcService: this.mexcService,
      logger: this.createLogger(),
      eventEmitter: this,
      tradingStrategy: {
        closePosition: async (positionId: string, reason: string) => {
          this.emit("closePosition", { positionId, reason });
          return {
            success: true,
            data: undefined,
            timestamp: new Date().toISOString(),
          };
        },
      },
      orderExecutor: this.createOrderExecutor(),
      positionManager: this.createPositionManager(),
    };
  }

  private createLogger() {
    return {
      info: (message: string, context?: any) => {
        import("@/src/services/notification/error-logging-service")
          .then(({ errorLogger }) => {
            errorLogger.logInfo(message, {
              component: "InitializationManager",
              operation: "info",
              ...context,
            });
          })
          .catch(() => {
            console.info("[initialization-manager]", message, context || "");
          });
      },
      warn: (message: string, context?: any) => {
        import("@/src/services/notification/error-logging-service")
          .then(({ errorLogger }) => {
            errorLogger.logWarning(message, {
              component: "InitializationManager",
              operation: "warning",
              ...context,
            });
          })
          .catch(() => {
            console.warn("[initialization-manager]", message, context || "");
          });
      },
      error: (message: string, context?: any) => {
        import("@/src/services/notification/error-logging-service")
          .then(({ errorLogger }) => {
            const error = new Error(message);
            errorLogger.logError(error, {
              component: "InitializationManager",
              operation: "error",
              ...context,
            });
          })
          .catch(() => {
            console.error("[initialization-manager]", message, context || "");
          });
      },
      debug: (message: string, context?: any) => {
        import("@/src/services/notification/error-logging-service")
          .then(({ errorLogger }) => {
            errorLogger.logDebug(message, {
              component: "InitializationManager",
              operation: "debug",
              ...context,
            });
          })
          .catch(() => {
            console.debug("[initialization-manager]", message, context || "");
          });
      },
    };
  }

  private createOrderExecutor() {
    return {
      executePaperSnipe: async (params: any) => {
        this.emit("executePaperSnipe", params);
        return {
          success: true,
          data: undefined,
          timestamp: new Date().toISOString(),
        };
      },
      executeRealSnipe: async (params: any) => {
        this.emit("executeRealSnipe", params);
        return {
          success: true,
          data: undefined,
          timestamp: new Date().toISOString(),
        };
      },
      createPositionEntry: async (params: any, result: any) => ({
        id: `${params.symbol}-${Date.now()}`,
        symbol: params.symbol,
        side: params.side,
        orderId: result.data?.orderId || "unknown",
        entryPrice: parseFloat(result.data?.price || "0"),
        quantity: parseFloat(result.data?.quantity || "0"),
        timestamp: new Date().toISOString(),
        status: "open" as const,
        openTime: new Date(),
        strategy: params.strategy || "default",
        tags: ["auto-generated"],
      }),
    };
  }

  private createPositionManager() {
    return {
      setupPositionMonitoring: async (_position: any, _result: any) => {},
      updatePositionStopLoss: async (
        _positionId: string,
        _newStopLoss: any
      ) => ({
        success: true,
        data: undefined,
        timestamp: new Date().toISOString(),
      }),
      updatePositionTakeProfit: async (
        _positionId: string,
        _newTakeProfit: any
      ) => ({
        success: true,
        data: undefined,
        timestamp: new Date().toISOString(),
      }),
      getActivePositions: () => new Map<string, any>(),
      createPositionEntry: async (
        tradeParams: any,
        symbol: string,
        stopLoss?: any,
        takeProfit?: any
      ) => ({
        id: `${symbol}-${Date.now()}`,
        symbol: symbol,
        side: tradeParams.side || "BUY",
        orderId: `order-${Date.now()}`,
        entryPrice: tradeParams.price || 0,
        quantity: tradeParams.quantity || 0,
        timestamp: new Date().toISOString(),
        status: "open" as const,
        openTime: new Date(),
        strategy: tradeParams.strategy || "default",
        tags: ["auto-generated"],
        stopLoss: stopLoss,
        takeProfit: takeProfit,
      }),
    };
  }

  // Getters
  get initialized(): boolean {
    return this.isInitialized;
  }

  get healthy(): boolean {
    return this.isHealthy;
  }

  get configuration(): CoreTradingConfig {
    return this.config;
  }

  get mexcServiceInstance(): UnifiedMexcServiceV2 {
    return this.mexcService;
  }

  get safetyCoordinatorInstance(): ComprehensiveSafetyCoordinator | null {
    return this.safetyCoordinator;
  }

  get uptime(): number {
    return Date.now() - this.startTime.getTime();
  }

  async updateConfig(
    newConfig: Partial<CoreTradingConfig>
  ): Promise<ServiceResponse<void>> {
    try {
      const updatedConfig = validateConfig({
        ...this.config,
        ...newConfig,
      });

      this.config = updatedConfig;
      this.emit("configUpdated", updatedConfig);

      return {
        success: true,
        data: undefined,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: toSafeError(error).message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
