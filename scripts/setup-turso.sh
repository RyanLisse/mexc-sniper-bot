#!/bin/bash
# Setup script for TursoDB

echo "🚀 Setting up TursoDB for MEXC Sniper Bot..."

# Check if turso CLI is installed
if ! command -v turso &> /dev/null; then
    echo "📦 Installing Turso CLI..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew install tursodatabase/tap/turso
    else
        # Linux/WSL
        curl -sSfL https://get.tur.so/install.sh | bash
    fi
else
    echo "✅ Turso CLI already installed"
fi

# Check if authenticated
if ! turso auth status &> /dev/null; then
    echo "🔐 Please authenticate with Turso..."
    turso auth signup
fi

# Create database if it doesn't exist
DB_NAME="mexc-sniper-bot"
if ! turso db show $DB_NAME &> /dev/null; then
    echo "📊 Creating TursoDB database..."
    turso db create $DB_NAME
else
    echo "✅ Database already exists"
fi

# Get database URL
echo "🔗 Getting database URL..."
DB_URL=$(turso db show $DB_NAME --url)
echo "Database URL: $DB_URL"

# Create token
echo "🔑 Creating authentication token..."
AUTH_TOKEN=$(turso db tokens create $DB_NAME)

# Create or update .env.local file
ENV_FILE=".env.local"
echo "📝 Updating $ENV_FILE..."

# Check if file exists
if [ ! -f "$ENV_FILE" ]; then
    touch "$ENV_FILE"
fi

# Add or update TursoDB configuration
if grep -q "TURSO_DATABASE_URL" "$ENV_FILE"; then
    # Update existing values
    sed -i.bak "s|TURSO_DATABASE_URL=.*|TURSO_DATABASE_URL=$DB_URL|" "$ENV_FILE"
    sed -i.bak "s|TURSO_AUTH_TOKEN=.*|TURSO_AUTH_TOKEN=$AUTH_TOKEN|" "$ENV_FILE"
else
    # Add new values
    echo "" >> "$ENV_FILE"
    echo "# TursoDB Configuration" >> "$ENV_FILE"
    echo "USE_TURSO_DB=true" >> "$ENV_FILE"
    echo "TURSO_DATABASE_URL=$DB_URL" >> "$ENV_FILE"
    echo "TURSO_AUTH_TOKEN=$AUTH_TOKEN" >> "$ENV_FILE"
fi

# Remove backup file
rm -f "$ENV_FILE.bak"

echo ""
echo "✅ TursoDB setup complete!"
echo ""
echo "🔧 Configuration added to $ENV_FILE:"
echo "   - USE_TURSO_DB=true"
echo "   - TURSO_DATABASE_URL=$DB_URL"
echo "   - TURSO_AUTH_TOKEN=<token>"
echo ""
echo "📚 Next steps:"
echo "   1. Run 'uv sync' to install Python dependencies"
echo "   2. Run 'bun install' to install TypeScript dependencies"
echo "   3. Start the application with 'bun run dev'"
echo ""
echo "💡 To switch back to SQLite/PostgreSQL, set USE_TURSO_DB=false"