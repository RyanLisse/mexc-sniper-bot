# 🎯 Pure TypeScript Sniping Bot Implementation

## 📁 Project Structure

```
sniping-bot/
├── src/
│   ├── services/
│   │   ├── calendar/          # Strategy 1: Calendar monitoring
│   │   ├── detector/          # Strategy 2: Adaptive polling & detection
│   │   ├── executor/          # Strategy 2: High-precision execution
│   │   └── tracker/           # Strategy 3: Post-snipe tracking
│   ├── database/
│   │   ├── schema.ts          # Database schema with Drizzle ORM
│   │   ├── migrations/        # SQL migrations
│   │   └── connection.ts      # Database connection
│   ├── api/
│   │   ├── routes/           # Express.js API routes
│   │   └── middleware/       # Request validation & auth
│   ├── types/                # Shared TypeScript types & Zod schemas
│   ├── utils/                # Utilities & helpers
│   └── app.ts                # Main application entry point
├── package.json
├── tsconfig.json
└── docker-compose.yml        # PostgreSQL for local dev
```

## 📦 Dependencies

```json
{
  "name": "sniping-bot",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/app.ts",
    "build": "tsc",
    "start": "node dist/app.js",
    "db:generate": "drizzle-kit generate:pg",
    "db:migrate": "tsx src/database/migrate.ts",
    "test": "vitest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "drizzle-orm": "^0.29.0",
    "postgres": "^3.4.3",
    "zod": "^3.22.4",
    "node-cron": "^3.0.3",
    "ws": "^8.16.0",
    "axios": "^1.6.2",
    "dotenv": "^16.3.1",
    "helmet": "^7.1.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.5",
    "@types/ws": "^8.5.10",
    "@types/cors": "^2.8.17",
    "tsx": "^4.6.2",
    "typescript": "^5.3.3",
    "vitest": "^1.1.0",
    "drizzle-kit": "^0.20.7"
  }
}
```

## 🗄️ Database Schema (Drizzle ORM)

```typescript
// src/database/schema.ts
import { pgTable, text, timestamp, serial, decimal, integer, real, index } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Enums for type safety
export const listingStatusEnum = ['PENDING', 'READY', 'SNIPED', 'MISSED'] as const;
export const snipeStatusEnum = ['EXECUTED', 'FAILED', 'TIMED_OUT'] as const;
export const sideEnum = ['BUY', 'SELL'] as const;

// Tables
export const listings = pgTable('listings', {
  vcoinId: text('vcoin_id').primaryKey(),
  symbol: text('symbol').notNull(),
  projectName: text('project_name'),
  scheduledLaunchTime: timestamp('scheduled_launch_time', { withTimezone: true }).notNull(),
  discoveredAt: timestamp('discovered_at', { withTimezone: true }).defaultNow().notNull(),
  status: text('status', { enum: listingStatusEnum }).default('PENDING').notNull(),
}, (table) => ({
  statusIdx: index('idx_listings_status').on(table.status),
  launchTimeIdx: index('idx_listings_launch_time').on(table.scheduledLaunchTime),
}));

export const targets = pgTable('targets', {
  symbol: text('symbol').primaryKey(),
  vcoinId: text('vcoin_id').notNull().references(() => listings.vcoinId),
  projectName: text('project_name'),
  launchTime: timestamp('launch_time', { withTimezone: true }).notNull(),
  priceScale: integer('price_scale').notNull(),
  quantityScale: integer('quantity_scale').notNull(),
  hoursAdvanceNotice: real('hours_advance_notice').notNull(),
  pattern: text('pattern').notNull(),
  discoveredAt: timestamp('discovered_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  launchTimeIdx: index('idx_targets_launch_time').on(table.launchTime),
}));

export const snipes = pgTable('snipes', {
  id: serial('id').primaryKey(),
  targetSymbol: text('target_symbol').notNull().references(() => targets.symbol),
  exchangeOrderId: text('exchange_order_id'),
  status: text('status', { enum: snipeStatusEnum }).notNull(),
  side: text('side', { enum: sideEnum }).default('BUY').notNull(),
  executedAt: timestamp('executed_at', { withTimezone: true }).defaultNow().notNull(),
  requestedQty: decimal('requested_qty'),
  executedQty: decimal('executed_qty'),
  avgPrice: decimal('avg_price'),
  pnl1m: decimal('pnl_1m'),
  pnl5m: decimal('pnl_5m'),
  pnl15m: decimal('pnl_15m'),
  pnl1h: decimal('pnl_1h'),
  notes: text('notes'),
}, (table) => ({
  targetSymbolIdx: index('idx_snipes_target_symbol').on(table.targetSymbol),
  executedAtIdx: index('idx_snipes_executed_at').on(table.executedAt),
}));

// Zod schemas from Drizzle tables
export const insertListingSchema = createInsertSchema(listings);
export const selectListingSchema = createSelectSchema(listings);
export const insertTargetSchema = createInsertSchema(targets);
export const selectTargetSchema = createSelectSchema(targets);
export const insertSnipeSchema = createInsertSchema(snipes);
export const selectSnipeSchema = createSelectSchema(snipes);

// Export types
export type Listing = z.infer<typeof selectListingSchema>;
export type NewListing = z.infer<typeof insertListingSchema>;
export type Target = z.infer<typeof selectTargetSchema>;
export type NewTarget = z.infer<typeof insertTargetSchema>;
export type Snipe = z.infer<typeof selectSnipeSchema>;
export type NewSnipe = z.infer<typeof insertSnipeSchema>;
```

