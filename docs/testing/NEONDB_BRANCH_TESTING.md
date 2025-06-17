# NeonDB Branch Testing Guide

This guide explains how to use NeonDB branches for isolated database testing in the MEXC Sniper Bot project.

## Overview

NeonDB branching allows us to create isolated database copies for testing, ensuring that:

- Each test run gets its own clean database
- Tests don't interfere with each other
- Production data remains untouched
- Parallel test execution is safe
- Test cleanup is automatic

## Setup

### 1. Prerequisites

- NeonDB account with API access
- Node.js 18+ installed
- Environment configured with DATABASE_URL

### 2. Get Your Neon API Key

1. Go to [Neon Console](https://console.neon.tech/)
2. Navigate to **Settings** → **API Keys**
3. Create a new API key
4. Copy the key for use in your environment

### 3. Environment Configuration

Add these variables to your `.env.local` file:

```bash
# Required: Your NeonDB connection string
DATABASE_URL="postgresql://user:password@ep-example.neon.tech/neondb?sslmode=require"

# Required: Your Neon API key
NEON_API_KEY="your-neon-api-key-here"

# Optional: Project ID (auto-detected if not provided)
NEON_PROJECT_ID="your-project-id"

# Optional: Enable branch testing (default: true in test environment)
USE_TEST_BRANCHES="true"
```

### 4. Setup Validation

Run the setup script to validate your configuration:

```bash
# Quick setup and validation
npm run branch:setup:validate

# Full setup with workflow testing
npm run branch:setup:test

# Create example environment file
tsx scripts/setup-branch-testing.ts --example
```

## Usage

### Automatic Test Isolation

When `USE_TEST_BRANCHES=true`, the test framework automatically:

1. Creates a unique database branch before tests
2. Runs migrations on the branch
3. Executes tests in isolation
4. Cleans up the branch after tests complete

```typescript
// In your tests, just use the database normally
import { getDb } from '@/src/db';

describe('My Test Suite', () => {
  it('should work with isolated database', async () => {
    const db = getDb();
    // This automatically uses the isolated test branch
    const result = await db.execute(sql`SELECT 1`);
    expect(result).toBeTruthy();
  });
});
```

### Manual Branch Management

#### Create a Branch

```bash
# Create a new test branch
npm run branch:create

# Create with custom name
npm run branch:create my-feature-test
```

#### List Branches

```bash
# List all test branches
npm run branch:list

# Or use the make command
make branch-list
```

#### Use a Branch

```bash
# Get connection string for a branch
npm run branch:connection <branch-id>

# Export it to use the branch
export DATABASE_URL="postgresql://user:pass@branch-host/db"
```

#### Health Check

```bash
# Check if a branch is healthy
npm run branch:health <branch-id>
```

#### Run Migrations

```bash
# Run migrations on a specific branch
npm run branch:migrate <branch-id>
```

#### Cleanup

```bash
# Delete a specific branch
npm run branch:delete <branch-id>

# Cleanup old branches (24h+)
npm run branch:cleanup

# Emergency cleanup of all test branches
make branch-cleanup-all
```

### Programmatic Usage

For custom test setups or integration tests:

```typescript
import { 
  setupTestBranch, 
  cleanupTestBranch, 
  migrateTestBranch,
  withTestBranch 
} from '@/src/lib/test-branch-setup';

// Manual branch management
describe('Integration Tests', () => {
  let branchContext;

  beforeAll(async () => {
    branchContext = await setupTestBranch({
      testSuite: 'integration',
      timeout: 180000 // 3 minutes
    });
    await migrateTestBranch(branchContext);
  });

  afterAll(async () => {
    await cleanupTestBranch(branchContext);
  });

  // Your tests here...
});

// Or use the convenience wrapper
describe('Isolated Tests', () => {
  it('should work with temporary branch', async () => {
    await withTestBranch(async (context) => {
      // Test code here - runs in isolated branch
      const db = getDb();
      // ... test operations
    }, { testSuite: 'unit' });
  });
});
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Main NeonDB connection string |
| `NEON_API_KEY` | Yes | Neon API key for branch operations |
| `NEON_PROJECT_ID` | No | Project ID (auto-detected from DATABASE_URL) |
| `USE_TEST_BRANCHES` | No | Enable/disable branch testing (default: true in test env) |

### Vitest Configuration

The test framework automatically configures branch isolation:

```javascript
// vitest.config.unified.js
export default defineConfig({
  test: {
    env: {
      USE_TEST_BRANCHES: 'true',
      NEON_API_KEY: process.env.NEON_API_KEY || '',
      // ... other config
    },
    globalSetup: './tests/setup/global-setup.js',
    // ... other config
  }
});
```

## Best Practices

### 1. Test Isolation

- Each test suite gets its own branch
- No shared state between test runs
- Parallel execution is safe

### 2. Resource Management

- Branches are automatically cleaned up
- Old branches (24h+) are periodically removed
- Emergency cleanup available if needed

### 3. Performance Considerations

- Branch creation takes 30-60 seconds
- Use branch pooling for frequent test runs
- Consider main DB for unit tests, branches for integration

### 4. Error Handling

- Graceful fallback to main database if branching fails
- Comprehensive error logging and recovery
- Cleanup is best-effort to prevent resource leaks

## Troubleshooting

### Common Issues

#### Branch Creation Timeout

```bash
# Error: Branch creation timeout
# Solution: Increase timeout or check Neon status
tsx scripts/setup-branch-testing.ts --validate
```

#### API Key Issues

```bash
# Error: NEON_API_KEY environment variable is required
# Solution: Set your API key
export NEON_API_KEY="your-key-here"
```

#### Project ID Detection

```bash
# Error: Could not extract project ID
# Solution: Set explicitly
export NEON_PROJECT_ID="your-project-id"
```

#### Branch Quota Exceeded

```bash
# Error: Branch quota exceeded
# Solution: Cleanup old branches
npm run branch:cleanup
```

### Debug Mode

Enable detailed logging:

```bash
# Enable debug logging
export DATABASE_DEBUG="true"
export STAGEHAND_VERBOSE="true"

# Run tests with verbose output
npm run test:watch
```

### Manual Cleanup

If automatic cleanup fails:

```bash
# List all test branches
npm run branch:list

# Delete specific branches
npm run branch:delete <branch-id>

# Emergency cleanup all
make branch-cleanup-all
```

## Architecture

### Components

1. **NeonBranchManager** (`src/lib/neon-branch-manager.ts`)
   - Core API wrapper for Neon branch operations
   - Handles authentication and connection management
   - Provides branch lifecycle management

2. **TestBranchSetup** (`src/lib/test-branch-setup.ts`)
   - High-level utilities for test framework integration
   - Handles environment switching and cleanup
   - Provides convenient testing helpers

3. **Global Setup** (`tests/setup/global-setup.js`)
   - Automatic branch creation for test runs
   - Migration execution and health checks
   - Cleanup coordination

4. **CLI Tools** (`scripts/manage-test-branches.ts`)
   - Manual branch management commands
   - Debugging and maintenance utilities
   - Bulk operations and reporting

### Flow Diagram

```
Test Run Start
     ↓
Check USE_TEST_BRANCHES
     ↓
Create Branch → Run Migrations → Execute Tests → Cleanup Branch
     ↓                                              ↓
Set DATABASE_URL ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←← Restore URL
```

## Performance Metrics

### Branch Operations

- **Creation**: 30-60 seconds
- **Migration**: 10-30 seconds  
- **Cleanup**: 5-10 seconds
- **Health Check**: 1-2 seconds

### Resource Usage

- **Memory**: ~50MB per branch manager instance
- **Network**: Minimal after initial setup
- **Storage**: Branches share base data (copy-on-write)

## Monitoring

### Branch Tracking

```bash
# Check active branches
npm run branch:list

# View branch health
npm run branch:health <branch-id>

# Monitor resource usage
tsx scripts/setup-branch-testing.ts --validate
```

### Cleanup Monitoring

```bash
# Scheduled cleanup (run daily)
npm run branch:cleanup

# Emergency cleanup
make branch-cleanup-all
```

## Integration with CI/CD

### GitHub Actions

```yaml
- name: Setup Branch Testing
  run: |
    npm run branch:setup:validate
  env:
    NEON_API_KEY: ${{ secrets.NEON_API_KEY }}
    DATABASE_URL: ${{ secrets.DATABASE_URL }}

- name: Run Tests with Branches
  run: npm run test
  env:
    USE_TEST_BRANCHES: 'true'
```

### Vercel Deployment

Branch testing is automatically disabled in production:

```javascript
// Automatic detection
const isProduction = process.env.NODE_ENV === 'production';
const useTestBranches = !isProduction && process.env.USE_TEST_BRANCHES === 'true';
```

## Contributing

When adding new tests that require database isolation:

1. Use the automatic branch isolation (preferred)
2. For custom setups, use `withTestBranch()`
3. Always include proper cleanup
4. Test both branch and non-branch modes
5. Document any special requirements

## Support

For issues with NeonDB branching:

1. Check the [troubleshooting section](#troubleshooting)
2. Run setup validation: `npm run branch:setup:validate`
3. Check Neon status: https://status.neon.tech/
4. Review logs for detailed error information
5. Use emergency cleanup if branches are stuck