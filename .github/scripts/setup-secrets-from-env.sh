#!/bin/bash

# GitHub Secrets Setup from Environment File
# This script reads secrets from a .env file and sets them in GitHub

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 GitHub Secrets Setup from Environment File${NC}"
echo ""

# Default environment file
ENV_FILE="${1:-.env.secrets}"

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Environment file not found: $ENV_FILE${NC}"
    echo ""
    echo "Usage: $0 [env-file]"
    echo "       $0 .env.secrets"
    echo ""
    echo "Create an environment file with the following format:"
    echo "VERCEL_TOKEN=your_token_here"
    echo "VERCEL_ORG_ID=your_org_id"
    echo "# ... other secrets"
    exit 1
fi

# Check if GitHub CLI is installed and authenticated
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) is not installed.${NC}"
    exit 1
fi

if ! gh auth status &> /dev/null; then
    echo -e "${RED}❌ Not authenticated with GitHub CLI.${NC}"
    echo "Please run: gh auth login"
    exit 1
fi

# Get repository information
REPO_OWNER=$(gh repo view --json owner --jq .owner.login)
REPO_NAME=$(gh repo view --json name --jq .name)

echo -e "${GREEN}📍 Repository: ${REPO_OWNER}/${REPO_NAME}${NC}"
echo -e "${BLUE}📄 Environment file: ${ENV_FILE}${NC}"
echo ""

# Define mapping of secret names to descriptions
declare -A SECRET_DESCRIPTIONS=(
    ["VERCEL_TOKEN"]="Vercel CLI authentication token"
    ["VERCEL_ORG_ID"]="Vercel organization/team ID"
    ["VERCEL_PROJECT_ID"]="Vercel project ID"
    ["DATABASE_URL"]="NeonDB PostgreSQL connection string"
    ["MEXC_API_KEY"]="MEXC Exchange API key"
    ["MEXC_SECRET_KEY"]="MEXC Exchange secret key"
    ["OPENAI_API_KEY"]="OpenAI API key"
    ["KINDE_CLIENT_ID"]="Kinde authentication client ID"
    ["KINDE_CLIENT_SECRET"]="Kinde authentication client secret"
    ["KINDE_ISSUER_URL"]="Kinde issuer URL"
    ["NEXTAUTH_SECRET"]="NextAuth.js session encryption secret"
    ["CODECOV_TOKEN"]="Codecov upload token"
    ["SLACK_WEBHOOK_URL"]="Slack webhook URL"
    ["REDIS_URL"]="Redis connection string"
)

# Read environment file and set secrets
secrets_set=0
secrets_failed=0

echo -e "${YELLOW}🔄 Processing environment file...${NC}"
echo ""

while IFS='=' read -r secret_name secret_value || [ -n "$secret_name" ]; do
    # Skip empty lines and comments
    [[ -z "$secret_name" || "$secret_name" =~ ^[[:space:]]*# ]] && continue
    
    # Remove any whitespace
    secret_name=$(echo "$secret_name" | xargs)
    secret_value=$(echo "$secret_value" | xargs)
    
    # Skip if no value
    if [ -z "$secret_value" ]; then
        echo -e "${YELLOW}⏭️  Skipping empty secret: ${secret_name}${NC}"
        continue
    fi
    
    # Get description if available
    description="${SECRET_DESCRIPTIONS[$secret_name]:-"No description available"}"
    
    echo -e "${YELLOW}🔑 Setting: ${secret_name}${NC}"
    echo "   Description: ${description}"
    
    if gh secret set "$secret_name" --body "$secret_value" --repo "${REPO_OWNER}/${REPO_NAME}" 2>/dev/null; then
        echo -e "${GREEN}   ✅ Success${NC}"
        ((secrets_set++))
    else
        echo -e "${RED}   ❌ Failed${NC}"
        ((secrets_failed++))
    fi
    echo ""
    
done < "$ENV_FILE"

echo -e "${BLUE}📊 Summary${NC}"
echo -e "${GREEN}✅ Secrets set successfully: ${secrets_set}${NC}"
echo -e "${RED}❌ Secrets failed: ${secrets_failed}${NC}"
echo ""

if [ $secrets_failed -eq 0 ]; then
    echo -e "${GREEN}🎉 All secrets configured successfully!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Verify secrets: gh secret list"
    echo "2. Test CI/CD pipeline: git push origin main"
    echo "3. Set up Vercel environment variables"
else
    echo -e "${YELLOW}⚠️  Some secrets failed to set. Please check the errors above.${NC}"
fi

# Clean up - remove the environment file for security
read -p "Delete the environment file for security? (y/N): " delete_env
if [[ $delete_env =~ ^[Yy]$ ]]; then
    rm "$ENV_FILE"
    echo -e "${GREEN}🗑️  Environment file deleted for security.${NC}"
fi