## 🔗 Database Connection

```typescript
// src/database/connection.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/sniping_bot';

// Create connection
const sql = postgres(connectionString, {
  max: 20,
  idle_timeout: 20,
  connect_timeout: 60,
});

export const db = drizzle(sql, { schema });

// Health check
export async function checkConnection(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Graceful shutdown
export async function closeConnection(): Promise<void> {
  await sql.end();
}
```

## 📊 Shared Types & Validation

```typescript
// src/types/api.ts
import { z } from 'zod';

// API Response wrappers
export const ApiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
    timestamp: z.string().datetime(),
  });

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
};

// Polling configuration
export const PollingTierSchema = z.object({
  name: z.string(),
  minTimeUntilLaunch: z.number().positive(), // milliseconds
  maxTimeUntilLaunch: z.number().positive(), // milliseconds
  intervalMs: z.number().positive(),
});

export type PollingTier = z.infer<typeof PollingTierSchema>;

// MEXC API responses
export const MexcSymbolSchema = z.object({
  symbol: z.string(),
  status: z.string(),
  baseAsset: z.string(),
  quoteAsset: z.string(),
  baseAssetPrecision: z.number(),
  quotePrecision: z.number(),
  quoteOrderQtyMarketAllowed: z.boolean(),
  baseCommissionPrecision: z.number(),
  quoteCommissionPrecision: z.number(),
  orderTypes: z.array(z.string()),
  quoteAmountPrecision: z.number(),
  baseSizePrecision: z.number(),
  permissions: z.array(z.string()),
  defaultSelfTradePreventionMode: z.string(),
  allowedSelfTradePreventionModes: z.array(z.string()),
});

export type MexcSymbol = z.infer<typeof MexcSymbolSchema>;

// Request/Response schemas
export const MonitorCalendarRequestSchema = z.object({
  hours: z.number().min(1).max(168).default(24),
});

export const ExecuteSnipeRequestSchema = z.object({
  symbol: z.string().min(1),
  quantity: z.number().positive(),
  side: z.enum(['BUY', 'SELL']).default('BUY'),
  bufferMs: z.number().min(0).max(5000).default(500),
});

export const UpdatePnLRequestSchema = z.object({
  snipeId: z.number().positive(),
  currentPrice: z.number().positive(),
  timeframe: z.enum(['1m', '5m', '15m', '1h']),
});
```

## 🎯 Strategy 1: Calendar Service

