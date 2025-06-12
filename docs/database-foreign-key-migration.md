# Database Foreign Key Migration Guide

## Overview

This guide documents the foreign key constraint and performance index migration for the MEXC Sniper Bot database. The migration adds referential integrity to prevent orphaned records and improves query performance.

## What This Migration Does

### 1. Foreign Key Constraints Added

The following foreign key constraints are added with CASCADE DELETE to maintain data integrity:

- `userPreferences.userId` → `user.id` (CASCADE DELETE)
- `apiCredentials.userId` → `user.id` (CASCADE DELETE)
- `snipeTargets.userId` → `user.id` (CASCADE DELETE)
- `executionHistory.userId` → `user.id` (CASCADE DELETE)
- `transactions.userId` → `user.id` (CASCADE DELETE)

Additionally, these references use SET NULL on delete:
- `executionHistory.snipeTargetId` → `snipeTargets.id` (SET NULL)
- `transactions.snipeTargetId` → `snipeTargets.id` (SET NULL)

### 2. Performance Indexes Added

New indexes to improve query performance:
- `api_credentials_user_idx` on `api_credentials(user_id)`
- `monitored_listings_symbol_name_idx` on `monitored_listings(symbol_name)`
- `workflow_system_status_user_idx` on `workflow_system_status(user_id)`
- `workflow_activity_user_idx` on `workflow_activity(user_id)`

### 3. SQLite Foreign Key Support

- Enables foreign key constraints for SQLite connections
- Adds `PRAGMA foreign_keys = ON` to database initialization

## Migration Process

### Step 1: Run the Safe Migration Script

```bash
# Run the foreign key migration preparation
bun run db:migrate:fk
```

This script will:
1. Create backup tables for safety
2. Enable foreign keys for SQLite
3. Add performance indexes
4. Validate data integrity
5. Report any orphaned records

### Step 2: Generate New Migration Files

```bash
# Generate migration files from updated schema
bun run db:generate
```

This creates new migration files based on the updated schema with foreign key references.

### Step 3: Apply the Migration

```bash
# Apply the migration to your database
bun run db:migrate
```

## Handling Existing Data

### Check for Orphaned Records

The migration script automatically checks for orphaned records. If found, you have options:

1. **Keep orphaned records** (default): Records are preserved but won't have FK constraints
2. **Clean up manually**: Delete orphaned records before migration

To manually clean orphaned records:

```sql
-- Delete orphaned user preferences
DELETE FROM user_preferences WHERE user_id NOT IN (SELECT id FROM user);

-- Delete orphaned API credentials
DELETE FROM api_credentials WHERE user_id NOT IN (SELECT id FROM user);

-- Delete orphaned snipe targets
DELETE FROM snipe_targets WHERE user_id NOT IN (SELECT id FROM user);

-- Delete orphaned execution history
DELETE FROM execution_history WHERE user_id NOT IN (SELECT id FROM user);

-- Delete orphaned transactions
DELETE FROM transactions WHERE user_id NOT IN (SELECT id FROM user);
```

## Rollback Strategy

If you need to rollback the migration:

```bash
# Rollback using backup tables
bun run src/db/migrations/safe-foreign-key-migration.ts --rollback
```

Or manually:

```sql
-- Restore from backups
DROP TABLE IF EXISTS user_preferences;
ALTER TABLE user_preferences_backup RENAME TO user_preferences;

-- Repeat for other tables...
```

## Production Deployment

### For Vercel/TursoDB:

1. **Update schema.ts** with foreign key references (already done)
2. **Deploy code** with updated schema
3. **Run migration** via Vercel dashboard or API:
   ```bash
   # Via Vercel CLI
   vercel env pull
   bun run db:migrate
   ```

### Important Production Notes:

- TursoDB supports foreign keys natively
- Migration is backward compatible
- No data loss will occur
- Backup tables are created automatically

## Benefits

### Data Integrity
- Prevents orphaned records when users are deleted
- Maintains referential integrity across all tables
- Automatic cascade deletion of related records

### Performance
- Faster queries on user-specific data
- Improved join performance
- Better index coverage for common queries

### Example Query Improvements:

```sql
-- Before: Full table scan
SELECT * FROM api_credentials WHERE user_id = ?;

-- After: Index scan (much faster)
SELECT * FROM api_credentials WHERE user_id = ?;
```

## Troubleshooting

### Common Issues:

1. **"table already exists" error**
   - Solution: Run `bun run db:migrate:safe` instead

2. **Foreign key constraint violations**
   - Cause: Orphaned records exist
   - Solution: Clean orphaned records first

3. **SQLite foreign keys not working**
   - Cause: Foreign keys not enabled
   - Solution: Ensure `PRAGMA foreign_keys = ON` is set

### Verification:

Check if foreign keys are enabled:
```sql
PRAGMA foreign_keys;
-- Should return 1
```

Check for orphaned records:
```sql
SELECT COUNT(*) FROM user_preferences 
WHERE user_id NOT IN (SELECT id FROM user);
```

## Schema Changes Summary

```typescript
// Before
userId: text("user_id").notNull()

// After
userId: text("user_id")
  .notNull()
  .references(() => user.id, { onDelete: "cascade" })
```

This ensures that when a user is deleted, all their related data is automatically cleaned up, preventing data corruption in this financial trading system.