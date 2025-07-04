# Environment Setup Guide

Complete guide for configuring environment variables for the MEXC Sniper Bot system.

## Quick Start

### 1. Check Current Status
```bash
# Run comprehensive environment analysis
bun run scripts/environment-setup.ts

# Quick health check only
bun run scripts/environment-setup.ts --check

# Check via API
curl http://localhost:3008/api/health/environment
```

### 2. Generate Development Template
```bash
# Generate template with missing variables
bun run scripts/environment-setup.ts --template

# Copy generated template
cp .env.development.generated .env.local
```

### 3. Configure Required Variables
Edit `.env.local` and set these **REQUIRED** variables:

```bash
# AI Integration (Required for multi-agent system)
OPENAI_API_KEY="sk-your-openai-api-key"

# Security (Required for encryption)
ENCRYPTION_MASTER_KEY="generate-with-openssl-rand-base64-32"

# Authentication (Required for user access)
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### 4. Verify Configuration
```bash
# Run health check
bun run scripts/environment-setup.ts --check

# Start application
npm run dev
```

## Detailed Setup

### Core Application Variables

#### **NODE_ENV** (Optional)
- **Description**: Application environment mode
- **Default**: `development`
- **Values**: `development`, `production`, `test`

#### **LOG_LEVEL** (Optional)
- **Description**: Logging verbosity level
- **Default**: `info`
- **Values**: `debug`, `info`, `warn`, `error`

### AI Integration (Required for Multi-Agent System)

#### **OPENAI_API_KEY** (Required)
- **Description**: OpenAI API key for AI agent functionality
- **Setup**: Get from [OpenAI Platform](https://platform.openai.com/api-keys)
- **Format**: `sk-your-openai-api-key`

#### **ANTHROPIC_API_KEY** (Optional but Recommended)
- **Description**: Anthropic Claude API key for enhanced AI capabilities
- **Setup**: Get from [Anthropic Console](https://console.anthropic.com/)
- **Format**: `sk-ant-your-anthropic-api-key`
- **Impact**: Enhanced AI capabilities will be limited without this

#### **GEMINI_API_KEY** (Optional)
- **Description**: Google Gemini API key for additional AI features
- **Setup**: Get from [Google AI Studio](https://makersuite.google.com/app/apikey)
- **Impact**: Gemini AI features will be unavailable

#### **PERPLEXITY_API_KEY** (Optional)
- **Description**: Perplexity API key for research and insights
- **Setup**: Get from [Perplexity](https://www.perplexity.ai/settings/api)
- **Format**: `pplx-your-perplexity-api-key`
- **Impact**: Research and insight features will be limited

### MEXC Exchange Integration (Optional for Live Trading)

#### **MEXC_API_KEY** (Optional)
- **Description**: MEXC Exchange API key for trading operations
- **Setup**: Get from [MEXC API Management](https://mexc.com/en-US/user-center/api-management)
- **Format**: `mx_your-mexc-api-key`
- **Impact**: Live trading will be unavailable without MEXC credentials

#### **MEXC_SECRET_KEY** (Optional)
- **Description**: MEXC Exchange secret key
- **Setup**: Generated with API key
- **Security**: Keep confidential, never expose publicly

#### Advanced MEXC Configuration
```bash
MEXC_BASE_URL="https://api.mexc.com"          # API base URL
MEXC_WEBSOCKET_URL="wss://wbs.mexc.com/ws"    # WebSocket URL
MEXC_TIMEOUT="30000"                          # Request timeout (ms)
MEXC_RETRY_COUNT="3"                          # Max retries
MEXC_RETRY_DELAY="1000"                       # Retry delay (ms)
MEXC_RATE_LIMIT_DELAY="200"                   # Rate limit delay (ms)
```

### Database Configuration

#### **DATABASE_URL** (Recommended)
- **Description**: Primary database connection URL
- **Examples**:
  - PostgreSQL: `postgresql://user:pass@host:5432/dbname`
  - Neon: `postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require`
- **Impact**: Database functionality will be limited to SQLite without this