```typescript
// src/services/calendar/CalendarService.ts
import { eq } from 'drizzle-orm';
import { db } from '../../database/connection';
import { listings, insertListingSchema, type NewListing } from '../../database/schema';
import { z } from 'zod';
import axios from 'axios';

export class CalendarService {
  private readonly mexcCalendarUrl = 'https://api.mexc.com/api/v3/calendar';

  async monitorCalendar(hours: number = 24): Promise<{
    newListings: number;
    totalListings: number;
  }> {
    try {
      const calendarData = await this.fetchMexcCalendar(hours);
      let newListings = 0;

      for (const listing of calendarData) {
        const validatedListing = insertListingSchema.parse({
          vcoinId: listing.vcoin_id,
          symbol: listing.symbol,
          projectName: listing.project_name,
          scheduledLaunchTime: new Date(listing.scheduled_launch_time),
        });

        try {
          await db.insert(listings).values(validatedListing).onConflictDoNothing();
          newListings++;
        } catch (error) {
          // Conflict - listing already exists
          console.log(`Listing ${listing.symbol} already exists`);
        }
      }

      const totalResult = await db
        .select({ count: listings.vcoinId })
        .from(listings)
        .where(eq(listings.status, 'PENDING'));

      return {
        newListings,
        totalListings: totalResult.length,
      };
    } catch (error) {
      throw new Error(`Failed to monitor calendar: ${error.message}`);
    }
  }

  async getPendingListings() {
    try {
      return await db
        .select()
        .from(listings)
        .where(eq(listings.status, 'PENDING'))
        .orderBy(listings.scheduledLaunchTime);
    } catch (error) {
      throw new Error(`Failed to get pending listings: ${error.message}`);
    }
  }

  async updateListingStatus(vcoinId: string, status: 'PENDING' | 'READY' | 'SNIPED' | 'MISSED') {
    try {
      await db
        .update(listings)
        .set({ status })
        .where(eq(listings.vcoinId, vcoinId));
    } catch (error) {
      throw new Error(`Failed to update listing status: ${error.message}`);
    }
  }

  private async fetchMexcCalendar(hours: number): Promise<any[]> {
    try {
      // Mock implementation - replace with actual MEXC calendar API call
      const response = await axios.get(this.mexcCalendarUrl, {
        params: { hours },
        timeout: 30000,
      });

      // Validate response structure
      const CalendarResponseSchema = z.array(z.object({
        vcoin_id: z.string(),
        symbol: z.string(),
        project_name: z.string().optional(),
        scheduled_launch_time: z.string(),
      }));

      return CalendarResponseSchema.parse(response.data);
    } catch (error) {
      console.error('Failed to fetch MEXC calendar:', error);
      return []; // Return empty array on failure
    }
  }
}
```

## 🔍 Strategy 2: Detector Service

