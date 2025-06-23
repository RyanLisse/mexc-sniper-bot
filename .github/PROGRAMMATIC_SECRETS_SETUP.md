# Programmatic GitHub Secrets Setup

This guide provides multiple methods to set up GitHub repository secrets programmatically, eliminating the need to manually enter each secret through the GitHub web interface.

## 🚀 Quick Start

### Method 1: Interactive Setup Script (Recommended)

The easiest way to set up secrets programmatically:

```bash
# Make sure GitHub CLI is installed and authenticated
gh auth login

# Run the interactive setup script
./.github/scripts/setup-secrets.sh
```

This script will prompt you for each secret value and set them automatically.

### Method 2: Environment File Setup (Batch)

For batch setup from a file:

```bash
# 1. Copy the template
cp .env.secrets.template .env.secrets

# 2. Edit .env.secrets with your actual values
nano .env.secrets

# 3. Run the batch setup script
./.github/scripts/setup-secrets-from-env.sh .env.secrets

# 4. Delete the secrets file for security
rm .env.secrets
```

## 📋 Available Methods

### 1. GitHub CLI (Recommended) 🏆

**Requirements:**
- GitHub CLI (`gh`) installed
- Authenticated with GitHub (`gh auth login`)

**Advantages:**
- ✅ Easiest to use
- ✅ Built-in authentication
- ✅ Secure input handling
- ✅ Good error handling

**Script:** `.github/scripts/setup-secrets.sh`

```bash
# Interactive setup
./.github/scripts/setup-secrets.sh

# Manual setup (individual secrets)
gh secret set VERCEL_TOKEN --body "your_token_here"
gh secret set DATABASE_URL --body "postgresql://..."
```

### 2. Environment File + GitHub CLI

**Requirements:**
- GitHub CLI (`gh`) installed
- Environment file with secrets

**Advantages:**
- ✅ Batch processing
- ✅ Version controlled template
- ✅ Good for team setup
- ✅ Reusable configuration

**Script:** `.github/scripts/setup-secrets-from-env.sh`

```bash
# Setup from custom file
./.github/scripts/setup-secrets-from-env.sh .env.production

# Setup from default file
./.github/scripts/setup-secrets-from-env.sh
```

### 3. GitHub REST API (Advanced)

**Requirements:**
- Node.js runtime
- GitHub Personal Access Token
- `@octokit/rest` package

**Advantages:**
- ✅ Full programmatic control
- ✅ Can be integrated into other tools
- ✅ Works in any environment
- ✅ Supports advanced features

**Script:** `.github/scripts/setup-secrets-api.js`

```bash
# Install dependencies
npm install @octokit/rest

# Run with environment variables
GITHUB_TOKEN=your_token \
GITHUB_REPOSITORY_OWNER=your_username \
GITHUB_REPOSITORY_NAME=mexc-sniper-bot \
node .github/scripts/setup-secrets-api.js
```

### 4. One-Liner Commands

For quick setup of individual secrets:

```bash
# Set individual secrets
gh secret set VERCEL_TOKEN --body "$(echo -n 'your_token' | base64 -d)"
gh secret set DATABASE_URL --body "$(cat database_url.txt)"
gh secret set MEXC_API_KEY --body "$MEXC_API_KEY"

# Set from environment variables
env | grep '^MEXC_\|^VERCEL_\|^KINDE_' | while read line; do
  key=$(echo $line | cut -d= -f1)
  value=$(echo $line | cut -d= -f2-)
  gh secret set "$key" --body "$value"
done
```

### 5. GitHub Actions Workflow

For automated setup within CI/CD:

```yaml
# .github/workflows/setup-secrets.yml
name: Setup Secrets
on: workflow_dispatch

jobs:
  setup-secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup secrets from repository variables
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          # Set secrets from repository variables
          gh secret set VERCEL_TOKEN --body "${{ vars.VERCEL_TOKEN }}"
          gh secret set DATABASE_URL --body "${{ vars.DATABASE_URL }}"
```

## 🔧 Configuration Files

### Environment Template (`.env.secrets.template`)

```bash
# Copy and modify this template
cp .env.secrets.template .env.secrets

# Required secrets
VERCEL_TOKEN=your_vercel_token
VERCEL_ORG_ID=your_org_id
DATABASE_URL=postgresql://...
MEXC_API_KEY=your_api_key
# ... etc
```

### Package.json Scripts

Add these to your `package.json` for easy access:

```json
{
  "scripts": {
    "secrets:setup": "./.github/scripts/setup-secrets.sh",
    "secrets:setup-from-env": "./.github/scripts/setup-secrets-from-env.sh",
    "secrets:list": "gh secret list",
    "secrets:verify": "gh workflow run environment-validation.yml"
  }
}
```

## 🛡️ Security Best Practices

### 1. Environment File Security

```bash
# Add to .gitignore
echo ".env.secrets" >> .gitignore
echo "*.env.local" >> .gitignore

# Set restrictive permissions
chmod 600 .env.secrets

# Delete after use
rm .env.secrets
```

### 2. Token Security

```bash
# Use environment variables for tokens
export GITHUB_TOKEN=$(security find-generic-password -a "$USER" -s "github_token" -w)

# Or use a secure credential store
gh auth login --with-token < ~/.config/gh/token
```

### 3. Audit and Rotation

```bash
# List current secrets
gh secret list

# Check secret last updated times
gh api repos/:owner/:repo/actions/secrets

# Rotate secrets regularly
gh secret set SECRET_NAME --body "new_value"
```

## 🚨 Troubleshooting

### Common Issues

**1. GitHub CLI not authenticated**
```bash
# Fix: Authenticate with GitHub
gh auth login
gh auth status
```

**2. Permission denied**
```bash
# Fix: Check repository permissions
gh repo view --json permissions
gh auth refresh -s admin:repo
```

**3. Script not executable**
```bash
# Fix: Make scripts executable
chmod +x .github/scripts/*.sh
```

**4. Environment file not found**
```bash
# Fix: Create from template
cp .env.secrets.template .env.secrets
```

### Validation Commands

```bash
# Verify secrets were set
gh secret list

# Test specific secret (will show encrypted value)
gh secret list | grep VERCEL_TOKEN

# Validate environment setup
gh workflow run environment-validation.yml

# Check workflow status
gh run list --workflow=environment-validation.yml
```

## 🔄 Automation Examples

### 1. Team Onboarding Script

```bash
#!/bin/bash
# onboard-developer.sh

echo "🚀 Setting up development environment..."

# Clone repository
git clone https://github.com/your-org/mexc-sniper-bot.git
cd mexc-sniper-bot

# Setup secrets
./.github/scripts/setup-secrets.sh

# Setup Vercel
vercel link
vercel env add DATABASE_URL production
vercel env add MEXC_API_KEY production

echo "✅ Setup complete!"
```

### 2. Environment Migration

```bash
#!/bin/bash
# migrate-secrets.sh

# Export from old repository
gh secret list --repo old-org/old-repo > old-secrets.txt

# Import to new repository  
./.github/scripts/setup-secrets-from-env.sh production.env

echo "✅ Secrets migrated!"
```

### 3. Bulk Repository Setup

```bash
#!/bin/bash
# bulk-setup.sh

REPOS=("repo1" "repo2" "repo3")

for repo in "${REPOS[@]}"; do
  echo "Setting up secrets for $repo..."
  
  gh secret set SHARED_SECRET --body "$SHARED_VALUE" --repo "org/$repo"
  gh secret set DATABASE_URL --body "${repo}_database_url" --repo "org/$repo"
done
```

## 📊 Comparison Matrix

| Method | Ease of Use | Security | Automation | Team Setup |
|--------|-------------|----------|------------|------------|
| Interactive Script | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| Environment File | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| REST API | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| GitHub CLI | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| GitHub Actions | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

## 🎯 Recommended Workflow

For most teams, we recommend this workflow:

1. **Individual Setup:** Use the interactive script
   ```bash
   ./.github/scripts/setup-secrets.sh
   ```

2. **Team Setup:** Use environment file method
   ```bash
   cp .env.secrets.template .env.secrets
   # Fill in values
   ./.github/scripts/setup-secrets-from-env.sh
   ```

3. **Validation:** Always validate after setup
   ```bash
   gh workflow run environment-validation.yml
   ```

4. **Maintenance:** Use GitHub CLI for updates
   ```bash
   gh secret set SECRET_NAME --body "new_value"
   ```

This approach provides the best balance of security, usability, and automation for most development teams.

---

## 📞 Support

If you encounter issues:
- Check the troubleshooting section above
- Verify GitHub CLI authentication: `gh auth status`
- Test with a simple secret first: `gh secret set TEST_SECRET --body "test"`
- Review GitHub repository permissions and access levels

For additional help, create an issue with the specific error message and setup method used.