/**
 * Trading Domain Commands and Handlers
 *
 * Demonstrates Event Sourcing and CQRS patterns applied to trading domain.
 * Part of Phase 3 Production Readiness implementation.
 */

import { type DomainEvent, eventStoreManager } from "../event-sourcing/event-store";
import {
  BaseCommandHandler,
  type Command,
  CommandFactory,
  type CommandResult,
  commandBus,
} from "./command-bus";
import {
  BaseQueryHandler,
  BaseReadModelProjection,
  type Query,
  QueryFactory,
  type QueryResult,
  queryBus,
  readModelStore,
} from "./query-bus";

// Trading Commands
export interface CreateTradeCommand extends Command {
  type: "CREATE_TRADE";
  payload: {
    userId: string;
    symbol: string;
    side: "BUY" | "SELL";
    quantity: number;
    price?: number;
    orderType: "MARKET" | "LIMIT";
    isAutoSnipe: boolean;
    confidenceScore?: number;
  };
}

export interface ExecuteTradeCommand extends Command {
  type: "EXECUTE_TRADE";
  payload: {
    tradeId: string;
    executedPrice: number;
    executedQuantity: number;
    executionTime: Date;
    mexcOrderId: string;
  };
}

export interface CancelTradeCommand extends Command {
  type: "CANCEL_TRADE";
  payload: {
    tradeId: string;
    reason: string;
  };
}

// Trading Queries
export interface GetTradeQuery extends Query {
  type: "GET_TRADE";
  parameters: {
    tradeId: string;
  };
}

export interface GetUserTradesQuery extends Query {
  type: "GET_USER_TRADES";
  parameters: {
    userId: string;
    status?: "PENDING" | "EXECUTED" | "CANCELLED" | "FAILED";
    limit?: number;
    offset?: number;
  };
}

export interface GetTradingStatsQuery extends Query {
  type: "GET_TRADING_STATS";
  parameters: {
    userId?: string;
    symbol?: string;
    fromDate?: Date;
    toDate?: Date;
  };
}

// Trade Read Model
export interface TradeReadModel {
  id: string;
  userId: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price?: number;
  orderType: "MARKET" | "LIMIT";
  status: "PENDING" | "EXECUTED" | "CANCELLED" | "FAILED";
  isAutoSnipe: boolean;
  confidenceScore?: number;
  executedPrice?: number;
  executedQuantity?: number;
  executionTime?: Date;
  mexcOrderId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Trading Stats Read Model
export interface TradingStatsReadModel {
  id: string;
  userId: string;
  symbol?: string;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  totalVolume: number;
  totalPnL: number;
  winRate: number;
  averageConfidence: number;
  lastTradeAt?: Date;
  period: string;
}

/**
 * Create Trade Command Handler
 */
export class CreateTradeCommandHandler extends BaseCommandHandler<CreateTradeCommand> {
  protected getSupportedCommandType(): string {
    return "CREATE_TRADE";
  }

  async handle(command: CreateTradeCommand): Promise<CommandResult> {
    const { payload } = command;

    // Business logic validation
    if (payload.quantity <= 0) {
      return {
        success: false,
        aggregateId: command.aggregateId,
        version: 0,
        events: [],
        errors: ["Quantity must be positive"],
      };
    }

    // Create trade created event
    return this.saveEvents(
      command.aggregateId,
      "Trade",
      0, // New aggregate
      "TRADE_CREATED",
      {
        userId: payload.userId,
        symbol: payload.symbol,
        side: payload.side,
        quantity: payload.quantity,
        price: payload.price,
        orderType: payload.orderType,
        isAutoSnipe: payload.isAutoSnipe,
        confidenceScore: payload.confidenceScore,
        status: "PENDING",
        createdAt: new Date(),
      },
      {
        userId: payload.userId,
        correlationId: command.metadata.correlationId,
      }
    );
  }
}

/**
 * Execute Trade Command Handler
 */
export class ExecuteTradeCommandHandler extends BaseCommandHandler<ExecuteTradeCommand> {
  protected getSupportedCommandType(): string {
    return "EXECUTE_TRADE";
  }

