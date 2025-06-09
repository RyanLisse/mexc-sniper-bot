# Database Optimization Implementation Plan

## 1. Schema Improvements

### Add Missing Foreign Key Constraints
```sql
-- Migration: Add foreign key constraints
ALTER TABLE user_preferences ADD CONSTRAINT fk_user_preferences_user 
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE;

ALTER TABLE api_credentials ADD CONSTRAINT fk_api_credentials_user 
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE;

ALTER TABLE snipe_targets ADD CONSTRAINT fk_snipe_targets_user 
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE;

ALTER TABLE execution_history ADD CONSTRAINT fk_execution_history_user 
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE;
```

### Create Time-Series Price Data Table
```typescript
export const priceHistory = sqliteTable(
  "price_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    symbolName: text("symbol_name").notNull(),
    price: real("price").notNull(),
    volume24h: real("volume_24h"),
    priceChange: real("price_change"),
    timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
    source: text("source").notNull().default("mexc"), // mexc, binance, etc
  },
  (table) => ({
    symbolTimeIdx: index("price_history_symbol_time_idx").on(table.symbolName, table.timestamp),
    timestampIdx: index("price_history_timestamp_idx").on(table.timestamp),
  })
);
```

### Normalize Trading Pairs Table
```typescript
export const tradingPairs = sqliteTable(
  "trading_pairs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    vcoinId: text("vcoin_id").notNull(),
    baseAsset: text("base_asset").notNull(),
    quoteAsset: text("quote_asset").notNull(),
    symbol: text("symbol").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    minTradeAmount: real("min_trade_amount"),
    tickSize: real("tick_size"),
  },
  (table) => ({
    vcoinIdIdx: index("trading_pairs_vcoin_id_idx").on(table.vcoinId),
    symbolIdx: index("trading_pairs_symbol_idx").on(table.symbol),
  })
);
```

## 2. Query Optimization

### Fix N+1 Query Issues
```typescript
// Replace individual queries with JOINs
const activePositionsWithExecutions = await db
  .select({
    // snipe_targets fields
    id: snipeTargets.id,
    userId: snipeTargets.userId,
    symbolName: snipeTargets.symbolName,
    positionSizeUsdt: snipeTargets.positionSizeUsdt,
    stopLossPercent: snipeTargets.stopLossPercent,
    createdAt: snipeTargets.createdAt,
    
    // execution_history fields
    executedPrice: executionHistory.executedPrice,
    executedQuantity: executionHistory.executedQuantity,
    executedAt: executionHistory.executedAt,
  })
  .from(snipeTargets)
  .innerJoin(
    executionHistory,
    and(
      eq(executionHistory.snipeTargetId, snipeTargets.id),
      eq(executionHistory.action, "buy"),
      eq(executionHistory.status, "success")
    )
  )
  .where(eq(snipeTargets.status, "ready"));
```

### Optimize Count Queries
```typescript
// Use proper SQL COUNT instead of array length
const [countResult] = await db
  .select({ count: sql<number>`count(*)` })
  .from(executionHistory)
  .where(and(...conditions));
const totalCount = countResult.count;
```

### Add Compound Indexes
```sql
-- High-priority indexes for common query patterns
CREATE INDEX execution_history_user_symbol_time_idx 
  ON execution_history(user_id, symbol_name, executed_at DESC);

CREATE INDEX execution_history_user_status_action_idx 
  ON execution_history(user_id, status, action);

CREATE INDEX snipe_targets_user_status_priority_idx 
  ON snipe_targets(user_id, status, priority);

CREATE INDEX monitored_listings_status_launch_idx 
  ON monitored_listings(status, first_open_time);

CREATE INDEX workflow_activity_user_timestamp_idx 
  ON workflow_activity(user_id, timestamp DESC);
```

## 3. Caching Strategy

### Implement Price Data Caching
```typescript
interface PriceCache {
  symbol: string;
  price: number;
  timestamp: number;
  volume24h?: number;
}

class PriceCacheService {
  private cache = new Map<string, PriceCache>();
  private readonly CACHE_TTL = 30 * 1000; // 30 seconds

  async getPrice(symbol: string): Promise<number | null> {
    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.price;
    }

    // Batch fetch multiple symbols if possible
    const price = await this.fetchPrice(symbol);
    if (price) {
      this.cache.set(symbol, {
        symbol,
        price,
        timestamp: Date.now(),
      });
    }
    return price;
  }

  async batchGetPrices(symbols: string[]): Promise<Map<string, number>> {
    // Implement batch API call to MEXC
    const response = await fetch('https://api.mexc.com/api/v3/ticker/24hr');
    const tickers = await response.json();
    
    const prices = new Map<string, number>();
    const now = Date.now();
    
    for (const ticker of tickers) {
      if (symbols.includes(ticker.symbol)) {
        const price = parseFloat(ticker.lastPrice);
        prices.set(ticker.symbol, price);
        
        this.cache.set(ticker.symbol, {
          symbol: ticker.symbol,
          price,
          timestamp: now,
          volume24h: parseFloat(ticker.volume),
        });
      }
    }
    
    return prices;
  }
}
```

