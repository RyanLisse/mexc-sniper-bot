#!/bin/bash

# GitHub Secrets Setup Script
# Run this script to automatically configure all required GitHub repository secrets

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 GitHub Secrets Setup Script${NC}"
echo "This script will help you configure all required GitHub repository secrets."
echo ""

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) is not installed.${NC}"
    echo "Please install it first:"
    echo "  macOS: brew install gh"
    echo "  Ubuntu: sudo apt install gh"
    echo "  Windows: winget install GitHub.CLI"
    echo ""
    echo "Then authenticate with: gh auth login"
    exit 1
fi

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${RED}❌ Not authenticated with GitHub CLI.${NC}"
    echo "Please run: gh auth login"
    exit 1
fi

# Get repository information
REPO_OWNER=$(gh repo view --json owner --jq .owner.login)
REPO_NAME=$(gh repo view --json name --jq .name)

echo -e "${GREEN}📍 Repository: ${REPO_OWNER}/${REPO_NAME}${NC}"
echo ""

# Function to set a secret
set_secret() {
    local secret_name=$1
    local secret_description=$2
    local is_required=${3:-true}
    
    echo -e "${YELLOW}🔑 Setting up: ${secret_name}${NC}"
    echo "Description: ${secret_description}"
    
    if [ "$is_required" = true ]; then
        echo -n "Enter value for ${secret_name}: "
        read -s secret_value
        echo ""
        
        if [ -z "$secret_value" ]; then
            echo -e "${RED}❌ Secret value cannot be empty for required secret: ${secret_name}${NC}"
            return 1
        fi
    else
        echo -n "Enter value for ${secret_name} (optional, press Enter to skip): "
        read -s secret_value
        echo ""
        
        if [ -z "$secret_value" ]; then
            echo -e "${YELLOW}⏭️  Skipped optional secret: ${secret_name}${NC}"
            return 0
        fi
    fi
    
    if gh secret set "$secret_name" --body "$secret_value" --repo "${REPO_OWNER}/${REPO_NAME}"; then
        echo -e "${GREEN}✅ Successfully set: ${secret_name}${NC}"
    else
        echo -e "${RED}❌ Failed to set: ${secret_name}${NC}"
        return 1
    fi
    echo ""
}

# Function to set secret from file
set_secret_from_file() {
    local secret_name=$1
    local file_path=$2
    local secret_description=$3
    
    echo -e "${YELLOW}🔑 Setting up: ${secret_name}${NC}"
    echo "Description: ${secret_description}"
    echo "File path: ${file_path}"
    
    if [ ! -f "$file_path" ]; then
        echo -e "${RED}❌ File not found: ${file_path}${NC}"
        return 1
    fi
    
    if gh secret set "$secret_name" < "$file_path" --repo "${REPO_OWNER}/${REPO_NAME}"; then
        echo -e "${GREEN}✅ Successfully set: ${secret_name}${NC}"
    else
        echo -e "${RED}❌ Failed to set: ${secret_name}${NC}"
        return 1
    fi
    echo ""
}

echo -e "${BLUE}📋 Required Secrets Setup${NC}"
echo "You'll be prompted to enter each secret value."
echo "Values are hidden as you type for security."
echo ""

# Vercel Deployment Secrets
echo -e "${BLUE}🚀 Vercel Deployment Secrets${NC}"
set_secret "VERCEL_TOKEN" "Vercel CLI authentication token (get from: https://vercel.com/account/tokens)"
set_secret "VERCEL_ORG_ID" "Your Vercel organization/team ID (check .vercel/project.json)"
set_secret "VERCEL_PROJECT_ID" "Your Vercel project ID (check .vercel/project.json)"

# Database & External Services
echo -e "${BLUE}🗄️  Database & External Services${NC}"
set_secret "DATABASE_URL" "NeonDB PostgreSQL connection string"
set_secret "MEXC_API_KEY" "MEXC Exchange API key"
set_secret "MEXC_SECRET_KEY" "MEXC Exchange secret key"
set_secret "OPENAI_API_KEY" "OpenAI API key for AI services"

# Authentication & Security
echo -e "${BLUE}🔐 Authentication & Security${NC}"
set_secret "KINDE_CLIENT_ID" "Kinde authentication client ID"
set_secret "KINDE_CLIENT_SECRET" "Kinde authentication client secret"
set_secret "KINDE_ISSUER_URL" "Kinde issuer URL"
set_secret "NEXTAUTH_SECRET" "NextAuth.js secret for session encryption (generate with: openssl rand -base64 32)"

# Optional Monitoring & Analytics
echo -e "${BLUE}📊 Optional Monitoring & Analytics${NC}"
set_secret "CODECOV_TOKEN" "Codecov upload token for code coverage reporting" false
set_secret "SLACK_WEBHOOK_URL" "Slack webhook for notifications" false

# Redis (if using)
echo -e "${BLUE}💾 Cache & Session Storage${NC}"
set_secret "REDIS_URL" "Redis connection string for caching" false

echo ""
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Verify secrets were set correctly:"
echo "   gh secret list --repo ${REPO_OWNER}/${REPO_NAME}"
echo ""
echo "2. Set up Vercel environment variables:"
echo "   vercel env add DATABASE_URL production"
echo "   vercel env add KINDE_CLIENT_ID production"
echo "   # ... (add all other environment variables)"
echo ""
echo "3. Test the CI/CD pipeline:"
echo "   git push origin main"
echo ""
echo "4. Validate environment health:"
echo "   gh workflow run environment-validation.yml"