  async handle(command: ExecuteTradeCommand): Promise<CommandResult> {
    const { payload } = command;

    // Get current trade state from events
    const events = await eventStoreManager.getEventsForAggregate(command.aggregateId);
    const currentVersion = events.length;

    if (currentVersion === 0) {
      return {
        success: false,
        aggregateId: command.aggregateId,
        version: 0,
        events: [],
        errors: ["Trade not found"],
      };
    }

    // Check if trade is in valid state for execution
    const tradeCreatedEvent = events.find((e) => e.eventType === "TRADE_CREATED");
    if (!tradeCreatedEvent) {
      return {
        success: false,
        aggregateId: command.aggregateId,
        version: currentVersion,
        events: [],
        errors: ["Invalid trade state"],
      };
    }

    // Create trade executed event
    return this.saveEvents(
      command.aggregateId,
      "Trade",
      currentVersion,
      "TRADE_EXECUTED",
      {
        tradeId: command.aggregateId,
        executedPrice: payload.executedPrice,
        executedQuantity: payload.executedQuantity,
        executionTime: payload.executionTime,
        mexcOrderId: payload.mexcOrderId,
        status: "EXECUTED",
      },
      {
        correlationId: command.metadata.correlationId,
      }
    );
  }
}

/**
 * Cancel Trade Command Handler
 */
export class CancelTradeCommandHandler extends BaseCommandHandler<CancelTradeCommand> {
  protected getSupportedCommandType(): string {
    return "CANCEL_TRADE";
  }

  async handle(command: CancelTradeCommand): Promise<CommandResult> {
    const events = await eventStoreManager.getEventsForAggregate(command.aggregateId);
    const currentVersion = events.length;

    if (currentVersion === 0) {
      return {
        success: false,
        aggregateId: command.aggregateId,
        version: 0,
        events: [],
        errors: ["Trade not found"],
      };
    }

    // Check if trade can be cancelled
    const isAlreadyExecuted = events.some((e) => e.eventType === "TRADE_EXECUTED");
    if (isAlreadyExecuted) {
      return {
        success: false,
        aggregateId: command.aggregateId,
        version: currentVersion,
        events: [],
        errors: ["Cannot cancel executed trade"],
      };
    }

    return this.saveEvents(command.aggregateId, "Trade", currentVersion, "TRADE_CANCELLED", {
      tradeId: command.aggregateId,
      reason: command.payload.reason,
      status: "CANCELLED",
      cancelledAt: new Date(),
    });
  }
}

/**
 * Get Trade Query Handler
 */
export class GetTradeQueryHandler extends BaseQueryHandler<GetTradeQuery, TradeReadModel> {
  protected getSupportedQueryType(): string {
    return "GET_TRADE";
  }

  async handle(query: GetTradeQuery): Promise<QueryResult<TradeReadModel>> {
    const { tradeId } = query.parameters;

    const model = await readModelStore.get("Trade", tradeId);

    if (!model) {
      return {
        success: false,
        data: null as any,
        metadata: {
          executionTime: 0,
          cacheHit: false,
          timestamp: new Date(),
        },
        errors: ["Trade not found"],
      };
    }

    return {
      success: true,
      data: model.data as TradeReadModel,
      metadata: {
        executionTime: 0,
        cacheHit: false,
        timestamp: new Date(),
      },
    };
  }
}

/**
 * Get User Trades Query Handler
 */
export class GetUserTradesQueryHandler extends BaseQueryHandler<
  GetUserTradesQuery,
  TradeReadModel[]
> {
  protected getSupportedQueryType(): string {
    return "GET_USER_TRADES";
  }

  async handle(query: GetUserTradesQuery): Promise<QueryResult<TradeReadModel[]>> {
    const { userId, status, limit = 10, offset = 0 } = query.parameters;

    // Get all trades for user
    const allModels = await readModelStore.getAll("Trade", { userId });

    // Filter by status if provided
    let filteredModels = allModels;
    if (status) {
      filteredModels = allModels.filter(
        (model) => (model.data as TradeReadModel).status === status
      );
    }

    // Sort by creation date (newest first)
    filteredModels.sort(
      (a, b) => new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime()
    );

    // Apply pagination
    const total = filteredModels.length;
    const paginatedModels = filteredModels.slice(offset, offset + limit);
    const trades = paginatedModels.map((model) => model.data as TradeReadModel);

    return this.createPaginatedResult(trades, Math.floor(offset / limit) + 1, limit, total);
  }
}

/**
 * Get Trading Stats Query Handler
 */
export class GetTradingStatsQueryHandler extends BaseQueryHandler<
  GetTradingStatsQuery,
  TradingStatsReadModel
> {
  protected getSupportedQueryType(): string {
    return "GET_TRADING_STATS";
  }

  async handle(query: GetTradingStatsQuery): Promise<QueryResult<TradingStatsReadModel>> {
    const { userId, symbol, fromDate, toDate } = query.parameters;

    // Build filter
    const filter: any = {};
    if (userId) filter.userId = userId;
    if (symbol) filter.symbol = symbol;

    const statsModel = await readModelStore.get(
      "TradingStats",
      `${userId || "global"}_${symbol || "all"}`
    );

    if (!statsModel) {
      // Return empty stats if not found
      const emptyStats: TradingStatsReadModel = {
        id: `${userId || "global"}_${symbol || "all"}`,
        userId: userId || "global",
        symbol,
        totalTrades: 0,
        successfulTrades: 0,
        failedTrades: 0,
        totalVolume: 0,
        totalPnL: 0,
        winRate: 0,
        averageConfidence: 0,
        period: "all_time",
      };

      return {
        success: true,
        data: emptyStats,
        metadata: {
          executionTime: 0,
          cacheHit: false,
          timestamp: new Date(),
        },
      };
    }

    return {
      success: true,
      data: statsModel.data as TradingStatsReadModel,
      metadata: {
        executionTime: 0,
        cacheHit: false,
        timestamp: new Date(),
      },
    };
  }
}

/**
 * Trade Projection - Builds Trade Read Models from Events
 */
export class TradeProjection extends BaseReadModelProjection {
  constructor() {
    super("Trade", readModelStore);
  }