## 4. Data Archival Strategy

### Implement Execution History Partitioning
```typescript
// Archive old execution history
export const executionHistoryArchive = sqliteTable("execution_history_archive", {
  // Same schema as execution_history
  // Move records older than 90 days here
});

// Cleanup job
class DataArchivalService {
  async archiveOldExecutions(): Promise<void> {
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    
    // Move old records to archive
    const oldRecords = await db
      .select()
      .from(executionHistory)
      .where(lte(executionHistory.createdAt, cutoffDate));
    
    if (oldRecords.length > 0) {
      await db.insert(executionHistoryArchive).values(oldRecords);
      await db
        .delete(executionHistory)
        .where(lte(executionHistory.createdAt, cutoffDate));
    }
  }
}
```

## 5. Real-time Data Optimization

### WebSocket Price Feeds
```typescript
class WebSocketPriceService {
  private ws: WebSocket | null = null;
  private priceCallbacks = new Map<string, Array<(price: number) => void>>();

  connect(): void {
    this.ws = new WebSocket('wss://wbs.mexc.com/ws');
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.c && data.s) { // price and symbol
        const symbol = data.s;
        const price = parseFloat(data.c);
        
        // Update cache
        priceCache.set(symbol, price);
        
        // Notify subscribers
        const callbacks = this.priceCallbacks.get(symbol);
        callbacks?.forEach(callback => callback(price));
      }
    };
  }

  subscribeToPriceUpdates(symbol: string, callback: (price: number) => void): void {
    if (!this.priceCallbacks.has(symbol)) {
      this.priceCallbacks.set(symbol, []);
      // Send subscription message
      this.ws?.send(JSON.stringify({
        method: 'SUBSCRIPTION',
        params: [`${symbol}@ticker`]
      }));
    }
    
    this.priceCallbacks.get(symbol)?.push(callback);
  }
}
```

## 6. Connection Pooling

### Database Connection Management
```typescript
// In src/db/index.ts
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';

class DatabaseManager {
  private static instance: DatabaseManager;
  private sqlite: Database.Database;
  private db: ReturnType<typeof drizzle>;

  private constructor() {
    this.sqlite = new Database(process.env.DATABASE_URL || 'mexc_sniper.db', {
      // Optimize SQLite settings
      timeout: 5000,
      verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
    });

    // Enable WAL mode for better concurrent access
    this.sqlite.pragma('journal_mode = WAL');
    this.sqlite.pragma('synchronous = NORMAL');
    this.sqlite.pragma('cache_size = 1000000'); // 1GB cache
    this.sqlite.pragma('temp_store = MEMORY');
    
    this.db = drizzle(this.sqlite);
  }

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  getDb() {
    return this.db;
  }

  close(): void {
    this.sqlite.close();
  }
}

export const db = DatabaseManager.getInstance().getDb();
```

## 7. Query Monitoring

### Add Query Performance Logging
```typescript
// Query performance middleware
class QueryMonitor {
  static wrapQuery<T>(queryName: string, queryFn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    
    return queryFn()
      .then(result => {
        const duration = Date.now() - start;
        if (duration > 1000) { // Log slow queries
          console.warn(`Slow query detected: ${queryName} took ${duration}ms`);
        }
        return result;
      })
      .catch(error => {
        const duration = Date.now() - start;
        console.error(`Query failed: ${queryName} took ${duration}ms`, error);
        throw error;
      });
  }
}

// Usage
const result = await QueryMonitor.wrapQuery(
  'get-user-execution-history',
  () => db.select().from(executionHistory).where(eq(executionHistory.userId, userId))
);
```

## Implementation Priority

### Phase 1: Critical Performance (Week 1)
1. Add missing compound indexes
2. Fix N+1 queries in auto-exit-manager
3. Implement price data caching
4. Fix count query performance issues

### Phase 2: Schema Optimization (Week 2)
1. Add foreign key constraints
2. Create price_history table
3. Normalize trading pairs data
4. Implement data archival jobs

### Phase 3: Real-time Optimization (Week 3)
1. Implement WebSocket price feeds
2. Add connection pooling
3. Query performance monitoring
4. Cache invalidation strategies

### Phase 4: Monitoring & Maintenance (Week 4)
1. Database health monitoring
2. Automated cleanup jobs
3. Performance alerting
4. Backup strategies

## Expected Performance Improvements

- **Query Performance**: 60-80% reduction in query time for common operations
- **Memory Usage**: 40% reduction through proper caching and archival
- **API Call Reduction**: 90% reduction in external API calls through caching
- **Real-time Responsiveness**: Sub-second price updates via WebSocket
- **Database Size**: 50% reduction through archival strategy