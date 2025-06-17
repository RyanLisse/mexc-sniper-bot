#!/usr/bin/env tsx
/**
 * NeonDB Branch Testing Setup Script
 * 
 * Sets up and validates the environment for NeonDB branch-based testing.
 * This script helps configure the necessary environment variables and
 * validates that the branch management system is working correctly.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { neonBranchManager } from "../src/lib/neon-branch-manager";
import { setupTestBranch, cleanupTestBranch, migrateTestBranch } from "../src/lib/test-branch-setup";

interface SetupOptions {
  validate?: boolean;
  createExample?: boolean;
  updateEnv?: boolean;
  test?: boolean;
}

async function main() {
  const args = process.argv.slice(2);
  const options: SetupOptions = {
    validate: args.includes("--validate") || args.includes("-v"),
    createExample: args.includes("--example") || args.includes("-e"),
    updateEnv: args.includes("--update-env") || args.includes("-u"),
    test: args.includes("--test") || args.includes("-t"),
  };

  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    return;
  }

  try {
    console.log("🌿 NeonDB Branch Testing Setup\n");

    // Step 1: Validate environment
    await validateEnvironment();

    if (options.updateEnv) {
      await updateEnvironmentFile();
    }

    if (options.createExample) {
      await createExampleEnvFile();
    }

    if (options.validate) {
      await validateBranchManager();
    }

    if (options.test) {
      await testBranchWorkflow();
    }

    console.log("\n✅ Setup completed successfully!");
    console.log("\n📋 Next steps:");
    console.log("   1. Ensure NEON_API_KEY is set in your environment");
    console.log("   2. Run tests with: npm run test");
    console.log("   3. Create manual branches with: npm run branch:create");
    console.log("   4. List branches with: npm run branch:list");

  } catch (error) {
    console.error("❌ Setup failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Validate the current environment
 */
async function validateEnvironment() {
  console.log("🔍 Validating environment...");

  // Check required environment variables
  const requiredVars = {
    DATABASE_URL: process.env.DATABASE_URL,
    NEON_API_KEY: process.env.NEON_API_KEY,
  };

  const missingVars: string[] = [];
  
  for (const [varName, value] of Object.entries(requiredVars)) {
    if (!value) {
      missingVars.push(varName);
    } else {
      console.log(`   ✅ ${varName}: ${varName === 'NEON_API_KEY' ? '***' : value.slice(0, 50)}...`);
    }
  }

  if (missingVars.length > 0) {
    console.log(`   ❌ Missing variables: ${missingVars.join(", ")}`);
    
    if (missingVars.includes("NEON_API_KEY")) {
      console.log("\n💡 To get your Neon API key:");
      console.log("   1. Go to https://console.neon.tech/");
      console.log("   2. Navigate to Settings → API Keys");
      console.log("   3. Create a new API key");
      console.log("   4. Set it as: export NEON_API_KEY='your-api-key'");
    }

    if (missingVars.includes("DATABASE_URL")) {
      console.log("\n💡 DATABASE_URL should be your NeonDB connection string");
      console.log("   Format: postgresql://user:pass@host/db?sslmode=require");
    }
  } else {
    console.log("   ✅ All required environment variables are set");
  }

  // Check optional variables
  const optionalVars = {
    NEON_PROJECT_ID: process.env.NEON_PROJECT_ID,
    USE_TEST_BRANCHES: process.env.USE_TEST_BRANCHES,
  };

  console.log("\n📋 Optional configuration:");
  for (const [varName, value] of Object.entries(optionalVars)) {
    if (value) {
      console.log(`   ✅ ${varName}: ${value}`);
    } else {
      console.log(`   ⚪ ${varName}: not set (will be auto-detected)`);
    }
  }

  // Validate database connection
  console.log("\n🔌 Testing database connection...");
  try {
    const { getDb } = await import("../src/db");
    const { sql } = await import("drizzle-orm");
    const db = getDb();
    
    await db.execute(sql`SELECT 1 as connection_test`);
    console.log("   ✅ Database connection successful");
  } catch (error) {
    console.log("   ❌ Database connection failed:", error instanceof Error ? error.message : error);
  }
}

