# Supabase Best Practices for MEXC Sniper Bot

## Overview

This guide provides best practices for using Supabase (serverless PostgreSQL) with the MEXC Sniper Bot system for optimal performance, reliability, and cost efficiency.

## Database Configuration

### Connection Settings

```typescript
// Recommended connection pool settings for Supabase
const client = postgres(process.env.DATABASE_URL, {
  max: 10,              // Maximum connections (Supabase optimized)
  idle_timeout: 300,    // 5 minutes
  connect_timeout: 30,  // 30 seconds
  ssl: 'require'        // Always use SSL with Supabase
});
```

### Environment Variables

```bash
# Production Supabase connection
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres?sslmode=require

# Supabase-specific configuration
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Performance Optimization

### Connection Pooling

1. **Use Connection Pooling**: Always use postgres.js built-in connection pooling
2. **Limit Connections**: Keep max connections under your Supabase plan limits
3. **Connection Cleanup**: Properly close connections after use

### Query Optimization

```typescript
// Use prepared statements for repeated queries
const getSymbolData = client`
  SELECT * FROM monitored_listings 
  WHERE symbol = $1 AND status = $2
`;

// Batch operations when possible
const results = await client`
  INSERT INTO transactions ${client(batchData)}
  RETURNING id, status
`;
```

### Index Strategy

```sql
-- Optimize for common query patterns
CREATE INDEX CONCURRENTLY idx_transactions_user_time 
  ON transactions(user_id, transaction_time DESC);

CREATE INDEX CONCURRENTLY idx_snipe_targets_status_priority 
  ON snipe_targets(status, priority, target_execution_time);
```

## Migration Best Practices

### Safe Migrations

```typescript
// Use Drizzle migrations with proper error handling
import { migrate } from 'drizzle-orm/postgres-js/migrator';

try {
  await migrate(db, { migrationsFolder: './src/db/migrations' });
  console.log('Migration completed successfully');
} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
}
```

### Production Migrations

1. **Test First**: Always test migrations on a preview environment
2. **Backup**: Create point-in-time recovery snapshots before major schema changes  
3. **Zero Downtime**: Use `CREATE INDEX CONCURRENTLY` for large tables
4. **Monitor**: Watch performance during and after migrations

## Security

### Access Control

```sql
-- Use specific roles for application access
CREATE ROLE app_user WITH LOGIN PASSWORD 'secure_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
```

### Connection Security

1. **SSL Only**: Always use `sslmode=require`
2. **Environment Variables**: Never hardcode credentials
3. **Rotation**: Regularly rotate database passwords
4. **VPC**: Use Supabase's IP allowlist for production

## Monitoring and Alerts

### Query Performance

```typescript
// Monitor slow queries
const slowQueryThreshold = 1000; // 1 second

export async function monitorQuery<T>(
  queryFn: () => Promise<T>,
  queryName: string
): Promise<T> {
  const startTime = Date.now();
  try {
    const result = await queryFn();
    const duration = Date.now() - startTime;
    
    if (duration > slowQueryThreshold) {
      console.warn(`Slow query detected: ${queryName} took ${duration}ms`);
    }
    
    return result;
  } catch (error) {
    console.error(`Query failed: ${queryName}`, error);
    throw error;
  }
}
```

### Connection Monitoring

```typescript
// Monitor connection pool health
export function getPoolStats(client: postgres.Sql) {
  return {
    totalConnections: client.options.max,
    activeConnections: client.reserved,
    idleConnections: client.idle.length,
    queuedRequests: client.ended.length
  };
}
```

## Cost Optimization

### Compute Hours

1. **Auto-suspend**: Enable auto-suspend for development databases
2. **Right-size**: Choose appropriate compute size for workload
3. **Scaling**: Use autoscaling for variable workloads

### Storage

1. **Data Retention**: Implement data archiving for historical records
2. **Compression**: Use appropriate PostgreSQL data types
3. **Cleanup**: Regular cleanup of temporary and log data

```sql
-- Archive old execution history
CREATE TABLE execution_history_archive (LIKE execution_history);

-- Move old records (example: older than 90 days)
WITH moved_rows AS (
  DELETE FROM execution_history 
  WHERE created_at < NOW() - INTERVAL '90 days'
  RETURNING *
)
INSERT INTO execution_history_archive 
SELECT * FROM moved_rows;
```

## Development Strategy

### Development Workflow

```bash
# Create development environment in Supabase
# Use Supabase Dashboard or CLI to create preview environments

# Test migrations on preview environment
DATABASE_URL=postgresql://...preview-connection... npm run db:migrate

# Run tests
npm test

# Deploy to production when ready
# Use Supabase's built-in CI/CD integration
```

### Testing

1. **Environment per Feature**: Create preview environments for testing new features  
2. **Fresh Environments**: Use fresh preview databases for each test suite
3. **Data Isolation**: Keep test data separate from production

## Backup and Recovery

### Automated Backups

Supabase provides automatic backups, but for critical data:

```typescript
// Export critical configuration
export async function backupCriticalData() {
  const criticalTables = [
    'user_preferences',
    'api_credentials', 
    'trading_strategies'
  ];
  
  for (const table of criticalTables) {
    const data = await db.execute(sql`SELECT * FROM ${sql.identifier(table)}`);
    await saveToSecureStorage(`backup_${table}_${Date.now()}.json`, data);
  }
}
```

### Point-in-Time Recovery

1. **Regular Snapshots**: Create manual snapshots before major changes
2. **Documentation**: Document recovery procedures
3. **Testing**: Regularly test recovery procedures

## Development vs Production

### Development Setup

```typescript
// Development: More verbose logging, longer timeouts
const devConfig = {
  max: 2,
  idle_timeout: 60,
  connect_timeout: 10,
  debug: process.env.NODE_ENV === 'development'
};
```

### Production Setup

```typescript
// Production: Optimized for performance and reliability
const prodConfig = {
  max: 10,
  idle_timeout: 300,
  connect_timeout: 30,
  ssl: 'require',
  application_name: 'mexc-sniper-bot'
};
```

## Troubleshooting

### Common Issues

1. **Connection Timeouts**: Increase connect_timeout, check network
2. **Pool Exhaustion**: Monitor connection usage, increase max connections
3. **Slow Queries**: Add indexes, optimize queries, check EXPLAIN plans
4. **Migration Failures**: Use transactions, test on branches first

### Debugging Tools

```typescript
// Enable query logging for debugging
const debugClient = postgres(url, {
  debug: (connection, query, parameters) => {
    console.log('Query:', query);
    console.log('Params:', parameters);
  }
});
```

## Migration from Other Databases

### From SQLite/TursoDB

1. **Schema Conversion**: Update SQLite types to PostgreSQL equivalents
2. **Serial Keys**: Use `SERIAL` instead of `INTEGER PRIMARY KEY`
3. **Timestamps**: Use PostgreSQL `TIMESTAMP` types
4. **JSON**: Use PostgreSQL `JSONB` for better performance

```sql
-- SQLite to PostgreSQL type mappings
-- INTEGER → SERIAL (for auto-increment)
-- INTEGER → INTEGER (for regular integers)  
-- TEXT → TEXT or VARCHAR
-- REAL → REAL or NUMERIC
-- BLOB → BYTEA
```

This guide ensures optimal performance and reliability when using Supabase with the MEXC Sniper Bot system.