  async handle(event: DomainEvent): Promise<void> {
    if (event.aggregateType !== "Trade") return;

    switch (event.eventType) {
      case "TRADE_CREATED":
        await this.handleTradeCreated(event);
        break;
      case "TRADE_EXECUTED":
        await this.handleTradeExecuted(event);
        break;
      case "TRADE_CANCELLED":
        await this.handleTradeCancelled(event);
        break;
    }
  }

  private async handleTradeCreated(event: DomainEvent): Promise<void> {
    const trade: TradeReadModel = {
      id: event.aggregateId,
      userId: event.payload.userId,
      symbol: event.payload.symbol,
      side: event.payload.side,
      quantity: event.payload.quantity,
      price: event.payload.price,
      orderType: event.payload.orderType,
      status: "PENDING",
      isAutoSnipe: event.payload.isAutoSnipe,
      confidenceScore: event.payload.confidenceScore,
      createdAt: event.payload.createdAt,
      updatedAt: event.metadata.timestamp,
    };

    await this.saveModel({
      id: event.aggregateId,
      type: "Trade",
      data: trade,
      version: event.eventVersion,
      lastUpdated: event.metadata.timestamp,
    });
  }

  private async handleTradeExecuted(event: DomainEvent): Promise<void> {
    const existing = await this.getModel(event.aggregateId);
    if (!existing) return;

    const trade = existing.data as TradeReadModel;
    trade.status = "EXECUTED";
    trade.executedPrice = event.payload.executedPrice;
    trade.executedQuantity = event.payload.executedQuantity;
    trade.executionTime = event.payload.executionTime;
    trade.mexcOrderId = event.payload.mexcOrderId;
    trade.updatedAt = event.metadata.timestamp;

    await this.saveModel({
      ...existing,
      data: trade,
      version: event.eventVersion,
      lastUpdated: event.metadata.timestamp,
    });
  }

  private async handleTradeCancelled(event: DomainEvent): Promise<void> {
    const existing = await this.getModel(event.aggregateId);
    if (!existing) return;

    const trade = existing.data as TradeReadModel;
    trade.status = "CANCELLED";
    trade.updatedAt = event.metadata.timestamp;

    await this.saveModel({
      ...existing,
      data: trade,
      version: event.eventVersion,
      lastUpdated: event.metadata.timestamp,
    });
  }
}

/**
 * Trading Stats Projection - Builds Trading Statistics from Trade Events
 */
export class TradingStatsProjection extends BaseReadModelProjection {
  constructor() {
    super("TradingStats", readModelStore);
  }

  async handle(event: DomainEvent): Promise<void> {
    if (event.aggregateType !== "Trade") return;

    switch (event.eventType) {
      case "TRADE_CREATED":
        await this.updateStatsForTradeCreated(event);
        break;
      case "TRADE_EXECUTED":
        await this.updateStatsForTradeExecuted(event);
        break;
    }
  }

  private async updateStatsForTradeCreated(event: DomainEvent): Promise<void> {
    const statsId = `${event.payload.userId}_all`;
    const stats = await this.getModel(statsId);

    if (!stats) {
      const newStats: TradingStatsReadModel = {
        id: statsId,
        userId: event.payload.userId,
        totalTrades: 1,
        successfulTrades: 0,
        failedTrades: 0,
        totalVolume: 0,
        totalPnL: 0,
        winRate: 0,
        averageConfidence: event.payload.confidenceScore || 0,
        period: "all_time",
      };

      await this.saveModel({
        id: statsId,
        type: "TradingStats",
        data: newStats,
        version: 1,
        lastUpdated: event.metadata.timestamp,
      });
    } else {
      const statsData = stats.data as TradingStatsReadModel;
      statsData.totalTrades++;

      // Update average confidence
      const totalConfidence = statsData.averageConfidence * (statsData.totalTrades - 1);
      statsData.averageConfidence =
        (totalConfidence + (event.payload.confidenceScore || 0)) / statsData.totalTrades;

      await this.saveModel({
        ...stats,
        data: statsData,
        lastUpdated: event.metadata.timestamp,
      });
    }
  }

