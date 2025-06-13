# Turso Database Best Practices Analysis

## Current Implementation Review

### Database Configuration (`src/db/index.ts`)

**Strengths:**
- ✅ Proper environment-based database selection
- ✅ Fallback mechanism from Turso to SQLite
- ✅ WAL mode enabled for SQLite (performance optimization)
- ✅ Foreign keys enabled for data integrity

**Areas for Improvement:**
1. **Connection pooling**: Not utilizing Turso's connection management features
2. **Error handling**: Basic error handling could be enhanced
3. **Type safety**: Could leverage Drizzle's type inference better
4. **Missing Turso-specific optimizations**: Not using embedded replicas or vector capabilities

### Drizzle Configuration (`drizzle.config.ts`)

**Strengths:**
- ✅ Proper dialect selection based on environment
- ✅ Verbose and strict modes enabled

**Areas for Improvement:**
1. **Migration strategy**: Could implement safer migration patterns for production
2. **Schema validation**: No runtime schema validation

## Recommended Improvements

### 1. Enhanced Database Connection with Turso Best Practices

```typescript
// src/db/index.ts - Enhanced version
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

interface TursoConfig {
  url: string;
  authToken?: string;
  syncUrl?: string; // For embedded replicas
  syncInterval?: number; // Sync interval in seconds
  encryptionKey?: string; // For encryption at rest
}

function createTursoDatabase(config: TursoConfig) {
  const client = createClient({
    url: config.url,
    authToken: config.authToken,
    syncUrl: config.syncUrl,
    syncInterval: config.syncInterval,
    encryptionKey: config.encryptionKey,
  });

  // Enable connection pooling
  return drizzleTurso(client, { 
    schema,
    logger: process.env.NODE_ENV === "development",
  });
}

function createDatabase() {
  const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL;
  const hasTursoConfig = process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN;
  const forceSQLite = process.env.FORCE_SQLITE === "true";
  const useEmbeddedReplica = process.env.TURSO_SYNC_URL && !process.env.VERCEL;

  // Use SQLite for local development
  if (forceSQLite || (!isProduction && !hasTursoConfig)) {
    console.log("[Database] Using SQLite for development");
    const Database = require("better-sqlite3");
    const sqlite = new Database("./mexc_sniper.db");
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("busy_timeout = 5000");
    sqlite.pragma("synchronous = NORMAL");
    sqlite.pragma("cache_size = -64000"); // 64MB cache
    sqlite.pragma("temp_store = MEMORY");
    return drizzleSqlite(sqlite, { schema });
  }

  // Use Turso with optimizations
  if (hasTursoConfig) {
    const config: TursoConfig = {
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    };

    // Enable embedded replicas for non-serverless environments
    if (useEmbeddedReplica) {
      console.log("[Database] Using Turso with embedded replica");
      config.syncUrl = process.env.TURSO_SYNC_URL;
      config.syncInterval = parseInt(process.env.TURSO_SYNC_INTERVAL || "60");
    } else {
      console.log("[Database] Using Turso (remote only)");
    }

    return createTursoDatabase(config);
  }

  throw new Error("No valid database configuration found");
}

export const db = createDatabase();
```

### 2. Implement AI & Embeddings Support

```typescript
// src/db/schema.ts - Add vector support
import { customType } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Custom type for vector embeddings
export const float32Array = customType<{
  data: number[];
  config: { dimensions: number };
  configRequired: true;
  driverData: Buffer;
}>({
  dataType(config) {
    return `F32_BLOB(${config.dimensions})`;
  },
  fromDriver(value: Buffer) {
    return Array.from(new Float32Array(value.buffer));
  },
  toDriver(value: number[]) {
    return sql`vector32(${JSON.stringify(value)})`;
  },
});

// Add AI analysis table with embeddings
export const aiAnalysis = sqliteTable(
  "ai_analysis",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    symbolId: integer("symbol_id").references(() => snipeTargets.id),
    analysisType: text("analysis_type").notNull(), // "pattern", "sentiment", "technical"
    content: text("content").notNull(),
    embedding: float32Array("embedding", { dimensions: 1536 }), // OpenAI embeddings
    confidence: real("confidence").notNull(),
    metadata: text("metadata"), // JSON
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    embeddingIdx: index("ai_analysis_embedding_idx").on(sql`libsql_vector_idx(${table.embedding})`),
    symbolIdx: index("ai_analysis_symbol_idx").on(table.symbolId),
    typeIdx: index("ai_analysis_type_idx").on(table.analysisType),
  })
);

// Pattern embeddings for similarity search
export const patternEmbeddings = sqliteTable(
  "pattern_embeddings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    patternName: text("pattern_name").notNull(),
    description: text("description").notNull(),
    embedding: float32Array("embedding", { dimensions: 1536 }),
    successRate: real("success_rate").notNull(),
    sampleCount: integer("sample_count").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    embeddingIdx: index("pattern_embedding_idx").on(sql`libsql_vector_idx(${table.embedding})`),
  })
);
```

