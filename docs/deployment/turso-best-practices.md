# Turso Database Best Practices Implementation

This document describes the Turso best practices implemented in the MEXC Sniper Bot project.

## Overview

We've implemented comprehensive Turso database optimizations including:
- Connection pooling with singleton pattern
- Retry logic with exponential backoff
- Embedded replica support for Railway and edge deployments
- Vector embeddings support for pattern similarity search
- Enhanced error handling and health checks

## Key Improvements

### 1. Connection Pooling

The database connection is now managed through a singleton pattern to prevent connection exhaustion:

```typescript
// Turso client cache for connection pooling
let tursoClient: ReturnType<typeof createClient> | null = null;

function createTursoClient() {
  // Return cached client if available
  if (tursoClient) {
    return tursoClient;
  }
  // ... create and cache new client
}
```

### 2. Retry Logic

All database operations now support automatic retry with exponential backoff:

```typescript
const RETRY_DELAYS = [100, 500, 1000, 2000, 5000]; // Exponential backoff
const MAX_RETRIES = 5;

async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  retries = MAX_RETRIES
): Promise<T>
```

Usage:
```typescript
await executeWithRetry(async () => {
  return await db.select().from(users);
}, "Fetch users");
```

### 3. Embedded Replica Support

For Railway and other edge deployments, embedded replicas are automatically configured:

```typescript
if (isProduction) {
  // Enable sync interval for embedded replicas
  clientConfig.syncInterval = 60; // Sync every 60 seconds
  
  // Use embedded replica URL if available
  if (process.env.TURSO_REPLICA_URL) {
    clientConfig.syncUrl = process.env.TURSO_DATABASE_URL;
    clientConfig.url = process.env.TURSO_REPLICA_URL;
  }
}
```

### 4. Vector Embeddings Support

New tables for storing and searching pattern embeddings:

#### Pattern Embeddings Table
- Stores vector embeddings for trading patterns
- Supports similarity search for pattern matching
- Tracks performance metrics (success rate, profit)

#### Pattern Similarity Cache Table
- Caches similarity calculations between patterns
- Reduces computation overhead
- Automatic expiration and cleanup

### 5. Enhanced SQLite Performance

For local development, SQLite is optimized with:
```sql
PRAGMA journal_mode = WAL;        -- Write-Ahead Logging
PRAGMA foreign_keys = ON;         -- Enforce foreign keys
PRAGMA busy_timeout = 5000;       -- 5 second timeout
PRAGMA synchronous = NORMAL;      -- Better performance
PRAGMA cache_size = -64000;       -- 64MB cache
PRAGMA temp_store = MEMORY;       -- Use memory for temp tables
```

## Environment Variables

### Required for Turso
```bash
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token
```

### Optional for Railway Deployments
```bash
TURSO_REPLICA_URL=http://localhost:8080  # Embedded replica URL
RAILWAY_ENVIRONMENT=production            # Auto-detected on Railway
```

### Force SQLite (Development)
```bash
FORCE_SQLITE=true  # Force SQLite even if Turso is configured
```

## Vector Operations

### Storing Pattern Embeddings

```typescript
import { patternEmbeddingService } from "@/services/pattern-embedding-service";

// Store a new pattern
const patternId = await patternEmbeddingService.storePattern({
  symbolName: "BTCUSDT",
  type: "ready_state",
  data: {
    sts: 2,
    st: 2,
    tt: 4,
  },
  confidence: 95,
});
```

### Finding Similar Patterns

```typescript
// Find similar patterns
const similarPatterns = await patternEmbeddingService.findSimilarPatterns({
  symbolName: "ETHUSDT",
  type: "ready_state",
  data: {
    sts: 2,
    st: 2,
    tt: 4,
  },
  confidence: 90,
}, {
  limit: 5,
  threshold: 0.85,
});
```

### Updating Pattern Performance

```typescript
// Update based on trading results
await patternEmbeddingService.updatePatternPerformance(patternId, {
  success: true,
  profit: 15.5,
});
```

## Database Health Monitoring

```typescript
import { healthCheck } from "@/db";

const health = await healthCheck();
// Returns:
// {
//   status: "healthy" | "degraded" | "critical" | "offline",
//   responseTime: 123,
//   database: "turso" | "sqlite",
//   timestamp: "2024-01-15T10:30:00Z"
// }
```

## Migration Best Practices

1. **Always use safe migrations** for production:
   ```bash
   bun run db:migrate:safe
   ```

2. **Generate migrations** with breakpoints:
   ```bash
   bun run db:generate
   ```

3. **Check database health** before migrations:
   ```bash
   bun run db:check
   ```

## Performance Tips

1. **Use executeWithRetry** for critical operations:
   ```typescript
   const result = await executeWithRetry(
     async () => db.select().from(table),
     "Critical query"
   );
   ```

2. **Batch operations** when possible:
   ```typescript
   await db.insert(table).values(records); // Single insert for multiple records
   ```

3. **Use indexes** for frequently queried columns (already configured in schema)

4. **Monitor connection health** regularly:
   ```typescript
   // Add to your monitoring dashboard
   const health = await healthCheck();
   if (health.status === "critical") {
     // Alert or take action
   }
   ```

## Troubleshooting

### Connection Timeouts
- Check network connectivity to Turso
- Verify auth token is valid
- Retry logic will automatically handle transient failures

### High Response Times
- Enable embedded replicas for edge deployments
- Check if you're hitting rate limits
- Monitor database size and query complexity

### Vector Operations Slow
- Use the similarity cache for repeated queries
- Batch similarity searches when possible
- Consider reducing embedding dimensions if needed

## Future Enhancements

1. **Native Vector Extension**: When Turso releases native vector support, update queries to use SQL-based similarity functions
2. **Multi-region Replicas**: Configure regional replicas for global deployments
3. **Advanced Caching**: Implement Redis for hot data caching
4. **Query Optimization**: Add query analysis and optimization tools