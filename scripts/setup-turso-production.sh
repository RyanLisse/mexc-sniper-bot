#!/bin/bash

# MEXC Sniper Bot - TursoDB Production Setup Script
# This script sets up TursoDB for production deployment

set -e

echo "🚀 Setting up TursoDB for MEXC Sniper Bot production deployment..."

# Check if turso CLI is installed
if ! command -v turso &> /dev/null; then
    echo "❌ Turso CLI not found. Installing..."
    curl -sSfL https://get.tur.so/install.sh | bash
    echo "✅ Turso CLI installed. Please restart your terminal and run this script again."
    exit 1
fi

# Check if logged in
if ! turso auth whoami &> /dev/null; then
    echo "❌ Not logged in to TursoDB. Please run: turso auth login"
    echo "   Then re-run this script."
    exit 1
fi

# Database name
DB_NAME="mexc-sniper-bot-prod"

# Check if database already exists
if turso db show "$DB_NAME" &> /dev/null; then
    echo "✅ Database '$DB_NAME' already exists"
else
    echo "📦 Creating TursoDB database: $DB_NAME"
    turso db create "$DB_NAME" --location fra1
    echo "✅ Database created successfully"
fi

# Get database URL
echo "🔗 Getting database URL..."
DB_URL=$(turso db show "$DB_NAME" --url)

# Create authentication token
echo "🔑 Creating authentication token..."
AUTH_TOKEN=$(turso db tokens create "$DB_NAME")

# Display configuration
echo ""
echo "🎉 TursoDB setup complete!"
echo "📋 Add these environment variables to your Vercel project:"
echo ""
echo "TURSO_DATABASE_URL=$DB_URL"
echo "TURSO_AUTH_TOKEN=$AUTH_TOKEN"
echo ""

# Run migrations if drizzle config exists
if [ -f "drizzle.config.ts" ]; then
    echo "🗄️  Running database migrations..."
    
    # Set environment variables temporarily for migration
    export TURSO_DATABASE_URL="$DB_URL"
    export TURSO_AUTH_TOKEN="$AUTH_TOKEN"
    
    # Run migrations
    npm run db:generate
    npm run db:migrate
    
    echo "✅ Database migrations completed"
else
    echo "⚠️  No drizzle.config.ts found. Please run migrations manually:"
    echo "   TURSO_DATABASE_URL='$DB_URL' TURSO_AUTH_TOKEN='$AUTH_TOKEN' npm run db:migrate"
fi

echo ""
echo "🔧 Next steps:"
echo "1. Add the environment variables to your Vercel project dashboard"
echo "2. Deploy your application: vercel --prod"
echo "3. Install Inngest Vercel integration from the Vercel marketplace"
echo ""
echo "📚 Documentation:"
echo "   - TursoDB: https://docs.turso.tech/"
echo "   - Inngest Vercel: https://www.inngest.com/docs/deploy/vercel"