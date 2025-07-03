/**
 * Auto-Sniping Core Module
 * 
 * Core auto-sniping functionality: start, stop, pause, resume, execute.
 * Extracted from large auto-sniping.ts for better maintainability.
 */

import type { AutoSnipeTarget } from "@/src/schemas/unified";
import type {
  CoreTradingConfig,
  ModuleContext,
  ModuleState,
  ServiceResponse,
  TradeResult,
} from "../consolidated/core-trading/types";
import { ConfigurationManager } from "./configuration-manager";
import { TargetProcessor } from "./target-processor";

export class AutoSnipingCore {
  private context: ModuleContext;
  private state: ModuleState & {
    isActive: boolean;
    isPaused: boolean;
    lastExecution: Date | null;
    stats: {
      totalTrades: number;
      successfulTrades: number;
      failedTrades: number;
      averageConfidence: number;
      timestamp: number;
    };
  };
  private autoSnipingInterval: NodeJS.Timeout | null = null;
  private isExecuting = false;

  // Modules
  private targetProcessor: TargetProcessor;
  private configManager: ConfigurationManager;

  constructor(context: ModuleContext) {
    this.context = context;
    this.state = {
      isActive: false,
      isPaused: false,
      lastExecution: null,
      stats: {
        totalTrades: 0,
        successfulTrades: 0,
        failedTrades: 0,
        averageConfidence: 0,
        timestamp: Date.now(),
      },
      isInitialized: false,
      isHealthy: true,
      lastActivity: new Date(),
      metrics: {},
    };

    this.targetProcessor = new TargetProcessor(context);
    this.configManager = new ConfigurationManager(context);
  }

  async initialize(): Promise<void> {
    await this.targetProcessor.initialize();
    await this.configManager.initialize();
    console.log('AutoSnipingCore initialized');
  }

  async shutdown(): Promise<void> {
    if (this.autoSnipingInterval) {
      clearInterval(this.autoSnipingInterval);
      this.autoSnipingInterval = null;
    }

    this.state.isActive = false;
    this.state.isPaused = false;

    await this.targetProcessor.shutdown();
    console.log('AutoSnipingCore shutdown complete');
  }

  async updateConfig(config: Partial<CoreTradingConfig>): Promise<void> {
    await this.configManager.updateConfig(config);
    
    if (this.state.isActive && !this.state.isPaused) {
      await this.stop();
      await this.start();
    }
  }

  async start(): Promise<ServiceResponse<void>> {
    try {
      if (this.state.isActive) {
        return {
          success: true,
          data: undefined,
          message: 'Auto-sniping already active',
          timestamp: new Date().toISOString(),
        };
      }

      const config = this.configManager.getConfig();
      if (!config.autoSnipingEnabled) {
        return {
          success: false,
          error: 'Auto-sniping is disabled in configuration',
          timestamp: new Date().toISOString(),
        };
      }

      this.state.isActive = true;
      this.state.isPaused = false;

      this.autoSnipingInterval = setInterval(
        () => this.executeInternal(),
        config.snipeCheckInterval || 30000
      );

      console.log('Auto-sniping started', {
        interval: config.snipeCheckInterval,
        enabled: config.autoSnipingEnabled,
      });

      return {
        success: true,
        data: undefined,
        message: 'Auto-sniping started successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.state.isActive = false;
      return {
        success: false,
        error: `Failed to start auto-sniping: ${error}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async stop(): Promise<ServiceResponse<void>> {
    try {
      if (this.autoSnipingInterval) {
        clearInterval(this.autoSnipingInterval);
        this.autoSnipingInterval = null;
      }

      this.state.isActive = false;
      this.state.isPaused = false;

      console.log('Auto-sniping stopped');

      return {
        success: true,
        data: undefined,
        message: 'Auto-sniping stopped successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to stop auto-sniping: ${error}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async pause(): Promise<ServiceResponse<void>> {
    try {
      if (!this.state.isActive) {
        return {
          success: false,
          error: 'Auto-sniping is not active',
          timestamp: new Date().toISOString(),
        };
      }

      if (this.autoSnipingInterval) {
        clearInterval(this.autoSnipingInterval);
        this.autoSnipingInterval = null;
      }

      this.state.isPaused = true;

      console.log('Auto-sniping paused');

      return {
        success: true,
        data: undefined,
        message: 'Auto-sniping paused successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to pause auto-sniping: ${error}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async resume(): Promise<ServiceResponse<void>> {
    try {
      if (!this.state.isActive) {
        return await this.start();
      }

      if (!this.state.isPaused) {
        return {
          success: true,
          data: undefined,
          message: 'Auto-sniping is already running',
          timestamp: new Date().toISOString(),
        };
      }

      const config = this.configManager.getConfig();
      this.state.isPaused = false;

      this.autoSnipingInterval = setInterval(
        () => this.executeInternal(),
        config.snipeCheckInterval || 30000
      );

      console.log('Auto-sniping resumed');

      return {
        success: true,
        data: undefined,
        message: 'Auto-sniping resumed successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to resume auto-sniping: ${error}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  getStatus() {
    return {
      isActive: this.state.isActive,
      isPaused: this.state.isPaused,
      isExecuting: this.isExecuting,
      lastExecution: this.state.lastExecution,
      stats: this.state.stats,
      activePositions: this.targetProcessor.getActivePositionsCount(),
    };
  }

  async execute(): Promise<ServiceResponse<{ processedCount: number; successCount: number }>> {
    if (!this.configManager.isReadyForTrading()) {
      return {
        success: false,
        error: 'Auto-sniping module not ready for trading',
        timestamp: new Date().toISOString(),
      };
    }

    return await this.targetProcessor.processSnipeTargets();
  }

  private async executeInternal(): Promise<void> {
    if (this.isExecuting) {
      console.log('Previous execution still running, skipping this interval');
      return;
    }

    try {
      this.isExecuting = true;
      this.state.lastExecution = new Date();

      const result = await this.execute();
      
      if (result.success) {
        console.log('Auto-sniping execution completed', result.data);
      } else {
        console.error('Auto-sniping execution failed:', result.error);
      }
    } catch (error) {
      console.error('Auto-sniping execution error:', error);
    } finally {
      this.isExecuting = false;
    }
  }

  isExecutionActive(): boolean {
    return this.isExecuting;
  }

  async processTarget(target: AutoSnipeTarget): Promise<ServiceResponse<TradeResult>> {
    return await this.targetProcessor.processTarget(target);
  }
}