```typescript
// src/services/detector/DetectorService.ts
import { eq } from 'drizzle-orm';
import { db } from '../../database/connection';
import { listings, targets, insertTargetSchema } from '../../database/schema';
import { type PollingTier, MexcSymbolSchema } from '../../types/api';
import axios from 'axios';
import { z } from 'zod';

export class DetectorService {
  private readonly pollingTiers: PollingTier[] = [
    {
      name: 'DISTANT',
      minTimeUntilLaunch: 60 * 60 * 1000, // 1 hour
      maxTimeUntilLaunch: Infinity,
      intervalMs: 5 * 60 * 1000, // 5 minutes
    },
    {
      name: 'APPROACHING',
      minTimeUntilLaunch: 10 * 60 * 1000, // 10 minutes
      maxTimeUntilLaunch: 60 * 60 * 1000, // 1 hour
      intervalMs: 30 * 1000, // 30 seconds
    },
    {
      name: 'IMMINENT',
      minTimeUntilLaunch: 0,
      maxTimeUntilLaunch: 10 * 60 * 1000, // 10 minutes
      intervalMs: 2 * 1000, // 2 seconds
    },
  ];

  private activeMonitors = new Map<string, NodeJS.Timeout>();
  private mexcSymbolsCache: any[] = [];
  private lastSymbolsFetch = 0;
  private readonly symbolsCacheMs = 5000; // 5 second cache

  async startAdaptiveDetection(): Promise<{
    message: string;
    activeTiers: string[];
  }> {
    try {
      const pendingListings = await db
        .select()
        .from(listings)
        .where(eq(listings.status, 'PENDING'));

      const activeTiers: string[] = [];

      // Group listings by tier
      const tierGroups = new Map<string, typeof pendingListings>();

      for (const listing of pendingListings) {
        const timeUntilLaunch = new Date(listing.scheduledLaunchTime).getTime() - Date.now();
        const tier = this.pollingTiers.find(
          (t) => timeUntilLaunch >= t.minTimeUntilLaunch && timeUntilLaunch < t.maxTimeUntilLaunch
        );

        if (tier) {
          if (!tierGroups.has(tier.name)) {
            tierGroups.set(tier.name, []);
            activeTiers.push(tier.name);
          }
          tierGroups.get(tier.name)!.push(listing);
        }
      }

      // Start monitoring for each tier
      for (const [tierName, groupListings] of tierGroups) {
        const tier = this.pollingTiers.find((t) => t.name === tierName)!;
        this.startTierMonitoring(tier, groupListings);
      }

      return {
        message: `Started adaptive detection for ${pendingListings.length} listings`,
        activeTiers,
      };
    } catch (error) {
      throw new Error(`Failed to start adaptive detection: ${error.message}`);
    }
  }

  async detectReadyStates(): Promise<{ newTargets: number }> {
    try {
      const pendingListings = await db
        .select()
        .from(listings)
        .where(eq(listings.status, 'PENDING'));

      const mexcSymbols = await this.fetchMexcSymbols();
      let newTargets = 0;

      for (const listing of pendingListings) {
        const isReady = this.checkIfTokenReady(listing.symbol, mexcSymbols);

        if (isReady) {
          const symbolInfo = mexcSymbols.find((s) => s.symbol === listing.symbol);
          if (symbolInfo) {
            const newTarget = insertTargetSchema.parse({
              symbol: listing.symbol,
              vcoinId: listing.vcoinId,
              projectName: listing.projectName,
              launchTime: listing.scheduledLaunchTime,
              priceScale: symbolInfo.quotePrecision,
              quantityScale: symbolInfo.baseAssetPrecision,
              hoursAdvanceNotice: this.calculateAdvanceNotice(listing.scheduledLaunchTime),
              pattern: this.generatePattern(symbolInfo),
            });

            try {
              await db.insert(targets).values(newTarget).onConflictDoNothing();
              await db
                .update(listings)
                .set({ status: 'READY' })
                .where(eq(listings.vcoinId, listing.vcoinId));
              newTargets++;
            } catch (error) {
              console.error(`Failed to create target for ${listing.symbol}:`, error);
            }
          }
        }
      }

      return { newTargets };
    } catch (error) {
      throw new Error(`Failed to detect ready states: ${error.message}`);
    }
  }

  stopDetection(): void {
    for (const [tierName, timeout] of this.activeMonitors) {
      clearTimeout(timeout);
      console.log(`Stopped monitoring for tier: ${tierName}`);
    }
    this.activeMonitors.clear();
  }

  private startTierMonitoring(tier: PollingTier, listings: any[]): void {
    const monitorKey = `${tier.name}_${Date.now()}`;

    const monitor = () => {
      this.detectReadyStates().catch(console.error);

      // Schedule next check
      const timeout = setTimeout(monitor, tier.intervalMs);
      this.activeMonitors.set(monitorKey, timeout);
    };

    // Start monitoring
    monitor();
  }

  private async fetchMexcSymbols(): Promise<any[]> {
    const now = Date.now();

    // Use cache if fresh
    if (now - this.lastSymbolsFetch < this.symbolsCacheMs && this.mexcSymbolsCache.length > 0) {
      return this.mexcSymbolsCache;
    }

    try {
      const response = await axios.get('https://api.mexc.com/api/v3/exchangeInfo', {
        timeout: 10000,
      });

      const ExchangeInfoSchema = z.object({
        symbols: z.array(MexcSymbolSchema),
      });

      const validated = ExchangeInfoSchema.parse(response.data);
      this.mexcSymbolsCache = validated.symbols;
      this.lastSymbolsFetch = now;

      return this.mexcSymbolsCache;
    } catch (error) {
      console.error('Failed to fetch MEXC symbols:', error);
      return this.mexcSymbolsCache; // Return cached data on error
    }
  }

  private checkIfTokenReady(symbol: string, mexcSymbols: any[]): boolean {
    return mexcSymbols.some((s) => s.symbol === symbol && s.status === 'TRADING');
  }

  private calculateAdvanceNotice(launchTime: Date): number {
    return (Date.now() - new Date(launchTime).getTime()) / (1000 * 60 * 60);
  }

  private generatePattern(symbolInfo: any): string {
    return `sts:${symbolInfo.quotePrecision},st:${symbolInfo.quotePrecision},tt:${symbolInfo.baseAssetPrecision}`;
  }
}
```

