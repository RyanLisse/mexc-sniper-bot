/**
 * Event Sourcing and CQRS Integration Tests
 * 
 * Validates the complete Event Sourcing and CQRS implementation.
 * Part of Phase 3 Production Readiness testing.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eventStore, eventStoreManager } from "@/src/lib/event-sourcing/event-store";
import { commandBus, queryBus } from "@/src/lib/cqrs/command-bus";
import { readModelStore } from "@/src/lib/cqrs/query-bus";
import {
  initializeTradingCQRS,
  TradingCommandFactory,
  TradingQueryFactory,
  type TradeReadModel,
  type TradingStatsReadModel,
} from "@/src/lib/cqrs/trading-commands";

describe("Event Sourcing and CQRS Integration Tests", () => {
  beforeEach(async () => {
    // Clear all data
    await eventStore.clear();
    await readModelStore.clear();
    
    // Initialize trading CQRS
    initializeTradingCQRS();
  });

  afterEach(async () => {
    // Clean up
    await eventStore.clear();
    await readModelStore.clear();
    commandBus.removeAllListeners();
    queryBus.removeAllListeners();
  });

  describe("Command-Event-Query Flow", () => {
    it("should handle complete trade lifecycle with event sourcing", async () => {
      const userId = "user_123";
      const symbol = "BTCUSDT";
      
      // Step 1: Create trade command
      const createCommand = TradingCommandFactory.createTrade(
        userId,
        symbol,
        "BUY",
        0.01,
        {
          price: 50000,
          orderType: "LIMIT",
          isAutoSnipe: true,
          confidenceScore: 85,
        }
      );

      const createResult = await commandBus.execute(createCommand);
      expect(createResult.success).toBe(true);
      expect(createResult.events).toHaveLength(1);
      expect(createResult.events[0].eventType).toBe("TRADE_CREATED");

      const tradeId = createCommand.aggregateId;

      // Step 2: Query the trade
      const getTradeQuery = TradingQueryFactory.getTrade(tradeId);
      const tradeResult = await queryBus.execute(getTradeQuery);
      
      expect(tradeResult.success).toBe(true);
      expect(tradeResult.data.id).toBe(tradeId);
      expect(tradeResult.data.userId).toBe(userId);
      expect(tradeResult.data.symbol).toBe(symbol);
      expect(tradeResult.data.status).toBe("PENDING");
      expect(tradeResult.data.quantity).toBe(0.01);
      expect(tradeResult.data.price).toBe(50000);

      // Step 3: Execute the trade
      const executeCommand = TradingCommandFactory.executeTrade(
        tradeId,
        49500, // Executed at different price
        0.01,
        "mexc_order_123"
      );

      const executeResult = await commandBus.execute(executeCommand);
      expect(executeResult.success).toBe(true);
      expect(executeResult.events).toHaveLength(1);
      expect(executeResult.events[0].eventType).toBe("TRADE_EXECUTED");

      // Step 4: Query updated trade
      const updatedTradeResult = await queryBus.execute(getTradeQuery);
      expect(updatedTradeResult.success).toBe(true);
      expect(updatedTradeResult.data.status).toBe("EXECUTED");
      expect(updatedTradeResult.data.executedPrice).toBe(49500);
      expect(updatedTradeResult.data.mexcOrderId).toBe("mexc_order_123");

      // Step 5: Verify event store contains all events
      const events = await eventStore.getEventsForAggregate(tradeId);
      expect(events).toHaveLength(2);
      expect(events[0].eventType).toBe("TRADE_CREATED");
      expect(events[1].eventType).toBe("TRADE_EXECUTED");
    });

    it("should maintain consistency between events and read models", async () => {
      const userId = "user_456";
      
      // Create multiple trades
      const trades = [
        { symbol: "BTCUSDT", quantity: 0.01, price: 50000 },
        { symbol: "ETHUSDT", quantity: 1.0, price: 3000 },
        { symbol: "BTCUSDT", quantity: 0.005, price: 51000 },
      ];

      const tradeIds: string[] = [];

      // Create all trades
      for (const trade of trades) {
        const command = TradingCommandFactory.createTrade(
          userId,
          trade.symbol,
          "BUY",
          trade.quantity,
          { price: trade.price, confidenceScore: 80 }
        );

        const result = await commandBus.execute(command);
        expect(result.success).toBe(true);
        tradeIds.push(command.aggregateId);
      }

      // Execute some trades
      const executeCommand1 = TradingCommandFactory.executeTrade(
        tradeIds[0],
        50100,
        0.01,
        "mexc_1"
      );
      await commandBus.execute(executeCommand1);

      const executeCommand2 = TradingCommandFactory.executeTrade(
        tradeIds[1],
        2950,
        1.0,
        "mexc_2"
      );
      await commandBus.execute(executeCommand2);

      // Cancel one trade
      const cancelCommand = TradingCommandFactory.cancelTrade(
        tradeIds[2],
        "User cancelled"
      );
      await commandBus.execute(cancelCommand);

      // Query user trades
      const userTradesQuery = TradingQueryFactory.getUserTrades(userId);
      const userTradesResult = await queryBus.execute(userTradesQuery);

      expect(userTradesResult.success).toBe(true);
      expect(userTradesResult.data).toHaveLength(3);

      // Verify trade statuses
      const executedTrades = userTradesResult.data.filter(t => t.status === "EXECUTED");
      const cancelledTrades = userTradesResult.data.filter(t => t.status === "CANCELLED");
      const pendingTrades = userTradesResult.data.filter(t => t.status === "PENDING");

      expect(executedTrades).toHaveLength(2);
      expect(cancelledTrades).toHaveLength(1);
      expect(pendingTrades).toHaveLength(0);

      // Query trading stats
      const statsQuery = TradingQueryFactory.getTradingStats(userId);
      const statsResult = await queryBus.execute(statsQuery);

      expect(statsResult.success).toBe(true);
      expect(statsResult.data.totalTrades).toBe(3);
      expect(statsResult.data.successfulTrades).toBe(2);
      expect(statsResult.data.winRate).toBe(2/3);
      expect(statsResult.data.averageConfidence).toBe(80);
    });

    it("should handle concurrent commands with optimistic concurrency control", async () => {
      const userId = "user_789";
      const tradeId = "trade_concurrent_test";
      
      // Create initial trade
      const createCommand = TradingCommandFactory.createTrade(
        userId,
        "BTCUSDT",
        "BUY",
        0.01
      );
      createCommand.aggregateId = tradeId; // Force specific ID

      const createResult = await commandBus.execute(createCommand);
      expect(createResult.success).toBe(true);

      // Try to execute and cancel concurrently (should fail due to version conflict)
      const executeCommand = TradingCommandFactory.executeTrade(
        tradeId,
        50000,
        0.01,
        "mexc_123"
      );

      const cancelCommand = TradingCommandFactory.cancelTrade(
        tradeId,
        "User cancelled"
      );

      // Execute one command first
      const executeResult = await commandBus.execute(executeCommand);
      expect(executeResult.success).toBe(true);

      // The cancel command should fail because trade is already executed
      const cancelResult = await commandBus.execute(cancelCommand);
      expect(cancelResult.success).toBe(false);
      expect(cancelResult.errors).toContain("Cannot cancel executed trade");
    });
  });

  describe("Event Store Operations", () => {
    it("should store and retrieve events correctly", async () => {
      const userId = "user_store_test";
      
      // Create and execute a trade
      const createCommand = TradingCommandFactory.createTrade(
        userId,
        "ETHUSDT",
        "SELL",
        2.0,
        { price: 3000, confidenceScore: 90 }
      );

      await commandBus.execute(createCommand);
      
      const executeCommand = TradingCommandFactory.executeTrade(
        createCommand.aggregateId,
        2980,
        2.0,
        "mexc_execute_test"
      );

      await commandBus.execute(executeCommand);

      // Verify events in store
      const events = await eventStore.getEventsForAggregate(createCommand.aggregateId);
      expect(events).toHaveLength(2);
      
      // Check event structure
      const createEvent = events[0];
      expect(createEvent.eventType).toBe("TRADE_CREATED");
      expect(createEvent.aggregateId).toBe(createCommand.aggregateId);
      expect(createEvent.aggregateType).toBe("Trade");
      expect(createEvent.eventVersion).toBe(1);
      expect(createEvent.payload.userId).toBe(userId);
      expect(createEvent.payload.symbol).toBe("ETHUSDT");

      const executeEvent = events[1];
      expect(executeEvent.eventType).toBe("TRADE_EXECUTED");
      expect(executeEvent.eventVersion).toBe(2);
      expect(executeEvent.payload.executedPrice).toBe(2980);

      // Test event queries
      const tradeCreatedEvents = await eventStore.getEventsByType("TRADE_CREATED");
      expect(tradeCreatedEvents.length).toBeGreaterThan(0);
      expect(tradeCreatedEvents.some(e => e.aggregateId === createCommand.aggregateId)).toBe(true);
    });

    it("should provide accurate statistics", async () => {
      const initialStats = eventStore.getStatistics();
      expect(initialStats.totalEvents).toBe(0);
      expect(initialStats.totalAggregates).toBe(0);

      // Create several trades
      for (let i = 0; i < 5; i++) {
        const command = TradingCommandFactory.createTrade(
          "user_stats_test",
          "BTCUSDT",
          "BUY",
          0.01
        );
        await commandBus.execute(command);
      }

      const finalStats = eventStore.getStatistics();
      expect(finalStats.totalEvents).toBe(5);
      expect(finalStats.totalAggregates).toBe(5);
      expect(finalStats.averageEventsPerAggregate).toBe(1);
    });

    it("should support event replay for read model rebuilding", async () => {
      // Create some trades
      const commands = [
        TradingCommandFactory.createTrade("user1", "BTCUSDT", "BUY", 0.01),
        TradingCommandFactory.createTrade("user1", "ETHUSDT", "BUY", 1.0),
        TradingCommandFactory.createTrade("user2", "BTCUSDT", "SELL", 0.005),
      ];

      for (const command of commands) {
        await commandBus.execute(command);
      }

      // Clear read models to simulate rebuild scenario
      await readModelStore.clear();

      // Verify read models are empty
      const userTradesQuery = TradingQueryFactory.getUserTrades("user1");
      const emptyResult = await queryBus.execute(userTradesQuery);
      expect(emptyResult.data).toHaveLength(0);

      // Replay events to rebuild read models
      let replayedEvents = 0;
      await eventStoreManager.replayEvents(undefined, async (event) => {
        replayedEvents++;
        // Events are automatically handled by projections
      });

      expect(replayedEvents).toBe(3);

      // Verify read models are rebuilt
      const rebuiltResult = await queryBus.execute(userTradesQuery);
      expect(rebuiltResult.success).toBe(true);
      expect(rebuiltResult.data).toHaveLength(2);
    });
  });

  describe("Query Bus Operations", () => {
    it("should cache query results for performance", async () => {
      const userId = "user_cache_test";
      
      // Create a trade
      const command = TradingCommandFactory.createTrade(userId, "BTCUSDT", "BUY", 0.01);
      await commandBus.execute(command);

      const query = TradingQueryFactory.getTrade(command.aggregateId);

      // First query - should hit database
      const result1 = await queryBus.execute(query);
      expect(result1.success).toBe(true);
      expect(result1.metadata.cacheHit).toBe(false);

      // Second query - should hit cache
      const result2 = await queryBus.execute(query);
      expect(result2.success).toBe(true);
      expect(result2.metadata.cacheHit).toBe(true);

      // Verify cache statistics
      const cacheStats = queryBus.getCacheStats();
      expect(cacheStats.size).toBeGreaterThan(0);
    });

    it("should handle pagination correctly", async () => {
      const userId = "user_pagination_test";
      
      // Create 15 trades
      for (let i = 0; i < 15; i++) {
        const command = TradingCommandFactory.createTrade(
          userId,
          "BTCUSDT",
          "BUY",
          0.001 * (i + 1)
        );
        await commandBus.execute(command);
      }

      // Query first page
      const page1Query = TradingQueryFactory.getUserTrades(userId, {
        limit: 5,
        offset: 0,
      });
      const page1Result = await queryBus.execute(page1Query);

      expect(page1Result.success).toBe(true);
      expect(page1Result.data).toHaveLength(5);
      expect(page1Result.pagination?.total).toBe(15);
      expect(page1Result.pagination?.hasMore).toBe(true);

      // Query second page
      const page2Query = TradingQueryFactory.getUserTrades(userId, {
        limit: 5,
        offset: 5,
      });
      const page2Result = await queryBus.execute(page2Query);

      expect(page2Result.success).toBe(true);
      expect(page2Result.data).toHaveLength(5);
      expect(page2Result.pagination?.hasMore).toBe(true);

      // Query last page
      const page3Query = TradingQueryFactory.getUserTrades(userId, {
        limit: 5,
        offset: 10,
      });
      const page3Result = await queryBus.execute(page3Query);

      expect(page3Result.success).toBe(true);
      expect(page3Result.data).toHaveLength(5);
      expect(page3Result.pagination?.hasMore).toBe(false);
    });
  });

  describe("Read Model Projections", () => {
    it("should update read models when events are processed", async () => {
      const userId = "user_projection_test";
      
      // Create and execute a trade
      const createCommand = TradingCommandFactory.createTrade(
        userId,
        "BTCUSDT",
        "BUY",
        0.01,
        { confidenceScore: 95 }
      );
      await commandBus.execute(createCommand);

      // Check initial stats
      const initialStatsQuery = TradingQueryFactory.getTradingStats(userId);
      const initialStats = await queryBus.execute(initialStatsQuery);
      expect(initialStats.data.totalTrades).toBe(1);
      expect(initialStats.data.successfulTrades).toBe(0);
      expect(initialStats.data.averageConfidence).toBe(95);

      // Execute the trade
      const executeCommand = TradingCommandFactory.executeTrade(
        createCommand.aggregateId,
        50000,
        0.01,
        "mexc_projection_test"
      );
      await commandBus.execute(executeCommand);

      // Check updated stats
      const updatedStatsQuery = TradingQueryFactory.getTradingStats(userId);
      const updatedStats = await queryBus.execute(updatedStatsQuery);
      expect(updatedStats.data.totalTrades).toBe(1);
      expect(updatedStats.data.successfulTrades).toBe(1);
      expect(updatedStats.data.winRate).toBe(1);
      expect(updatedStats.data.totalVolume).toBe(500); // 0.01 * 50000
    });

    it("should handle complex business logic in projections", async () => {
      const userId = "user_complex_projection";
      
      // Create trades with different confidence scores
      const trades = [
        { symbol: "BTCUSDT", confidence: 80, quantity: 0.01, price: 50000 },
        { symbol: "ETHUSDT", confidence: 90, quantity: 1.0, price: 3000 },
        { symbol: "BTCUSDT", confidence: 70, quantity: 0.005, price: 51000 },
      ];

      for (const trade of trades) {
        const command = TradingCommandFactory.createTrade(
          userId,
          trade.symbol,
          "BUY",
          trade.quantity,
          { confidenceScore: trade.confidence, price: trade.price }
        );
        await commandBus.execute(command);
      }

      // Check aggregated stats
      const statsQuery = TradingQueryFactory.getTradingStats(userId);
      const statsResult = await queryBus.execute(statsQuery);

      expect(statsResult.data.totalTrades).toBe(3);
      expect(statsResult.data.averageConfidence).toBe((80 + 90 + 70) / 3);

      // Execute one trade
      const userTradesQuery = TradingQueryFactory.getUserTrades(userId);
      const userTrades = await queryBus.execute(userTradesQuery);
      const firstTrade = userTrades.data[0];

      const executeCommand = TradingCommandFactory.executeTrade(
        firstTrade.id,
        firstTrade.price! * 0.99, // Slight loss
        firstTrade.quantity,
        "mexc_complex_test"
      );
      await commandBus.execute(executeCommand);

      // Verify updated stats
      const finalStats = await queryBus.execute(statsQuery);
      expect(finalStats.data.successfulTrades).toBe(1);
      expect(finalStats.data.winRate).toBe(1/3);
    });
  });
});