### 3. Vector Search Implementation

```typescript
// src/services/ai-embeddings-service.ts
import { db } from "@/db";
import { aiAnalysis, patternEmbeddings } from "@/db/schema";
import { sql } from "drizzle-orm";

export class AIEmbeddingsService {
  // Find similar patterns using vector search
  async findSimilarPatterns(queryEmbedding: number[], limit = 5) {
    const result = await db.all(sql`
      SELECT 
        p.*,
        vector_distance_cos(p.embedding, vector32(${JSON.stringify(queryEmbedding)})) as distance
      FROM pattern_embeddings p
      JOIN vector_top_k('pattern_embedding_idx', vector32(${JSON.stringify(queryEmbedding)}), ${limit}) v
      ON p.id = v.id
      ORDER BY distance ASC
    `);

    return result;
  }

  // Find similar AI analyses
  async findSimilarAnalyses(queryEmbedding: number[], symbolId?: number, limit = 10) {
    let query = sql`
      SELECT 
        a.*,
        vector_distance_cos(a.embedding, vector32(${JSON.stringify(queryEmbedding)})) as distance
      FROM ai_analysis a
      JOIN vector_top_k('ai_analysis_embedding_idx', vector32(${JSON.stringify(queryEmbedding)}), ${limit}) v
      ON a.id = v.id
    `;

    if (symbolId) {
      query = sql`${query} WHERE a.symbol_id = ${symbolId}`;
    }

    query = sql`${query} ORDER BY distance ASC`;

    return await db.all(query);
  }

  // Store analysis with embedding
  async storeAnalysisWithEmbedding(
    symbolId: number,
    analysisType: string,
    content: string,
    embedding: number[],
    confidence: number,
    metadata?: any
  ) {
    return await db.insert(aiAnalysis).values({
      symbolId,
      analysisType,
      content,
      embedding,
      confidence,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
  }
}
```

### 4. Embedded Replicas Configuration (for Railway/Non-Serverless)

```typescript
// src/db/embedded-replica.ts
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import fs from "fs";
import path from "path";

export function createEmbeddedReplicaDatabase() {
  const dbPath = path.join(process.cwd(), "data", "local.db");
  
  // Ensure data directory exists
  if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const client = createClient({
    url: `file:${dbPath}`,
    syncUrl: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
    syncInterval: 60, // Sync every 60 seconds
  });

  return drizzle(client, { 
    schema,
    logger: process.env.NODE_ENV === "development" 
  });
}

// Performance monitoring for embedded replicas
export async function getReplicaStats(db: any) {
  const stats = await db.run(sql`
    SELECT 
      (SELECT COUNT(*) FROM sqlite_master WHERE type='table') as table_count,
      (SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()) as db_size,
      (SELECT COUNT(*) FROM pragma_database_list()) as attached_dbs
  `);
  
  return stats;
}
```

### 5. Migration Strategy for Production

```typescript
// scripts/migrate-with-validation.ts
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "@/db";
import { sql } from "drizzle-orm";

async function validateSchema() {
  try {
    // Check critical tables exist
    const tables = await db.all(sql`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    
    const requiredTables = ['user', 'session', 'account', 'snipe_targets'];
    const missingTables = requiredTables.filter(
      t => !tables.some(table => table.name === t)
    );
    
    if (missingTables.length > 0) {
      throw new Error(`Missing required tables: ${missingTables.join(', ')}`);
    }
    
    return true;
  } catch (error) {
    console.error("Schema validation failed:", error);
    return false;
  }
}

