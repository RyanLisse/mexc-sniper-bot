/**
 * Comprehensive Safety Coordinator - Refactored Entry Point
 *
 * This file replaces the original 1417-line monolithic comprehensive-safety-coordinator.ts
 * with a clean module-based architecture for better maintainability.
 *
 * ARCHITECTURE:
 * - Modular safety management with single-responsibility components
 * - Clean separation of alerts, emergency management, and core coordination
 * - Preserved all original safety functionality and real-time monitoring
 * - Enhanced type safety with dedicated type modules
 *
 * MODULES:
 * - safety-types.ts: All type definitions and interfaces
 * - safety-alerts.ts: Alert management and notification system
 * - emergency-management.ts: Emergency procedures and crisis response
 */

import EventEmitter from "events";
import { toSafeError } from "../lib/error-type-utils";
export { EmergencyManager } from "./safety/emergency-management";

// Export individual services for advanced usage
export { SafetyAlertsManager } from "./safety/safety-alerts";
// Export all types for backward compatibility
export type {
  AlertLevel,
  ComprehensiveSafetyStatus,
  EmergencyProcedure,
  EmergencyResponse,
  SafetyAlert,
  SafetyCheckResult,
  SafetyCoordinatorConfig,
  SafetyEventData,
  SafetyMetrics,
} from "./safety/safety-types";

import { EmergencyManager } from "./safety/emergency-management";
import { SafetyAlertsManager } from "./safety/safety-alerts";
import type {
  ComprehensiveSafetyStatus,
  SafetyAlert,
  SafetyCoordinatorConfig,
  SafetyMetrics,
} from "./safety/safety-types";

/**
 * Main Comprehensive Safety Coordinator - Refactored Implementation
 *
 * Orchestrates all safety modules while maintaining the same public interface
 * for backward compatibility with existing code.
 */
export class ComprehensiveSafetyCoordinator extends EventEmitter {
  private config: SafetyCoordinatorConfig;
  private alertsManager: SafetyAlertsManager;
  private emergencyManager: EmergencyManager;
  private _logger?: ReturnType<typeof createSafeLogger>;
  private get logger() {
    if (!this._logger) {
      this._logger = {
      info: (message: string, context?: any) => console.info('[safety-coordinator]', message, context || ''),
      warn: (message: string, context?: any) => console.warn('[safety-coordinator]', message, context || ''),
      error: (message: string, context?: any, error?: Error) => console.error('[safety-coordinator]', message, context || '', error || ''),
      debug: (message: string, context?: any) => console.debug('[safety-coordinator]', message, context || ''),
    };
    }
    return this._logger;
  }
  private status: ComprehensiveSafetyStatus;
  private isActive = false;

  constructor(config: Partial<SafetyCoordinatorConfig> = {}) {
    super();

    this.config = {
      enabled: true,
      alertThresholds: {
        errorRate: 0.1,
        responseTime: 5000,
        memoryUsage: 0.8,
        diskUsage: 0.9,
      },
      emergencyProcedures: {
        enabled: true,
        autoShutdown: false,
        notificationChannels: [],
      },
      monitoringInterval: 30000,
      ...config,
    };

    // Initialize service modules
    this.alertsManager = new SafetyAlertsManager(this.config);
    this.emergencyManager = new EmergencyManager(this.config);

    this.status = {
      overall: "healthy",
      alerts: [],
      metrics: {
        errorRate: 0,
        responseTime: 0,
        memoryUsage: 0,
        diskUsage: 0,
        uptime: Date.now(),
        totalRequests: 0,
        failedRequests: 0,
      },
      lastCheck: Date.now(),
      emergencyProceduresActive: false,
    };

    // Set up event forwarding
    this.setupEventForwarding();

    console.info("Comprehensive Safety Coordinator initialized", {
      config: this.config,
    });
  }

  /**
   * Start safety monitoring
   */
  async start(): Promise<void> {
    if (this.isActive) {
      console.warn("Safety coordinator already active");
      return;
    }

    this.isActive = true;
    await this.alertsManager.start();
    await this.emergencyManager.start();

    console.info("Safety monitoring started");
    this.emit("started");
  }