/**
 * Validate the branch manager functionality
 */
async function validateBranchManager() {
  console.log("\n🌿 Validating branch manager...");

  if (!process.env.NEON_API_KEY) {
    console.log("   ⚠️ Skipping branch manager validation - NEON_API_KEY not set");
    return;
  }

  try {
    // Test project access
    console.log("   📡 Testing Neon API access...");
    const project = await neonBranchManager.getProject();
    console.log(`   ✅ Connected to project: ${project.name} (${project.id})`);

    // Test branch listing
    console.log("   📋 Testing branch listing...");
    const branches = await neonBranchManager.listTestBranches("test-");
    console.log(`   ✅ Found ${branches.length} existing test branches`);

    // Show active branches
    const activeBranches = neonBranchManager.getActiveBranches();
    console.log(`   📊 Currently tracking ${activeBranches.length} active branches`);

  } catch (error) {
    console.log("   ❌ Branch manager validation failed:", error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * Test the complete branch workflow
 */
async function testBranchWorkflow() {
  console.log("\n🧪 Testing branch workflow...");

  if (!process.env.NEON_API_KEY) {
    console.log("   ⚠️ Skipping workflow test - NEON_API_KEY not set");
    return;
  }

  let testContext = null;

  try {
    // Step 1: Create test branch
    console.log("   1️⃣ Creating test branch...");
    testContext = await setupTestBranch({
      testSuite: "setup-validation",
      timeout: 120000,
    });
    console.log(`   ✅ Created branch: ${testContext.branchName}`);

    // Step 2: Run migrations
    console.log("   2️⃣ Running migrations...");
    await migrateTestBranch(testContext);
    console.log("   ✅ Migrations completed");

    // Step 3: Test database operations
    console.log("   3️⃣ Testing database operations...");
    const originalUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = testContext.connectionString;

    try {
      const { getDb, clearDbCache } = await import("../src/db");
      const { sql } = await import("drizzle-orm");
      clearDbCache();
      const db = getDb();

      // Test basic query
      await db.execute(sql`SELECT 1 as workflow_test`);
      
      // Test table creation
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS workflow_test (
          id SERIAL PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);

      // Test data insertion
      await db.execute(sql`
        INSERT INTO workflow_test (value) VALUES ('test-data')
      `);

      // Test data retrieval
      const result = await db.execute(sql`
        SELECT COUNT(*) as count FROM workflow_test
      `);

      if (result[0].count !== '1') {
        throw new Error("Data integrity test failed");
      }

      console.log("   ✅ Database operations successful");

    } finally {
      process.env.DATABASE_URL = originalUrl;
      const { clearDbCache } = await import("../src/db");
      clearDbCache();
    }

    // Step 4: Test cleanup
    console.log("   4️⃣ Testing cleanup...");
    await cleanupTestBranch(testContext);
    testContext = null;
    console.log("   ✅ Cleanup successful");

    console.log("\n🎉 Branch workflow test completed successfully!");

  } catch (error) {
    console.log("   ❌ Workflow test failed:", error instanceof Error ? error.message : error);
    
    // Attempt cleanup if branch was created
    if (testContext) {
      try {
        await cleanupTestBranch(testContext);
        console.log("   🧹 Emergency cleanup successful");
      } catch (cleanupError) {
        console.log("   ⚠️ Emergency cleanup failed:", cleanupError instanceof Error ? cleanupError.message : cleanupError);
      }
    }
    
    throw error;
  }
}

/**
 * Create an example environment file
 */
async function createExampleEnvFile() {
  console.log("\n📝 Creating example environment file...");

  const exampleEnv = `# NeonDB Branch Testing Configuration
# Copy this to .env.local and fill in your values

# Required: Your NeonDB connection string
DATABASE_URL="postgresql://user:password@host/db?sslmode=require"

# Required: Your Neon API key for branch management
# Get this from: https://console.neon.tech/ → Settings → API Keys
NEON_API_KEY="your-neon-api-key-here"

# Optional: Project ID (auto-detected from DATABASE_URL if not set)
NEON_PROJECT_ID="your-project-id"

# Optional: Enable branch-based testing (default: true in test environment)
USE_TEST_BRANCHES="true"

# Test Environment Configuration
NODE_ENV="test"
VITEST="true"

# Mock API keys for testing
OPENAI_API_KEY="test-openai-key"
MEXC_API_KEY="test-mexc-key"
MEXC_SECRET_KEY="test-mexc-secret"

# Encryption key for testing
ENCRYPTION_MASTER_KEY="dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcy1sb25n"
`;

  const envFile = ".env.example.branch-testing";
  writeFileSync(envFile, exampleEnv);
  console.log(`   ✅ Created ${envFile}`);
  console.log("   💡 Copy this file to .env.local and update with your values");
}

/**
 * Update the existing environment file with branch testing configuration
 */
async function updateEnvironmentFile() {
  console.log("\n📝 Updating environment configuration...");

  const envFiles = [".env.local", ".env"];
  let envFile = null;

  // Find existing env file
  for (const file of envFiles) {
    if (existsSync(file)) {
      envFile = file;
      break;
    }
  }

  if (!envFile) {
    console.log("   ⚠️ No existing .env file found, creating .env.local");
    envFile = ".env.local";
  }

  let envContent = "";
  if (existsSync(envFile)) {
    envContent = readFileSync(envFile, "utf-8");
  }

  // Add branch testing configuration if not present
  const additions = [];

  if (!envContent.includes("NEON_API_KEY")) {
    additions.push("# Neon API key for branch management");
    additions.push("NEON_API_KEY=");
  }

  if (!envContent.includes("USE_TEST_BRANCHES")) {
    additions.push("# Enable branch-based testing");
    additions.push("USE_TEST_BRANCHES=true");
  }

  if (additions.length > 0) {
    envContent += "\n\n# Branch Testing Configuration\n";
    envContent += additions.join("\n") + "\n";
    
    writeFileSync(envFile, envContent);
    console.log(`   ✅ Updated ${envFile} with branch testing configuration`);
  } else {
    console.log("   ✅ Environment file already contains branch testing configuration");
  }
}

/**
 * Show help information
 */
function showHelp() {
  console.log(`
🌿 NeonDB Branch Testing Setup

Usage:
  tsx scripts/setup-branch-testing.ts [options]

Options:
  -v, --validate     Validate branch manager functionality
  -e, --example      Create example environment file
  -u, --update-env   Update existing environment file
  -t, --test         Run complete workflow test
  -h, --help         Show this help message

Examples:
  tsx scripts/setup-branch-testing.ts --validate --test
  tsx scripts/setup-branch-testing.ts --example
  tsx scripts/setup-branch-testing.ts --update-env --validate

Environment Variables:
  DATABASE_URL       Your NeonDB connection string (required)
  NEON_API_KEY       Your Neon API key (required for branching)
  NEON_PROJECT_ID    Your project ID (optional, auto-detected)
  USE_TEST_BRANCHES  Enable branch testing (optional)

Setup Steps:
  1. Get your Neon API key from https://console.neon.tech/
  2. Set environment variables
  3. Run validation: tsx scripts/setup-branch-testing.ts --validate
  4. Test workflow: tsx scripts/setup-branch-testing.ts --test
`);
}

// Run the setup
if (require.main === module) {
  main().catch((error) => {
    console.error("💥 Setup failed:", error);
    process.exit(1);
  });
}