#!/bin/bash

# Setup required Vercel environment variables
echo "Setting up Vercel environment variables..."

# Generate AUTH_SECRET
AUTH_SECRET=$(openssl rand -base64 32)
echo "Generated AUTH_SECRET: $AUTH_SECRET"

# Add AUTH_SECRET for all environments
echo "$AUTH_SECRET" | vercel env add AUTH_SECRET production
echo "$AUTH_SECRET" | vercel env add AUTH_SECRET preview  
echo "$AUTH_SECRET" | vercel env add AUTH_SECRET development

echo "Environment variables setup complete!"
echo "You may need to check and update TURSO_DATABASE_URL if needed."