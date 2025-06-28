/**
 * Start Sniping Use Case
 * Handles the initiation of auto-sniping for a specific symbol
 */

import { z } from "zod";
import { Trade } from "@/src/domain/entities/trading/trade";
import type { TradingRepository, TradingService, NotificationService } from "@/src/application/interfaces/trading-repository";
import { 
  DomainValidationError, 
  InvalidTradeParametersError,
  BusinessRuleViolationError 
} from "@/src/domain/errors/trading-errors";
import { toSafeError } from "@/src/lib/error-type-utils";

// Input validation schema
const StartSnipingInputSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  symbol: z.string().min(1, "Symbol is required"),
  strategy: z.string().optional(),
  confidenceScore: z.number().min(0).max(100, "Confidence score must be between 0-100"),
  positionSizeUsdt: z.number().positive("Position size must be positive"),
  stopLossPercent: z.number().positive().max(100).optional(),
  takeProfitPercent: z.number().positive().optional(),
  paperTrade: z.boolean().default(false),
  notes: z.string().optional(),
});

export type StartSnipingInput = z.infer<typeof StartSnipingInputSchema>;

export interface StartSnipingOutput {
  success: boolean;
  tradeId?: string;
  trade?: Trade;
  error?: string;
  timestamp: string;
}

export class StartSnipingUseCase {
  constructor(
    private readonly tradingRepository: TradingRepository,
    private readonly tradingService: TradingService,
    private readonly notificationService: NotificationService,
    private readonly logger: {
      info: (message: string, context?: any) => void;
      warn: (message: string, context?: any) => void;
      error: (message: string, context?: any) => void;
      debug: (message: string, context?: any) => void;
    }
  ) {}

  async execute(input: StartSnipingInput): Promise<StartSnipingOutput> {
    const timestamp = new Date().toISOString();

    try {
      // Validate input
      const validatedInput = this.validateInput(input);

      // Check business rules
      await this.validateBusinessRules(validatedInput);

      // Create trade entity
      const trade = this.createTradeEntity(validatedInput);

      // Save trade to repository
      const savedTrade = await this.tradingRepository.saveTrade(trade);

      // Start execution
      const executionResult = await this.executeTradeStart(savedTrade, validatedInput);

      // Update trade with execution details
      const updatedTrade = savedTrade.startExecution();
      const finalTrade = await this.tradingRepository.updateTrade(updatedTrade);

      // Send notification
      await this.notificationService.notifyTradeExecution(finalTrade);

      this.logger.info("Auto-sniping started successfully", {
        tradeId: finalTrade.id,
        symbol: validatedInput.symbol,
        userId: validatedInput.userId,
        confidenceScore: validatedInput.confidenceScore,
      });

      return {
        success: true,
        tradeId: finalTrade.id,
        trade: finalTrade,
        timestamp,
      };

    } catch (error) {
      const safeError = toSafeError(error);
      
      this.logger.error("Failed to start auto-sniping", {
        input,
        error: safeError,
        timestamp,
      });

      return {
        success: false,
        error: safeError.message,
        timestamp,
      };
    }
  }

  private validateInput(input: StartSnipingInput): StartSnipingInput {
    const result = StartSnipingInputSchema.safeParse(input);
    
    if (!result.success) {
      const firstError = result.error.errors[0];
      throw new DomainValidationError(
        firstError.path.join("."),
        input,
        firstError.message
      );
    }

    return result.data;
  }

  private async validateBusinessRules(input: StartSnipingInput): Promise<void> {
    // Check if symbol is tradeable
    const canTrade = await this.tradingService.canTrade(input.symbol);
    if (!canTrade) {
      throw new BusinessRuleViolationError(
        `Symbol ${input.symbol} is not available for trading`,
        `StartSniping: ${input.symbol}`
      );
    }

    // Check for active trades on the same symbol for the user
    const activeTradesForSymbol = await this.tradingRepository.findActiveTradesByUserId(input.userId);
    const existingTradeForSymbol = activeTradesForSymbol.find(trade => 
      trade.symbol === input.symbol && trade.isAutoSnipe
    );

    if (existingTradeForSymbol) {
      throw new BusinessRuleViolationError(
        `Auto-sniping already active for symbol ${input.symbol}`,
        `User: ${input.userId}, Existing Trade: ${existingTradeForSymbol.id}`
      );
    }

    // Validate confidence score for auto-snipe
    if (input.confidenceScore < 50) {
      throw new BusinessRuleViolationError(
        "Confidence score too low for auto-sniping (minimum 50%)",
        `Confidence: ${input.confidenceScore}%`
      );
    }

    // Check maximum concurrent positions
    const activeTrades = await this.tradingRepository.findActiveTradesByUserId(input.userId);
    if (activeTrades.length >= 10) { // Business rule: max 10 concurrent positions
      throw new BusinessRuleViolationError(
        "Maximum concurrent positions reached (10)",
        `User: ${input.userId}, Active: ${activeTrades.length}`
      );
    }
  }

  private createTradeEntity(input: StartSnipingInput): Trade {
    return Trade.create({
      userId: input.userId,
      symbol: input.symbol.toUpperCase(),
      strategy: input.strategy || "auto-snipe",
      isAutoSnipe: true,
      confidenceScore: input.confidenceScore,
      paperTrade: input.paperTrade,
      stopLossPercent: input.stopLossPercent,
      takeProfitPercent: input.takeProfitPercent,
      notes: input.notes,
    });
  }

  private async executeTradeStart(trade: Trade, input: StartSnipingInput): Promise<void> {
    try {
      // Get current market price for reference
      const currentPrice = await this.tradingService.getCurrentPrice(input.symbol);
      
      this.logger.info("Trade execution initialized", {
        tradeId: trade.id,
        symbol: input.symbol,
        currentPrice,
        positionSize: input.positionSizeUsdt,
        confidenceScore: input.confidenceScore,
      });

      // The actual trade execution will be handled by the auto-sniping service
      // This use case just sets up the trade record and validates prerequisites
      
    } catch (error) {
      const safeError = toSafeError(error);
      throw new InvalidTradeParametersError(
        "executionSetup",
        `Failed to initialize trade execution: ${safeError.message}`
      );
    }
  }

  // Helper method to check if user can start auto-sniping
  async canUserStartSniping(userId: string): Promise<{
    canStart: boolean;
    reason?: string;
    activeTradesCount: number;
    maxAllowed: number;
  }> {
    try {
      const activeTrades = await this.tradingRepository.findActiveTradesByUserId(userId);
      const activeSnipeTrades = activeTrades.filter(trade => trade.isAutoSnipe);
      const maxAllowed = 10;

      if (activeSnipeTrades.length >= maxAllowed) {
        return {
          canStart: false,
          reason: "Maximum concurrent auto-snipe positions reached",
          activeTradesCount: activeSnipeTrades.length,
          maxAllowed,
        };
      }

      return {
        canStart: true,
        activeTradesCount: activeSnipeTrades.length,
        maxAllowed,
      };

    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to check user sniping eligibility", {
        userId,
        error: safeError,
      });

      return {
        canStart: false,
        reason: "Unable to verify trading eligibility",
        activeTradesCount: 0,
        maxAllowed: 10,
      };
    }
  }
}