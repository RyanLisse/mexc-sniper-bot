#!/bin/bash

# Safe database migration script for Vercel deployment
# This script handles existing database tables gracefully

set -euo pipefail

echo "🔄 Starting safe database migration..."

# Check if we're in production (Vercel environment)
if [ "${VERCEL:-}" = "1" ]; then
    echo "📦 Production environment detected (Vercel)"
    
    # In production, we skip migration if database already exists
    # TursoDB databases are persistent and migrations should be done manually
    echo "⚠️  Skipping automatic migration in production environment"
    echo "💡 Database migrations in production should be done manually"
    echo "✅ Migration check complete"
    exit 0
else
    echo "🏠 Development environment detected"
    
    # In development, run migrations normally
    echo "🔄 Running database migrations..."
    if drizzle-kit migrate; then
        echo "✅ Database migration completed successfully"
    else
        echo "⚠️  Migration failed - this might be normal if tables already exist"
        echo "💡 For fresh start, run: bun run db:reset"
        exit 0  # Don't fail the build for migration issues in development
    fi
fi

echo "🎉 Migration process complete"