## ⚡ Strategy 2: Executor Service

```typescript
// src/services/executor/ExecutorService.ts
import { eq } from 'drizzle-orm';
import { db } from '../../database/connection';
import { targets, snipes, insertSnipeSchema } from '../../database/schema';
import { z } from 'zod';

export class ExecutorService {
  async executeSnipe(params: {
    symbol: string;
    quantity: number;
    side: 'BUY' | 'SELL';
    bufferMs: number;
  }): Promise<{
    success: boolean;
    orderId?: string;
    error?: string;
    executionTime: number;
  }> {
    const { symbol, quantity, side, bufferMs } = params;

    try {
      // Get target info
      const target = await db
        .select()
        .from(targets)
        .where(eq(targets.symbol, symbol))
        .limit(1);

      if (target.length === 0) {
        throw new Error(`Target not found: ${symbol}`);
      }

      const targetInfo = target[0];
      const launchTime = new Date(targetInfo.launchTime).getTime();
      const currentTime = Date.now();
      const timeUntilLaunch = launchTime - currentTime;

      // High-precision timing
      if (timeUntilLaunch > bufferMs) {
        const sleepDuration = timeUntilLaunch - bufferMs;
        await this.sleep(sleepDuration);
      }

      // Spin loop for precise timing
      const startSpin = Date.now();
      while (Date.now() < launchTime) {
        // Safety break after 10 seconds
        if (Date.now() - startSpin > 10000) {
          break;
        }
      }

      const executionStart = performance.now();

      try {
        // Execute the actual trade
        const result = await this.executeTrade(symbol, quantity, side);
        const executionTime = performance.now() - executionStart;

        // Log successful execution
        const snipeRecord = insertSnipeSchema.parse({
          targetSymbol: symbol,
          exchangeOrderId: result.orderId,
          status: 'EXECUTED',
          side,
          requestedQty: quantity.toString(),
          executedQty: result.executedQty.toString(),
          avgPrice: result.avgPrice.toString(),
        });

        await db.insert(snipes).values(snipeRecord);

        return {
          success: true,
          orderId: result.orderId,
          executionTime,
        };
      } catch (error) {
        const executionTime = performance.now() - executionStart;

        // Log failed attempt
        const failedSnipe = insertSnipeSchema.parse({
          targetSymbol: symbol,
          status: 'FAILED',
          side,
          requestedQty: quantity.toString(),
          notes: error.message,
        });

        await db.insert(snipes).values(failedSnipe);

        return {
          success: false,
          error: error.message,
          executionTime,
        };
      }
    } catch (error) {
      throw new Error(`Failed to execute snipe: ${error.message}`);
    }
  }

  private async executeTrade(symbol: string, quantity: number, side: string) {
    // Mock implementation - replace with actual MEXC trading API
    const mockExecutionDelay = Math.random() * 50; // 0-50ms mock execution time
    await this.sleep(mockExecutionDelay);

    // Simulate potential failure
    if (Math.random() < 0.05) { // 5% failure rate
      throw new Error('Order execution failed - insufficient liquidity');
    }

    return {
      orderId: `MEXC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      executedQty: quantity * (0.95 + Math.random() * 0.1), // 95-105% fill
      avgPrice: Math.random() * 100, // Mock price
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

