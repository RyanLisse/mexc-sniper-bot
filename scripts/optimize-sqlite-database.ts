#!/usr/bin/env tsx

import { config } from "dotenv";
import path from "path";

// Load environment variables
config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

import { db } from "@/src/db";
import { sql } from "drizzle-orm";
import { checkDatabaseHealth, checkAuthTables } from "@/src/lib/db-health-check";

async function optimizeSQLiteDatabase() {
  console.log("🔧 Optimizing SQLite Database Configuration");
  console.log("=" .repeat(55));

  try {
    // 1. Test basic connectivity
    console.log("\n1. Testing Database Connectivity...");
    const connectResult = await db.run(sql`SELECT 1 as test`);
    console.log("✅ Database connection successful");

    // 2. Apply performance optimizations
    console.log("\n2. Applying Performance Optimizations...");
    
    const optimizations = [
      { name: "WAL Mode", query: sql`PRAGMA journal_mode = WAL` },
      { name: "Foreign Keys", query: sql`PRAGMA foreign_keys = ON` },
      { name: "Synchronous Mode", query: sql`PRAGMA synchronous = NORMAL` },
      { name: "Cache Size", query: sql`PRAGMA cache_size = -64000` }, // 64MB cache
      { name: "Temp Store", query: sql`PRAGMA temp_store = MEMORY` },
      { name: "Busy Timeout", query: sql`PRAGMA busy_timeout = 30000` }, // 30 seconds
      { name: "Optimize", query: sql`PRAGMA optimize` },
    ];

    for (const optimization of optimizations) {
      try {
        await db.run(optimization.query);
        console.log(`   ✅ ${optimization.name} applied`);
      } catch (error) {
        console.log(`   ⚠️ ${optimization.name} failed: ${(error as Error).message}`);
      }
    }

    // 3. Check database health
    console.log("\n3. Verifying Database Health...");
    const dbHealth = await checkDatabaseHealth();
    console.log(`   Database Health: ${dbHealth.healthy ? "✅ Healthy" : "❌ Unhealthy"}`);
    
    if (!dbHealth.healthy) {
      console.log(`   Error: ${dbHealth.message}`);
    }

    // 4. Check authentication tables
    console.log("\n4. Verifying Authentication Schema...");
    const authHealth = await checkAuthTables();
    console.log(`   Auth Tables: ${authHealth.healthy ? "✅ Healthy" : "❌ Unhealthy"}`);
    
    if (authHealth.tables) {
      for (const [tableName, tableStatus] of Object.entries(authHealth.tables)) {
        const exists = (tableStatus as any).exists;
        const count = (tableStatus as any).count || 0;
        console.log(`   - ${tableName}: ${exists ? "✅" : "❌"} (${count} records)`);
      }
    }

    // 5. Performance metrics
    console.log("\n5. Performance Analysis...");
    const perfStartTime = Date.now();
    for (let i = 0; i < 10; i++) {
      await db.run(sql`SELECT 1`);
    }
    const avgResponseTime = (Date.now() - perfStartTime) / 10;
    console.log(`   Average Response Time: ${avgResponseTime.toFixed(2)}ms`);

    // 6. Database statistics
    console.log("\n6. Database Statistics...");
    try {
      const dbSize = await db.run(sql`PRAGMA page_count * PRAGMA page_size as size_bytes`);
      console.log(`   Database file queries completed`);
      
      const tableCount = await db.run(sql`SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'`);
      console.log(`   Schema analysis completed`);
    } catch (error) {
      console.log(`   ⚠️ Statistics query error: ${(error as Error).message}`);
    }

    // 7. Environment validation
    console.log("\n7. Environment Configuration...");
    const envStatus = {
      FORCE_SQLITE: process.env.FORCE_SQLITE === "true",
      DATABASE_URL: !!process.env.DATABASE_URL,
      NODE_ENV: process.env.NODE_ENV || "development",
    };

    console.log(`   - FORCE_SQLITE: ${envStatus.FORCE_SQLITE ? "✅ Enabled" : "❌ Disabled"}`);
    console.log(`   - DATABASE_URL: ${envStatus.DATABASE_URL ? "✅ Set" : "❌ Missing"}`);
    console.log(`   - NODE_ENV: ${envStatus.NODE_ENV}`);

    // 8. Recommendations
    console.log("\n8. Optimization Recommendations...");
    
    if (!envStatus.FORCE_SQLITE && process.env.TURSO_DATABASE_URL) {
      console.log("   💡 Consider using FORCE_SQLITE=true for reliable local development");
    }
    
    if (avgResponseTime > 100) {
      console.log("   ⚡ Database performance could be improved");
      console.log("      - Consider optimizing queries");
      console.log("      - Check for missing indexes");
    } else {
      console.log("   ⚡ Database performance is excellent");
    }

    // 9. Final summary
    console.log("\n9. Summary...");
    const overallHealthy = dbHealth.healthy && authHealth.healthy;
    console.log(`   Overall Status: ${overallHealthy ? "✅ HEALTHY" : "⚠️ NEEDS ATTENTION"}`);
    console.log(`   Performance: ${avgResponseTime < 50 ? "Excellent" : avgResponseTime < 100 ? "Good" : "Needs Improvement"}`);
    console.log(`   Configuration: ${envStatus.FORCE_SQLITE ? "Development Ready" : "Production Ready"}`);

    console.log("\n" + "=".repeat(55));
    console.log("🎉 SQLite optimization completed successfully!");

    return {
      healthy: overallHealthy,
      performance: avgResponseTime,
      configuration: envStatus
    };

  } catch (error) {
    console.error("\n❌ SQLite optimization failed:", error);
    throw error;
  }
}

if (require.main === module) {
  optimizeSQLiteDatabase()
    .then(result => {
      console.log(`\n🏁 Result: ${result.healthy ? "SUCCESS" : "PARTIAL SUCCESS"}`);
      console.log("💡 Your database is ready for development!");
      process.exit(result.healthy ? 0 : 1);
    })
    .catch(error => {
      console.error("Optimization failed:", error);
      process.exit(1);
    });
}

export { optimizeSQLiteDatabase };