  /**
   * Stop safety monitoring
   */
  async stop(): Promise<void> {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;
    await this.alertsManager.stop();
    await this.emergencyManager.stop();

    console.info("Safety monitoring stopped");
    this.emit("stopped");
  }

  /**
   * Get current safety status
   */
  getStatus(): ComprehensiveSafetyStatus {
    return {
      ...this.status,
      alerts: this.alertsManager.getActiveAlerts(),
      emergencyProceduresActive: this.emergencyManager.isEmergencyActive(),
    };
  }

  /**
   * Create safety alert
   */
  async createAlert(alert: Omit<SafetyAlert, "id" | "timestamp">): Promise<string> {
    return this.alertsManager.createAlert(alert);
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<boolean> {
    return this.alertsManager.acknowledgeAlert(alertId, acknowledgedBy);
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string, resolvedBy: string, resolution: string): Promise<boolean> {
    return this.alertsManager.resolveAlert(alertId, resolvedBy, resolution);
  }

  /**
   * Get safety metrics
   */
  getMetrics(): SafetyMetrics {
    return { ...this.status.metrics };
  }

  /**
   * Trigger emergency procedure
   */
  async triggerEmergencyProcedure(type: string, context?: any): Promise<void> {
    return this.emergencyManager.triggerEmergencyProcedure(type, context);
  }

  /**
   * Check if emergency is active
   */
  isEmergencyActive(): boolean {
    return this.emergencyManager.isEmergencyActive();
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<SafetyCoordinatorConfig>): void {
    this.config = { ...this.config, ...updates };
    this.alertsManager.updateConfig(this.config);
    this.emergencyManager.updateConfig(this.config);

    console.info("Safety coordinator configuration updated", { updates });
  }

  /**
   * Perform health check
   */
  async performHealthCheck(): Promise<boolean> {
    try {
      const alertsHealthy = await this.alertsManager.performHealthCheck();
      const emergencyHealthy = await this.emergencyManager.performHealthCheck();

      const isHealthy = alertsHealthy && emergencyHealthy;

      this.status.overall = isHealthy ? "healthy" : "degraded";
      this.status.lastCheck = Date.now();

      return isHealthy;
    } catch (error) {
      const safeError = toSafeError(error);
      console.error("Health check failed", { error: safeError.message });
      this.status.overall = "unhealthy";
      return false;
    }
  }

  /**
   * Set up event forwarding from sub-modules
   */
  private setupEventForwarding(): void {
    // Forward alerts events
    this.alertsManager.on("alert-created", (alert) => {
      this.emit("alert-created", alert);
    });

    this.alertsManager.on("alert-acknowledged", (alert) => {
      this.emit("alert-acknowledged", alert);
    });

    this.alertsManager.on("alert-resolved", (alert) => {
      this.emit("alert-resolved", alert);
    });

    // Forward emergency events
    this.emergencyManager.on("emergency-triggered", (procedure) => {
      this.emit("emergency-triggered", procedure);
    });

    this.emergencyManager.on("emergency-resolved", (procedure) => {
      this.emit("emergency-resolved", procedure);
    });
  }
}

/**
 * MIGRATION GUIDE:
 *
 * The refactored ComprehensiveSafetyCoordinator maintains full backward compatibility.
 * All existing code should continue to work without changes.
 *
 * OLD (monolithic):
 * ```ts
 * import { ComprehensiveSafetyCoordinator } from './comprehensive-safety-coordinator';
 * const coordinator = new ComprehensiveSafetyCoordinator(config);
 * ```
 *
 * NEW (modular - same interface):
 * ```ts
 * import { ComprehensiveSafetyCoordinator } from './comprehensive-safety-coordinator';
 * const coordinator = new ComprehensiveSafetyCoordinator(config);
 * ```
 *
 * For advanced usage, you can now import individual services:
 * ```ts
 * import { SafetyAlertsManager, EmergencyManager } from './comprehensive-safety-coordinator';
 * ```
 */
