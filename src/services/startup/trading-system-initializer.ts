import { LoggerContainer } from "../../lib/logger-injection";
import { patternTargetBridgeService } from "../data/pattern-detection/pattern-target-bridge-service";
import { patternToDatabaseBridge } from "../data/pattern-detection/pattern-to-database-bridge";

export class TradingSystemInitializer {
  private static instance: TradingSystemInitializer;
  private isInitialized = false;
  private logger = LoggerContainer.getOrCreate("trading-system-initializer");

  static getInstance(): TradingSystemInitializer {
    if (!TradingSystemInitializer.instance) {
      TradingSystemInitializer.instance = new TradingSystemInitializer();
    }
    return TradingSystemInitializer.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.info("Trading system already initialized");
      return;
    }

    try {
      this.logger.info("Initializing trading system...");

      // Start the bridge service listeners
      this.logger.info("🔗 Starting Pattern-Target Bridge Service...");
      await patternTargetBridgeService.startListening();
      this.logger.info("✅ Pattern-Target Bridge Service started");

      this.logger.info("🔗 Starting Pattern-Database Bridge Service...");
      await patternToDatabaseBridge.startListening();
      this.logger.info("✅ Pattern-Database Bridge Service started");

      this.isInitialized = true;
      this.logger.info(
        "🎉 Trading system initialized successfully with both bridge services"
      );
    } catch (error) {
      this.logger.error("Failed to initialize trading system:", error);
      throw error;
    }
  }

  isSystemInitialized(): boolean {
    return this.isInitialized;
  }
}

export const tradingSystemInitializer = TradingSystemInitializer.getInstance();