#### **NEON_API_KEY** (Optional)
- **Description**: Neon database API key for advanced features
- **Setup**: Get from [Neon Console](https://console.neon.tech/)
- **Format**: `napi_your-neon-api-key`

#### TursoDB Configuration (Optional)
```bash
TURSO_DATABASE_URL="libsql://your-database.turso.io"
TURSO_AUTH_TOKEN="your-turso-auth-token"
TURSO_DATABASE_NAME="mexc-sniper-bot"
TURSO_EMBEDDED_PATH="./data/mexc_sniper_replica.db"
TURSO_SYNC_INTERVAL="30"
TURSO_USE_EMBEDDED="true"
```

### Caching & Performance

#### **Redis/Valkey Configuration**
```bash
VALKEY_URL="redis://localhost:6379/0"         # Primary cache
REDIS_URL="redis://localhost:6379/0"          # Alternative
REDIS_HOST="localhost"                        # Host only
REDIS_PORT="6379"                             # Port only
REDIS_PASSWORD=""                             # Password if required
```

#### **Cache Performance Settings**
```bash
CACHE_ENABLED="true"                          # Enable caching
CACHE_PREFIX="mexc-sniper:"                   # Key prefix
CACHE_TTL="300"                               # Default TTL (seconds)

# Advanced cache configuration
CACHE_API_RESPONSE_TTL="5000"                 # API cache (ms)
CACHE_MARKET_DATA_TTL="5000"                  # Market data (ms)
CACHE_PATTERN_DATA_TTL="30000"                # Pattern data (ms)
CACHE_TRADING_SIGNAL_TTL="10000"              # Trading signals (ms)

# Cache enhancement features
CACHE_ENABLE_GRACEFUL_DEGRADATION="true"      # Graceful fallback
CACHE_ENABLE_WARMING="true"                   # Proactive warming
CACHE_ENABLE_METRICS="true"                   # Performance metrics
CACHE_ENABLE_BATCH_OPERATIONS="true"          # Batch operations
CACHE_MAX_BATCH_SIZE="50"                     # Max batch size
```

#### **Cache Warming Configuration**
```bash
CACHE_WARMING_INTERVAL="30000"                # Warming cycle (ms)
CACHE_WARMING_MAX_CONCURRENT="3"              # Max concurrent ops
CACHE_WARMING_ENABLE_MEXC_SYMBOLS="true"      # Symbol warming
CACHE_WARMING_ENABLE_PATTERN_DATA="true"      # Pattern warming
CACHE_WARMING_ENABLE_ACTIVITY_DATA="true"     # Activity warming
```

### Security & Authentication

#### **ENCRYPTION_MASTER_KEY** (Required)
- **Description**: Master encryption key for securing API credentials
- **Generation**: `openssl rand -base64 32`
- **Security**: CRITICAL - Loss of this key means loss of encrypted data
- **Backup**: Store securely and separately from code

#### **Kinde Authentication** (Required)
```bash
KINDE_CLIENT_ID="your-kinde-client-id"
KINDE_CLIENT_SECRET="your-kinde-client-secret"
KINDE_ISSUER_URL="https://your-domain.kinde.com"
KINDE_SITE_URL="http://localhost:3008"
KINDE_POST_LOGOUT_REDIRECT_URL="http://localhost:3008"
KINDE_POST_LOGIN_REDIRECT_URL="http://localhost:3008/dashboard"
```

#### **OAuth Providers** (Optional)
```bash
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
```

#### **Rate Limiting**
```bash
RATE_LIMIT_ENABLED="true"                     # Enable rate limiting
RATE_LIMIT_REQUESTS="100"                     # Max requests
RATE_LIMIT_WINDOW="60"                        # Window (seconds)
```

### Monitoring & Performance

#### **Performance Monitoring**
```bash
PERFORMANCE_MONITORING_ENABLED="true"         # Enable monitoring
PERFORMANCE_METRICS_INTERVAL="30000"          # Collection interval (ms)
PERFORMANCE_ENABLE_ALERTS="true"              # Enable alerts
PERFORMANCE_ENABLE_RECOMMENDATIONS="true"     # Enable recommendations
```

#### **External Monitoring Services**
```bash
SENTRY_DSN="https://xxxxx@sentry.io/xxxxx"    # Error tracking
VERCEL_ANALYTICS_ID="xxxxx"                   # Vercel Analytics
```

### Workflow Orchestration

#### **Inngest Configuration**
```bash
INNGEST_SIGNING_KEY="signkey-dev-auto-generated"    # Auto-generated for dev
INNGEST_EVENT_KEY="auto-generated-event-key"        # Auto-generated for dev
INNGEST_ENV="development"                            # Environment
```

### Development & Testing

#### **Debug Settings**
```bash
DEBUG="false"                                 # Debug mode
VERBOSE_LOGGING="false"                       # Verbose logs
PLAYWRIGHT_TEST="false"                       # Playwright mode
VITEST="false"                                # Vitest mode
```

### Deployment Variables

#### **Vercel Deployment**
```bash
VERCEL="1"                                    # Set by Vercel
VERCEL_ENV="production"                       # Environment
VERCEL_URL="your-app.vercel.app"              # Deployment URL
VERCEL_DEPLOYMENT_ID="dpl_xxxxx"              # Deployment ID
VERCEL_PROJECT_ID="prj_xxxxx"                 # Project ID
```

## Environment Validation

### Health Check Commands

```bash
# Comprehensive analysis
bun run scripts/environment-setup.ts

# Quick health check (exit codes: 0=healthy, 1=critical, 2=warning)
bun run scripts/environment-setup.ts --check

# Generate missing template
bun run scripts/environment-setup.ts --template

# Validate specific variables
bun run scripts/environment-setup.ts --validate OPENAI_API_KEY,MEXC_API_KEY
```

### API Endpoints

```bash
# Environment health check
GET /api/health/environment

# Generate development template
POST /api/health/environment
{
  "action": "generate_template"
}

# Validate specific variables
POST /api/health/environment
{
  "action": "validate_specific",
  "variables": ["OPENAI_API_KEY", "MEXC_API_KEY"]
}
```

### Health Status Levels

- **🟢 Healthy (Score: 90-100)**: All required variables configured, most optional variables set
- **🟡 Warning (Score: 70-89)**: All required variables configured, some optional variables missing
- **🔴 Critical (Score: 0-69)**: Required variables missing, system may not function properly

## Troubleshooting

### Common Issues

#### 1. "Required environment variables missing"
```bash
# Check which variables are missing
bun run scripts/environment-setup.ts --check

# Generate template with missing variables
bun run scripts/environment-setup.ts --template

# Copy template and fill in required values
cp .env.development.generated .env.local
```

#### 2. "Invalid environment variable values"
```bash
# Check specific variables
bun run scripts/environment-setup.ts --validate VAR1,VAR2

# Common validation issues:
# - MEXC_TIMEOUT must be >= 5000
# - LOG_LEVEL must be: debug, info, warn, error
# - Ports must be between 1000-65535
```

#### 3. "Environment configuration has critical issues"
- Check startup logs for specific error messages
- Verify required variables are set correctly
- Ensure encryption keys are properly generated
- Validate API keys are active and have sufficient permissions

#### 4. "Cache/Redis connection failed"
```bash
# Check Redis/Valkey configuration
VALKEY_URL="redis://localhost:6379/0"

# Or disable caching temporarily
CACHE_ENABLED="false"
```

### Getting Help

1. **Environment Analysis**: `bun run scripts/environment-setup.ts`
2. **Health Check API**: `curl http://localhost:3008/api/health/environment`
3. **Documentation**: This file and `.env.example`
4. **Configuration Management**: `/src/lib/unified-configuration-management.ts`
5. **Validation Service**: `/src/services/enhanced-environment-validation.ts`

## Security Best Practices

### 🔐 Environment File Security
- ✅ Use `.env.local` for local development (never commit)
- ✅ Use deployment platform environment variables for production
- ✅ Generate strong encryption keys: `openssl rand -base64 32`
- ✅ Rotate API keys regularly
- ✅ Use different keys for development/staging/production

### 🚫 Never Commit
- API keys or secrets
- Real database URLs with credentials
- Production encryption keys
- OAuth client secrets

### ✅ Always Commit
- `.env.example` with documentation
- Environment validation logic
- Setup scripts and documentation

## Examples

### Minimal Development Setup
```bash
# Required only
OPENAI_API_KEY="sk-your-openai-api-key"
ENCRYPTION_MASTER_KEY="Zka8eT3g9wqHOeWEOta6f7iII+zqCeE/rSFsPAA6FII="
KINDE_CLIENT_ID="your-kinde-client-id"
KINDE_CLIENT_SECRET="your-kinde-client-secret"
KINDE_ISSUER_URL="https://your-domain.kinde.com"
```

### Full Development Setup
```bash
# Copy from .env.development.template
# Fill in all required and recommended variables
# Customize optional variables as needed
```

### Production Setup
```bash
# Use deployment platform environment variables
# Set via Vercel dashboard, Railway, or similar
# Never store production secrets in files
```

## Migration Guide

### From Basic to Enhanced Configuration

1. **Backup current `.env.local`**
2. **Run environment analysis**: `bun run scripts/environment-setup.ts`
3. **Generate new template**: `bun run scripts/environment-setup.ts --template`
4. **Merge configurations**: Copy missing variables from template
5. **Verify setup**: `bun run scripts/environment-setup.ts --check`

### Updating Existing Projects

1. **Pull latest code** with environment improvements
2. **Run health check** to see what's missing
3. **Add missing variables** using generated template
4. **Test application** with new configuration
5. **Monitor health** with regular checks