  private async updateStatsForTradeExecuted(event: DomainEvent): Promise<void> {
    // Get the original trade data to get userId
    const tradeEvents = await eventStoreManager.getEventsForAggregate(event.aggregateId);
    const createEvent = tradeEvents.find((e) => e.eventType === "TRADE_CREATED");
    if (!createEvent) return;

    const statsId = `${createEvent.payload.userId}_all`;
    const stats = await this.getModel(statsId);
    if (!stats) return;

    const statsData = stats.data as TradingStatsReadModel;
    statsData.successfulTrades++;
    statsData.totalVolume += event.payload.executedQuantity * event.payload.executedPrice;
    statsData.winRate = statsData.successfulTrades / statsData.totalTrades;
    statsData.lastTradeAt = event.payload.executionTime;

    await this.saveModel({
      ...stats,
      data: statsData,
      lastUpdated: event.metadata.timestamp,
    });
  }
}

/**
 * Initialize Trading CQRS
 */
export function initializeTradingCQRS(): void {
  // Register command handlers
  commandBus.registerHandler("CREATE_TRADE", new CreateTradeCommandHandler());
  commandBus.registerHandler("EXECUTE_TRADE", new ExecuteTradeCommandHandler());
  commandBus.registerHandler("CANCEL_TRADE", new CancelTradeCommandHandler());

  // Register query handlers
  queryBus.registerHandler("GET_TRADE", new GetTradeQueryHandler());
  queryBus.registerHandler("GET_USER_TRADES", new GetUserTradesQueryHandler());
  queryBus.registerHandler("GET_TRADING_STATS", new GetTradingStatsQueryHandler());

  // Initialize projections
  const tradeProjection = new TradeProjection();
  const statsProjection = new TradingStatsProjection();

  // Subscribe to events
  eventStoreManager.onAnyEvent(async (event) => {
    await tradeProjection.handle(event);
    await statsProjection.handle(event);
  });
}

/**
 * Trading Command Factory
 */
export class TradingCommandFactory {
  static createTrade(
    userId: string,
    symbol: string,
    side: "BUY" | "SELL",
    quantity: number,
    options: {
      price?: number;
      orderType?: "MARKET" | "LIMIT";
      isAutoSnipe?: boolean;
      confidenceScore?: number;
      correlationId?: string;
    } = {}
  ): CreateTradeCommand {
    const tradeId = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return CommandFactory.createCommand(
      "CREATE_TRADE",
      tradeId,
      {
        userId,
        symbol,
        side,
        quantity,
        price: options.price,
        orderType: options.orderType || "MARKET",
        isAutoSnipe: options.isAutoSnipe || false,
        confidenceScore: options.confidenceScore,
      },
      {
        userId,
        correlationId: options.correlationId,
      }
    ) as CreateTradeCommand;
  }

  static executeTrade(
    tradeId: string,
    executedPrice: number,
    executedQuantity: number,
    mexcOrderId: string,
    correlationId?: string
  ): ExecuteTradeCommand {
    return CommandFactory.createCommand(
      "EXECUTE_TRADE",
      tradeId,
      {
        tradeId,
        executedPrice,
        executedQuantity,
        executionTime: new Date(),
        mexcOrderId,
      },
      {
        correlationId,
      }
    ) as ExecuteTradeCommand;
  }

  static cancelTrade(tradeId: string, reason: string, correlationId?: string): CancelTradeCommand {
    return CommandFactory.createCommand(
      "CANCEL_TRADE",
      tradeId,
      {
        tradeId,
        reason,
      },
      {
        correlationId,
      }
    ) as CancelTradeCommand;
  }
}

/**
 * Trading Query Factory
 */
export class TradingQueryFactory {
  static getTrade(tradeId: string): GetTradeQuery {
    return QueryFactory.createQuery("GET_TRADE", { tradeId }) as GetTradeQuery;
  }

  static getUserTrades(
    userId: string,
    options: {
      status?: "PENDING" | "EXECUTED" | "CANCELLED" | "FAILED";
      limit?: number;
      offset?: number;
    } = {}
  ): GetUserTradesQuery {
    return QueryFactory.createQuery("GET_USER_TRADES", {
      userId,
      ...options,
    }) as GetUserTradesQuery;
  }

  static getTradingStats(
    userId?: string,
    symbol?: string,
    dateRange?: { fromDate: Date; toDate: Date }
  ): GetTradingStatsQuery {
    return QueryFactory.createQuery("GET_TRADING_STATS", {
      userId,
      symbol,
      ...dateRange,
    }) as GetTradingStatsQuery;
  }
}
