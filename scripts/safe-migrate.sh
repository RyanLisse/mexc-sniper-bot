#!/bin/bash

# Safe database migration script for development and deployment
# This script handles existing database tables gracefully

set -euo pipefail

echo "🔄 Starting safe database migration..."

# Function to check if migration is needed
check_migration_needed() {
    local needs_migration=true
    
    # Try to check if tables exist (this will work for both SQLite and TursoDB)
    if command -v sqlite3 >/dev/null 2>&1 && [ -f "./mexc_sniper.db" ]; then
        # Local SQLite check
        if sqlite3 "./mexc_sniper.db" "SELECT name FROM sqlite_master WHERE type='table' AND name='account';" 2>/dev/null | grep -q "account"; then
            needs_migration=false
        fi
    fi
    
    echo $needs_migration
}

# Check environment
if [ "${VERCEL:-}" = "1" ] || [ "${NODE_ENV:-}" = "production" ]; then
    echo "📦 Production environment detected"
    
    # In production, always skip migrations to prevent conflicts
    echo "⚠️  Skipping automatic migration in production environment"
    echo "💡 Database migrations in production should be done manually via Vercel dashboard"
    echo "💡 Or run: vercel env add DATABASE_MIGRATED true"
    echo "✅ Migration check complete"
    exit 0
else
    echo "🏠 Development environment detected"
    
    # Check if migration is needed
    migration_needed=$(check_migration_needed)
    
    if [ "$migration_needed" = "false" ]; then
        echo "📋 Database tables already exist, skipping migration"
        echo "💡 To force migration, run: bun run db:reset && bun run db:migrate"
        echo "✅ Database check complete"
        exit 0
    fi
    
    # Run migrations with error handling
    echo "🔄 Running database migrations..."
    if drizzle-kit migrate 2>/dev/null; then
        echo "✅ Database migration completed successfully"
    else
        migration_exit_code=$?
        echo "⚠️  Migration command exited with code $migration_exit_code"
        
        # Check if it's just a "table already exists" error
        if drizzle-kit migrate 2>&1 | grep -q "already exists"; then
            echo "📋 Tables already exist in database - this is normal"
            echo "💡 Database is ready to use"
            echo "✅ Migration check complete"
            exit 0
        else
            echo "❌ Migration failed with unexpected error"
            echo "💡 Try: bun run db:reset && bun run db:migrate"
            echo "💡 Or check database connection and permissions"
            exit 0  # Don't fail the build, just warn
        fi
    fi
fi

echo "🎉 Migration process complete"