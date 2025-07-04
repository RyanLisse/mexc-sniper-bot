#!/usr/bin/env tsx
/**
 * DEPRECATED: NeonDB Test Branch Management CLI
 * 
 * ⚠️ This script is deprecated and no longer functional.
 * The system has been migrated to Supabase, which handles database testing differently.
 * 
 * For current database testing:
 * - Use Supabase's built-in preview environments
 * - Refer to tests/setup/supabase-test-setup.ts for current testing setup
 * - Use the Supabase Dashboard or CLI for environment management
 * 
 * This file is kept for historical reference only.
 */

import { neonBranchManager } from "../src/lib/neon-branch-manager";
import { 
  setupTestBranch, 
  cleanupTestBranch, 
  migrateTestBranch,
  checkTestBranchHealth,
  cleanupAllTestBranches 
} from "../src/lib/test-branch-setup";

const commands = {
  create: createBranch,
  list: listBranches,
  delete: deleteBranch,
  cleanup: cleanupBranches,
  connection: getBranchConnection,
  health: checkBranchHealth,
  migrate: migrateBranch,
  help: showHelp,
};

async function main() {
  try {
    const [command, ...args] = process.argv.slice(2);

    if (!command || !commands[command as keyof typeof commands]) {
      showHelp();
      process.exit(1);
    }

    await (commands[command as keyof typeof commands] as Function)(...args);
  } catch (error) {
    console.error("❌ Command failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Create a new test branch
 */
async function createBranch(name?: string) {
  console.log("🌿 Creating new test branch...");
  
  try {
    const context = await setupTestBranch({
      testSuite: name || "manual",
      timeout: 180000, // 3 minutes
    });

    console.log("✅ Test branch created successfully!");
    console.log(`   Name: ${context.branchName}`);
    console.log(`   ID: ${context.branchId}`);
    console.log(`   Connection: ${context.connectionString.replace(/\/\/.*@/, "//***:***@")}`);
    
    // Ask if user wants to run migrations
    const readline = await import("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question("Run migrations on this branch? (y/N): ", resolve);
    });
    rl.close();

    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      console.log("📦 Running migrations...");
      await migrateTestBranch(context);
      console.log("✅ Migrations completed!");
    }

    console.log("\n📋 Branch created and ready for use!");
    console.log(`   To use this branch, set: DATABASE_URL="${context.connectionString}"`);
    console.log(`   To cleanup later, run: npm run branch:delete ${context.branchId}`);

  } catch (error) {
    console.error("❌ Failed to create branch:", error);
    throw error;
  }
}

/**
 * List all test branches
 */
async function listBranches(pattern?: string) {
  console.log("📋 Listing test branches...");
  
  try {
    const branches = await neonBranchManager.listTestBranches(pattern || "test-");
    
    if (branches.length === 0) {
      console.log("   No test branches found.");
      return;
    }

    console.log(`   Found ${branches.length} test branch(es):\n`);
    
    for (const branch of branches) {
      const age = Date.now() - branch.createdAt.getTime();
      const ageHours = Math.round(age / (1000 * 60 * 60) * 10) / 10;
      
      console.log(`   🌿 ${branch.name}`);
      console.log(`      ID: ${branch.id}`);
      console.log(`      Age: ${ageHours} hours`);
      console.log(`      Created: ${branch.createdAt.toISOString()}`);
      console.log(`      Connection: ${branch.connectionString.replace(/\/\/.*@/, "//***:***@")}`);
      console.log();
    }

    // Show summary
    const activeBranches = neonBranchManager.getActiveBranches();
    console.log(`📊 Summary:`);
    console.log(`   Total test branches: ${branches.length}`);
    console.log(`   Currently tracked: ${activeBranches.length}`);

  } catch (error) {
    console.error("❌ Failed to list branches:", error);
    throw error;
  }
}

/**
 * Delete a specific test branch
 */
async function deleteBranch(branchId: string) {
  if (!branchId) {
    console.error("❌ Branch ID is required");
    console.log("Usage: npm run branch:delete <branch-id>");
    process.exit(1);
  }

  console.log(`🗑️  Deleting test branch: ${branchId}`);
  
  try {
    await neonBranchManager.deleteTestBranch(branchId);
    console.log("✅ Branch deleted successfully!");

  } catch (error) {
    console.error("❌ Failed to delete branch:", error);
    throw error;
  }
}

/**
 * Cleanup old test branches
 */
async function cleanupBranches(maxAgeHours?: string) {
  const maxAge = maxAgeHours ? parseFloat(maxAgeHours) : 24; // Default 24 hours
  const maxAgeMs = maxAge * 60 * 60 * 1000;

  console.log(`🧹 Cleaning up test branches older than ${maxAge} hours...`);
  
  try {
    // First, list branches to show what will be cleaned
    const allBranches = await neonBranchManager.listTestBranches("test-");
    const oldBranches = allBranches.filter(branch => 
      Date.now() - branch.createdAt.getTime() > maxAgeMs
    );

    if (oldBranches.length === 0) {
      console.log("   No old branches found to cleanup.");
      return;
    }

    console.log(`   Found ${oldBranches.length} old branch(es) to cleanup:`);
    for (const branch of oldBranches) {
      const age = Date.now() - branch.createdAt.getTime();
      const ageHours = Math.round(age / (1000 * 60 * 60) * 10) / 10;
      console.log(`   - ${branch.name} (${ageHours}h old)`);
    }

    // Confirm cleanup
    const readline = await import("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question("Proceed with cleanup? (y/N): ", resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log("   Cleanup cancelled.");
      return;
    }

    // Perform cleanup
    await neonBranchManager.cleanupOldTestBranches(maxAgeMs);
    console.log("✅ Cleanup completed!");

  } catch (error) {
    console.error("❌ Failed to cleanup branches:", error);
    throw error;
  }
}

/**
 * Get connection string for a branch
 */
async function getBranchConnection(branchId: string) {
  if (!branchId) {
    console.error("❌ Branch ID is required");
    console.log("Usage: npm run branch:connection <branch-id>");
    process.exit(1);
  }

  console.log(`🔗 Getting connection string for branch: ${branchId}`);
  
  try {
    const connectionString = await neonBranchManager.getBranchConnectionString(branchId);
    
    console.log("✅ Connection string:");
    console.log(`   ${connectionString}`);
    console.log();
    console.log("📋 To use this branch:");
    console.log(`   export DATABASE_URL="${connectionString}"`);

  } catch (error) {
    console.error("❌ Failed to get connection string:", error);
    throw error;
  }
}

/**
 * Check branch health
 */
async function checkBranchHealth(branchId: string) {
  if (!branchId) {
    console.error("❌ Branch ID is required");
    console.log("Usage: npm run branch:health <branch-id>");
    process.exit(1);
  }

  console.log(`🏥 Checking health of branch: ${branchId}`);
  
  try {
    // Create a temporary context for health check
    const connectionString = await neonBranchManager.getBranchConnectionString(branchId);
    const context = {
      branchId,
      branchName: `health-check-${branchId}`,
      connectionString,
      originalDatabaseUrl: process.env.DATABASE_URL || "",
      cleanup: async () => {},
    };

    const isHealthy = await checkTestBranchHealth(context);
    
    if (isHealthy) {
      console.log("✅ Branch is healthy and accessible!");
    } else {
      console.log("❌ Branch health check failed!");
    }

  } catch (error) {
    console.error("❌ Failed to check branch health:", error);
    throw error;
  }
}

/**
 * Run migrations on a branch
 */
async function migrateBranch(branchId: string) {
  if (!branchId) {
    console.error("❌ Branch ID is required");
    console.log("Usage: npm run branch:migrate <branch-id>");
    process.exit(1);
  }

  console.log(`📦 Running migrations on branch: ${branchId}`);
  
  try {
    // Create a temporary context for migration
    const connectionString = await neonBranchManager.getBranchConnectionString(branchId);
    const context = {
      branchId,
      branchName: `migrate-${branchId}`,
      connectionString,
      originalDatabaseUrl: process.env.DATABASE_URL || "",
      cleanup: async () => {},
    };

    await migrateTestBranch(context);
    console.log("✅ Migrations completed successfully!");

  } catch (error) {
    console.error("❌ Failed to run migrations:", error);
    throw error;
  }
}

/**
 * Show help information
 */
function showHelp() {
  console.log(`
🌿 NeonDB Test Branch Management CLI

Usage:
  tsx scripts/manage-test-branches.ts <command> [options]

Commands:
  create [name]           Create a new test branch (optionally named)
  list [pattern]          List all test branches (default pattern: "test-")
  delete <branch-id>      Delete a specific test branch
  cleanup [max-age-hours] Cleanup old test branches (default: 24 hours)
  connection <branch-id>  Get connection string for a branch
  health <branch-id>      Check if a branch is healthy and accessible
  migrate <branch-id>     Run database migrations on a branch
  help                    Show this help message

Examples:
  tsx scripts/manage-test-branches.ts create my-test
  tsx scripts/manage-test-branches.ts list
  tsx scripts/manage-test-branches.ts delete br_1234567890
  tsx scripts/manage-test-branches.ts cleanup 12
  tsx scripts/manage-test-branches.ts connection br_1234567890
  tsx scripts/manage-test-branches.ts health br_1234567890
  tsx scripts/manage-test-branches.ts migrate br_1234567890

Environment Variables:
  NEON_API_KEY      Your Neon API key (required)
  NEON_PROJECT_ID   Your Neon project ID (optional, auto-detected)
  DATABASE_URL      Your main database connection string

Note: Make sure you have NEON_API_KEY set in your environment.
`);
}

// Run the CLI
if (require.main === module) {
  main().catch((error) => {
    console.error("💥 Fatal error:", error);
    process.exit(1);
  });
}

export { main as manageBranches };