#!/usr/bin/env tsx

// Load environment variables from .env.local
import { config } from "dotenv";
import path from "path";

// Load environment files in order of precedence
config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

import { db } from "@/src/db";
import { sql } from "drizzle-orm";
import { checkDatabaseHealth, checkAuthTables } from "@/src/lib/db-health-check";

async function runComprehensiveDatabaseDiagnostic() {
  console.log("🔬 Running Comprehensive Database Health Diagnostic");
  console.log("=" .repeat(60));

  try {
    // 1. Test basic database connectivity
    console.log("\n1. Testing Basic Database Connectivity...");
    const startTime = Date.now();
    const basicResult = await db.run(sql`SELECT 1 as test`);
    const responseTime = Date.now() - startTime;
    console.log(`✅ Basic connectivity test passed (${responseTime}ms)`);

    // 2. Check database configuration
    console.log("\n2. Database Configuration Analysis...");
    const hasTurso = !!(process.env.TURSO_DATABASE_URL || process.env.TURSO_HOST) && !!process.env.TURSO_AUTH_TOKEN;
    const forceSQLite = process.env.FORCE_SQLITE === "true";
    const useEmbedded = process.env.USE_EMBEDDED_REPLICA !== "false";
    
    console.log(`📊 Configuration Status:`);
    console.log(`   - TursoDB Available: ${hasTurso ? "✅" : "❌"}`);
    console.log(`   - Force SQLite: ${forceSQLite ? "✅" : "❌"}`);
    console.log(`   - Use Embedded Replica: ${useEmbedded ? "✅" : "❌"}`);
    console.log(`   - NODE_ENV: ${process.env.NODE_ENV || "undefined"}`);

    // 3. Test database health check functions
    console.log("\n3. Testing Database Health Check Functions...");
    const dbHealth = await checkDatabaseHealth();
    console.log(`🏥 Database Health: ${dbHealth.healthy ? "✅ Healthy" : "❌ Unhealthy"}`);
    if (!dbHealth.healthy) {
      console.log(`   Error: ${dbHealth.message}`);
    }

    // 4. Check authentication tables
    console.log("\n4. Testing Authentication Tables...");
    const authTablesHealth = await checkAuthTables();
    console.log(`🔐 Auth Tables: ${authTablesHealth.healthy ? "✅ Healthy" : "❌ Unhealthy"}`);
    if (authTablesHealth.tables) {
      for (const [tableName, tableStatus] of Object.entries(authTablesHealth.tables)) {
        const status = (tableStatus as any).exists ? "✅" : "❌";
        console.log(`   - ${tableName}: ${status}`);
      }
    }

    // 5. Test environment variables for database
    console.log("\n5. Environment Variables Check...");
    const requiredEnvVars = [
      'DATABASE_URL',
      'KINDE_CLIENT_ID', 
      'KINDE_CLIENT_SECRET',
      'KINDE_ISSUER_URL'
    ];

    const optionalEnvVars = [
      'TURSO_DATABASE_URL',
      'TURSO_HOST',
      'TURSO_AUTH_TOKEN',
      'TURSO_EMBEDDED_PATH',
      'TURSO_SYNC_INTERVAL'
    ];

    console.log(`📋 Required Environment Variables:`);
    const missingRequired = [];
    for (const envVar of requiredEnvVars) {
      const isSet = !!process.env[envVar];
      console.log(`   - ${envVar}: ${isSet ? "✅" : "❌"}`);
      if (!isSet) missingRequired.push(envVar);
    }

    console.log(`📋 Optional Environment Variables:`);
    for (const envVar of optionalEnvVars) {
      const isSet = !!process.env[envVar];
      console.log(`   - ${envVar}: ${isSet ? "✅" : "❌"}`);
    }

    // 6. Test table existence and structure
    console.log("\n6. Testing Database Schema...");
    try {
      // Test some core tables
      const tableTests = [
        { name: "user", query: sql`SELECT COUNT(*) as count FROM user LIMIT 1` },
        { name: "session", query: sql`SELECT COUNT(*) as count FROM session LIMIT 1` },
        { name: "account", query: sql`SELECT COUNT(*) as count FROM account LIMIT 1` },
        { name: "verification", query: sql`SELECT COUNT(*) as count FROM verification LIMIT 1` }
      ];

      for (const test of tableTests) {
        try {
          await db.run(test.query);
          console.log(`   - ${test.name} table: ✅ Accessible`);
        } catch (error) {
          console.log(`   - ${test.name} table: ❌ Error - ${(error as Error).message}`);
        }
      }
    } catch (error) {
      console.log(`❌ Schema test failed: ${(error as Error).message}`);
    }

    // 7. Performance metrics
    console.log("\n7. Performance Metrics...");
    const perfStartTime = Date.now();
    for (let i = 0; i < 5; i++) {
      await db.run(sql`SELECT 1`);
    }
    const avgResponseTime = (Date.now() - perfStartTime) / 5;
    console.log(`⚡ Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
    
    const performanceStatus = avgResponseTime < 100 ? "Excellent" : 
                             avgResponseTime < 500 ? "Good" : 
                             avgResponseTime < 1000 ? "Acceptable" : "Poor";
    console.log(`📊 Performance Rating: ${performanceStatus}`);

    // 8. Final health summary
    console.log("\n8. Health Summary...");
    const overallHealthy = dbHealth.healthy && authTablesHealth.healthy && missingRequired.length === 0;
    console.log(`🎯 Overall Database Health: ${overallHealthy ? "✅ HEALTHY" : "⚠️ NEEDS ATTENTION"}`);
    
    if (!overallHealthy) {
      console.log("\n⚠️ Issues Found:");
      if (!dbHealth.healthy) {
        console.log(`   - Database connectivity issue: ${dbHealth.message}`);
      }
      if (!authTablesHealth.healthy) {
        console.log(`   - Authentication tables issue: ${authTablesHealth.message}`);
      }
      if (missingRequired.length > 0) {
        console.log(`   - Missing required environment variables: ${missingRequired.join(", ")}`);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("🎉 Database diagnostic completed successfully!");
    
    return {
      healthy: overallHealthy,
      details: {
        connectivity: dbHealth.healthy,
        authTables: authTablesHealth.healthy,
        environment: missingRequired.length === 0,
        responseTime: avgResponseTime,
        performanceRating: performanceStatus
      }
    };

  } catch (error) {
    console.error("\n❌ Database diagnostic failed:", error);
    console.log("\n" + "=".repeat(60));
    throw error;
  }
}

// Run diagnostic if this script is executed directly
if (require.main === module) {
  runComprehensiveDatabaseDiagnostic()
    .then(result => {
      console.log(`\n🏁 Final Result: ${result.healthy ? "SUCCESS" : "NEEDS FIXES"}`);
      process.exit(result.healthy ? 0 : 1);
    })
    .catch(error => {
      console.error("Diagnostic failed:", error);
      process.exit(1);
    });
}

export { runComprehensiveDatabaseDiagnostic };