## 📊 Strategy 3: Tracker Service

```typescript
// src/services/tracker/TrackerService.ts
import { eq, sql, desc, asc } from 'drizzle-orm';
import { db } from '../../database/connection';
import { snipes } from '../../database/schema';
import WebSocket from 'ws';

export class TrackerService {
  private activeTrackers = new Map<number, WebSocket>();

  async startPositionTracking(snipeId: number): Promise<{ message: string }> {
    try {
      const snipe = await db
        .select()
        .from(snipes)
        .where(eq(snipes.id, snipeId))
        .limit(1);

      if (snipe.length === 0 || snipe[0].status !== 'EXECUTED') {
        throw new Error('Executed snipe not found');
      }

      const snipeRecord = snipe[0];
      await this.startPriceMonitoring(
        snipeRecord.targetSymbol,
        parseFloat(snipeRecord.avgPrice || '0'),
        snipeId
      );

      return { message: `Started tracking position for ${snipeRecord.targetSymbol}` };
    } catch (error) {
      throw new Error(`Failed to start position tracking: ${error.message}`);
    }
  }

  async updatePnL(params: {
    snipeId: number;
    currentPrice: number;
    timeframe: '1m' | '5m' | '15m' | '1h';
  }): Promise<{ pnl: number }> {
    const { snipeId, currentPrice, timeframe } = params;

    try {
      const snipe = await db
        .select()
        .from(snipes)
        .where(eq(snipes.id, snipeId))
        .limit(1);

      if (snipe.length === 0) {
        throw new Error('Snipe not found');
      }

      const snipeRecord = snipe[0];
      const entryPrice = parseFloat(snipeRecord.avgPrice || '0');
      const pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;

      // Update the appropriate PnL column
      const updateData: any = {};
      updateData[`pnl${timeframe.replace('m', 'M').replace('h', 'H')}`] = pnlPercent.toString();

      await db.update(snipes).set(updateData).where(eq(snipes.id, snipeId));

      return { pnl: pnlPercent };
    } catch (error) {
      throw new Error(`Failed to update PnL: ${error.message}`);
    }
  }

  async getPerformanceAnalytics(): Promise<{
    totalSnipes: number;
    successRate: number;
    avgPnL1m: number;
    avgPnL5m: number;
    avgPnL15m: number;
    avgPnL1h: number;
    bestPerformer: any;
    worstPerformer: any;
  }> {
    try {
      // Get overall statistics
      const analytics = await db
        .select({
          totalSnipes: sql<number>`count(*)`,
          executedSnipes: sql<number>`count(case when status = 'EXECUTED' then 1 end)`,
          avgPnL1m: sql<number>`avg(${snipes.pnl1m}::numeric)`,
          avgPnL5m: sql<number>`avg(${snipes.pnl5m}::numeric)`,
          avgPnL15m: sql<number>`avg(${snipes.pnl15m}::numeric)`,
          avgPnL1h: sql<number>`avg(${snipes.pnl1h}::numeric)`,
        })
        .from(snipes);

      // Get best performer
      const bestPerformer = await db
        .select({
          targetSymbol: snipes.targetSymbol,
          pnl1h: snipes.pnl1h,
        })
        .from(snipes)
        .where(sql`${snipes.pnl1h} IS NOT NULL`)
        .orderBy(desc(snipes.pnl1h))
        .limit(1);

      // Get worst performer
      const worstPerformer = await db
        .select({
          targetSymbol: snipes.targetSymbol,
          pnl1h: snipes.pnl1h,
        })
        .from(snipes)
        .where(sql`${snipes.pnl1h} IS NOT NULL`)
        .orderBy(asc(snipes.pnl1h))
        .limit(1);

      const stats = analytics[0];

      return {
        totalSnipes: stats.totalSnipes,
        successRate: (stats.executedSnipes / stats.totalSnipes) * 100,
        avgPnL1m: stats.avgPnL1m || 0,
        avgPnL5m: stats.avgPnL5m || 0,
        avgPnL15m: stats.avgPnL15m || 0,
        avgPnL1h: stats.avgPnL1h || 0,
        bestPerformer: bestPerformer[0] || null,
        worstPerformer: worstPerformer[0] || null,
      };
    } catch (error) {
      throw new Error(`Failed to get performance analytics: ${error.message}`);
    }
  }

  stopPositionTracking(snipeId: number): void {
    const ws = this.activeTrackers.get(snipeId);
    if (ws) {
      ws.close();
      this.activeTrackers.delete(snipeId);
    }
  }

  stopAllTracking(): void {
    for (const [snipeId, ws] of this.activeTrackers) {
      ws.close();
    }
    this.activeTrackers.clear();
  }

  private async startPriceMonitoring(symbol: string, entryPrice: number, snipeId: number): Promise<void> {
    try {
      // Mock WebSocket connection to MEXC
      const ws = new WebSocket(`wss://wbs.mexc.com/ws`);

      ws.on('open', () => {
        // Subscribe to symbol price updates
        ws.send(JSON.stringify({
          method: 'SUBSCRIPTION',
          params: [`spot@public.kline.v3.api@${symbol}@Min1`],
          id: snipeId,
        }));
      });

      ws.on('message', async (data: WebSocket.Data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.d && parsed.d.c) {
            const currentPrice = parseFloat(parsed.d.c);
            await this.schedulePnLUpdates(snipeId, currentPrice);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for snipe ${snipeId}:`, error);
        this.activeTrackers.delete(snipeId);
      });

      ws.on('close', () => {
        this.activeTrackers.delete(snipeId);
      });

      this.activeTrackers.set(snipeId, ws);

      // Schedule P&L updates at specific intervals
      this.schedulePnLUpdateTimeouts(snipeId);
    } catch (error) {
      console.error(`Failed to start price monitoring for snipe ${snipeId}:`, error);
    }
  }

  private schedulePnLUpdateTimeouts(snipeId: number): void {
    // Schedule P&L calculations at specific intervals
    setTimeout(() => this.updatePnLFromMarket(snipeId, '1m'), 60 * 1000);
    setTimeout(() => this.updatePnLFromMarket(snipeId, '5m'), 5 * 60 * 1000);
    setTimeout(() => this.updatePnLFromMarket(snipeId, '15m'), 15 * 60 * 1000);
    setTimeout(() => this.updatePnLFromMarket(snipeId, '1h'), 60 * 60 * 1000);
  }

  private async updatePnLFromMarket(snipeId: number, timeframe: '1m' | '5m' | '15m' | '1h'): Promise<void> {
    try {
      // Get current market price
      const currentPrice = await this.getCurrentMarketPrice(snipeId);
      if (currentPrice) {
        await this.updatePnL({ snipeId, currentPrice, timeframe });
      }
    } catch (error) {
      console.error(`Failed to update PnL for snipe ${snipeId} at ${timeframe}:`, error);
    }
  }

  private async getCurrentMarketPrice(snipeId: number): Promise<number | null> {
    try {
      const snipe = await db
        .select({ targetSymbol: snipes.targetSymbol })
        .from(snipes)
        .where(eq(snipes.id, snipeId))
        .limit(1);

      if (snipe.length === 0) return null;

      // Mock current price fetch - replace with actual MEXC API call
      return Math.random() * 100;
    } catch (error) {
      console.error('Failed to get current market price:', error);
      return null;
    }
  }

  private async schedulePnLUpdates(snipeId: number, currentPrice: number): Promise<void> {
    // This could be called from WebSocket updates for real-time tracking
    // Implementation depends on specific requirements
  }
}
```

## 🌐 Express.js API Routes

```typescript
// src/api/routes/calendar.ts
import { Router } from 'express';
import { CalendarService } from '../../services/calendar/CalendarService';
import { MonitorCalendarRequestSchema } from '../../types/api';
import { validateRequest } from '../middleware/validation';

const router = Router();
const calendarService = new CalendarService();

router.post(
  '/monitor',
  validateRequest(MonitorCalendarRequestSchema),
  async (req, res) => {
    try {
      const result = await calendarService.monitorCalendar(req.body.hours);
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

router.get('/pending', async (req, res) => {
  try {
    const listings = await calendarService.getPendingListings();
    res.json({
      success: true,
      data: { listings },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
```

## 🚀 Main Application

```typescript
// src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { checkConnection } from './database/connection';
import calendarRoutes from './api/routes/calendar';
import detectorRoutes from './api/routes/detector';
import executorRoutes from './api/routes/executor';
import trackerRoutes from './api/routes/tracker';
import { startScheduledJobs } from './utils/scheduler';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/calendar', calendarRoutes);
app.use('/api/detector', detectorRoutes);
app.use('/api/executor', executorRoutes);
app.use('/api/tracker', trackerRoutes);

// Health check
app.get('/health', async (req, res) => {
  const dbHealthy = await checkConnection();
  res.json({
    status: 'ok',
    database: dbHealthy ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// Error handling
app.use((error: any, req: any, res: any, next: any) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString(),
  });
});

// Start server
async function startServer() {
  try {
    // Check database connection
    const dbHealthy = await checkConnection();
    if (!dbHealthy) {
      throw new Error('Database connection failed');
    }

    // Start scheduled jobs
    startScheduledJobs();

    app.listen(PORT, () => {
      console.log(`🚀 Sniping Bot API running on port ${PORT}`);
      console.log(`📊 Health check available at http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
```

## ⏰ Scheduler Utilities

```typescript
// src/utils/scheduler.ts
import cron from 'node-cron';
import { CalendarService } from '../services/calendar/CalendarService';
import { DetectorService } from '../services/detector/DetectorService';

const calendarService = new CalendarService();
const detectorService = new DetectorService();

export function startScheduledJobs(): void {
  // Monitor calendar every hour
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('🕐 Running scheduled calendar monitoring...');
      const result = await calendarService.monitorCalendar(24);
      console.log(`📅 Calendar monitoring complete: ${result.newListings} new listings`);
    } catch (error) {
      console.error('❌ Scheduled calendar monitoring failed:', error);
    }
  });

  // Start adaptive detection every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      console.log('🔍 Starting adaptive detection...');
      const result = await detectorService.startAdaptiveDetection();
      console.log(`🎯 Adaptive detection started: ${result.activeTiers.join(', ')}`);
    } catch (error) {
      console.error('❌ Adaptive detection failed:', error);
    }
  });
}
```

## 🧪 Testing Configuration

```typescript
// src/__tests__/services/CalendarService.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { CalendarService } from '../../services/calendar/CalendarService';

describe('CalendarService', () => {
  let calendarService: CalendarService;

  beforeEach(() => {
    calendarService = new CalendarService();
  });

  it('should monitor calendar and return new listings', async () => {
    const result = await calendarService.monitorCalendar(24);

    expect(result).toHaveProperty('newListings');
    expect(result).toHaveProperty('totalListings');
    expect(typeof result.newListings).toBe('number');
    expect(typeof result.totalListings).toBe('number');
  });

  it('should get pending listings', async () => {
    const listings = await calendarService.getPendingListings();
    expect(Array.isArray(listings)).toBe(true);
  });
});
```

## 🔧 Environment Configuration

```bash
# .env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://localhost:5432/sniping_bot

# MEXC API Configuration
MEXC_API_KEY=your_api_key
MEXC_SECRET_KEY=your_secret_key
MEXC_BASE_URL=https://api.mexc.com

# WebSocket Configuration
MEXC_WS_URL=wss://wbs.mexc.com/ws

# Monitoring Configuration
ENABLE_MONITORING=true
LOG_LEVEL=info
```

This pure TypeScript implementation provides the same sophisticated sniping bot functionality while leveraging modern TypeScript patterns, comprehensive Zod validation, and a clean service-oriented architecture without framework dependencies.