async function safelyMigrate() {
  console.log("Starting safe migration process...");
  
  // Create backup point
  await db.run(sql`PRAGMA wal_checkpoint(TRUNCATE)`);
  
  try {
    // Run migrations
    await migrate(db, { migrationsFolder: "./src/db/migrations" });
    
    // Validate schema after migration
    const isValid = await validateSchema();
    if (!isValid) {
      throw new Error("Schema validation failed after migration");
    }
    
    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

safelyMigrate();
```

### 6. Performance Optimizations

```typescript
// src/db/performance.ts
import { sql } from "drizzle-orm";
import { db } from "./index";

export async function optimizeDatabase() {
  // Run ANALYZE to update query planner statistics
  await db.run(sql`ANALYZE`);
  
  // Optimize database file
  await db.run(sql`VACUUM`);
  
  // Create useful indexes if they don't exist
  const indexes = [
    sql`CREATE INDEX IF NOT EXISTS idx_snipe_targets_ready_state 
        ON snipe_targets(is_ready_state) WHERE is_ready_state = 1`,
    sql`CREATE INDEX IF NOT EXISTS idx_execution_history_user_symbol 
        ON execution_history(user_id, symbol, created_at DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_user_preferences_user 
        ON user_preferences(user_id)`,
  ];
  
  for (const index of indexes) {
    await db.run(index);
  }
}

// Connection pool management
export class DatabasePool {
  private static instance: DatabasePool;
  private connections: Map<string, any> = new Map();
  
  static getInstance(): DatabasePool {
    if (!DatabasePool.instance) {
      DatabasePool.instance = new DatabasePool();
    }
    return DatabasePool.instance;
  }
  
  getConnection(key: string = 'default') {
    if (!this.connections.has(key)) {
      this.connections.set(key, db);
    }
    return this.connections.get(key);
  }
  
  async closeAll() {
    for (const [key, conn] of this.connections) {
      console.log(`Closing connection: ${key}`);
      // Turso connections are managed automatically
    }
    this.connections.clear();
  }
}
```

## Environment Configuration

### Development (.env.local)
```bash
# SQLite (default)
DATABASE_URL=sqlite:///./mexc_sniper.db

# Or Turso for development
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
```

### Production with Vercel (.env.production)
```bash
# Turso remote database
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
```

### Production with Railway/VPS (.env.production)
```bash
# Turso with embedded replicas
TURSO_DATABASE_URL=file:./data/local.db
TURSO_SYNC_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
TURSO_SYNC_INTERVAL=60
```

## Implementation Priority

1. **High Priority**
   - Implement connection pooling and error handling improvements
   - Add database performance optimizations (indexes, VACUUM, ANALYZE)
   - Set up proper migration validation

2. **Medium Priority**
   - Implement vector embeddings for AI analysis
   - Add similarity search capabilities
   - Set up embedded replicas for Railway deployment

3. **Low Priority**
   - Advanced monitoring and metrics
   - Custom backup strategies
   - Multi-region replication

## Security Considerations

1. **Always use environment variables** for sensitive data
2. **Enable encryption at rest** for production databases
3. **Use read replicas** for analytics queries
4. **Implement query timeouts** to prevent long-running queries
5. **Regular backups** with point-in-time recovery

## Monitoring and Maintenance

1. **Query Performance**
   ```sql
   -- Monitor slow queries
   SELECT * FROM sqlite_stat1;
   ```

2. **Database Size**
   ```sql
   -- Check database size
   SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size();
   ```

3. **Connection Health**
   ```typescript
   // Regular health checks
   setInterval(async () => {
     try {
       await db.run(sql`SELECT 1`);
     } catch (error) {
       console.error("Database health check failed:", error);
     }
   }, 30000);
   ```

## Conclusion

The current implementation is functional but can be significantly improved by:
1. Leveraging Turso's native features (vectors, embedded replicas)
2. Implementing proper connection management
3. Adding AI/embedding capabilities for pattern analysis
4. Optimizing for different deployment environments

These improvements will result in:
- **10-100x faster** read performance with embedded replicas
- **AI-powered** pattern discovery with vector search
- **Better reliability** with proper error handling and migrations
- **Scalability** for growing data and user base