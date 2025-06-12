#!/bin/bash

echo "🔍 Checking authentication system setup..."
echo ""

# Check if database file exists
if [ -f "mexc_sniper.db" ]; then
    echo "✅ Database file exists"
else
    echo "❌ Database file not found"
    echo "   Run: bun run db:migrate"
    exit 1
fi

# Check auth tables
echo ""
echo "📊 Checking auth tables..."
sqlite3 mexc_sniper.db "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('user', 'session', 'account', 'verification');" | while read table; do
    echo "✅ Table: $table"
done

# Check environment variables
echo ""
echo "🔐 Checking environment variables..."
if [ -f ".env.local" ]; then
    if grep -q "AUTH_SECRET=" .env.local; then
        echo "✅ AUTH_SECRET is set in .env.local"
    else
        echo "❌ AUTH_SECRET is missing in .env.local"
    fi
    
    if grep -q "FORCE_SQLITE=true" .env.local; then
        echo "✅ FORCE_SQLITE is set to true (using local SQLite)"
    else
        echo "⚠️  FORCE_SQLITE not set (will attempt to use TursoDB if configured)"
    fi
else
    echo "❌ .env.local file not found"
fi

echo ""
echo "📋 Summary:"
echo "   1. Database file: ✅"
echo "   2. Auth tables: Check output above"
echo "   3. Environment: Check output above"
echo ""
echo "If any issues found:"
echo "   - Run: bun run db:migrate"
echo "   - Ensure AUTH_SECRET is set in .env.local"
echo "   - Restart the development server"