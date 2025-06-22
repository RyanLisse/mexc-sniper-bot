/**
 * Enhanced Environment Validation Service
 * 
 * Comprehensive environment variable validation with detailed reporting,
 * development defaults, and clear error messaging.
 * 
 * FIXES:
 * - Missing optional environment variables detection
 * - Development environment defaults provision
 * - Better error messages for configuration issues
 * - Automated environment health checking
 */

export interface EnvironmentVariable {
  key: string;
  description: string;
  required: boolean;
  category: 'core' | 'api' | 'database' | 'cache' | 'monitoring' | 'security' | 'development' | 'deployment';
  defaultValue?: string;
  validator?: (value: string) => boolean;
  example?: string;
  warningIfMissing?: string;
}

export interface EnvironmentValidationResult {
  isValid: boolean;
  status: 'complete' | 'issues' | 'critical';
  summary: {
    total: number;
    configured: number;
    missing: number;
    invalid: number;
    warnings: number;
  };
  results: Array<{
    key: string;
    status: 'configured' | 'missing' | 'invalid' | 'default';
    value?: string;
    message?: string;
    category: string;
    required: boolean;
  }>;
  recommendations: string[];
  developmentDefaults: Record<string, string>;
}

/**
 * Complete environment variable definitions
 */
export const ENVIRONMENT_VARIABLES: EnvironmentVariable[] = [
  // Core Application
  {
    key: 'NODE_ENV',
    description: 'Application environment mode',
    required: false,
    category: 'core',
    defaultValue: 'development',
    example: 'development',
  },
  {
    key: 'ENVIRONMENT',
    description: 'Custom environment identifier',
    required: false,
    category: 'core',
    defaultValue: 'development',
    example: 'development',
  },
  {
    key: 'DEBUG',
    description: 'Enable debug mode',
    required: false,
    category: 'development',
    defaultValue: 'false',
    example: 'false',
  },
  {
    key: 'LOG_LEVEL',
    description: 'Logging level',
    required: false,
    category: 'core',
    defaultValue: 'info',
    example: 'info',
    validator: (value) => ['debug', 'info', 'warn', 'error'].includes(value),
  },
  {
    key: 'VERBOSE_LOGGING',
    description: 'Enable verbose logging',
    required: false,
    category: 'development',
    defaultValue: 'false',
    example: 'false',
  },

  // AI/ML Services
  {
    key: 'OPENAI_API_KEY',
    description: 'OpenAI API key for AI agent functionality',
    required: true,
    category: 'api',
    example: 'sk-your-openai-api-key',
  },
  {
    key: 'ANTHROPIC_API_KEY',
    description: 'Anthropic Claude API key for enhanced AI capabilities',
    required: false,
    category: 'api',
    example: 'sk-ant-your-anthropic-api-key',
    warningIfMissing: 'Enhanced AI capabilities will be limited without Anthropic API key',
  },
  {
    key: 'GEMINI_API_KEY',
    description: 'Google Gemini API key for additional AI features',
    required: false,
    category: 'api',
    example: 'your-gemini-api-key',
    warningIfMissing: 'Gemini AI features will be unavailable',
  },
  {
    key: 'PERPLEXITY_API_KEY',
    description: 'Perplexity API key for research and insights',
    required: false,
    category: 'api',
    example: 'pplx-your-perplexity-api-key',
    warningIfMissing: 'Research and insight features will be limited',
  },

  // MEXC Exchange
  {
    key: 'MEXC_API_KEY',
    description: 'MEXC Exchange API key for trading operations',
    required: false,
    category: 'api',
    example: 'mx_your-mexc-api-key',
    warningIfMissing: 'Live trading will be unavailable without MEXC credentials',
  },
  {
    key: 'MEXC_SECRET_KEY',
    description: 'MEXC Exchange secret key',
    required: false,
    category: 'api',
    example: 'your-mexc-secret-key',
  },
  {
    key: 'MEXC_BASE_URL',
    description: 'MEXC API base URL',
    required: false,
    category: 'api',
    defaultValue: 'https://api.mexc.com',
    example: 'https://api.mexc.com',
  },
  {
    key: 'MEXC_WEBSOCKET_URL',
    description: 'MEXC WebSocket URL for real-time data',
    required: false,
    category: 'api',
    defaultValue: 'wss://wbs.mexc.com/ws',
    example: 'wss://wbs.mexc.com/ws',
  },
  {
    key: 'MEXC_TIMEOUT',
    description: 'MEXC API request timeout in milliseconds',
    required: false,
    category: 'api',
    defaultValue: '30000',
    example: '30000',
    validator: (value) => !isNaN(Number(value)) && Number(value) >= 5000,
  },
  {
    key: 'MEXC_RETRY_COUNT',
    description: 'Maximum retry attempts for MEXC API calls',
    required: false,
    category: 'api',
    defaultValue: '3',
    example: '3',
    validator: (value) => !isNaN(Number(value)) && Number(value) >= 0 && Number(value) <= 10,
  },
  {
    key: 'MEXC_RETRY_DELAY',
    description: 'Delay between MEXC API retry attempts in milliseconds',
    required: false,
    category: 'api',
    defaultValue: '1000',
    example: '1000',
  },
  {
    key: 'MEXC_RATE_LIMIT_DELAY',
    description: 'Delay between MEXC API calls to respect rate limits',
    required: false,
    category: 'api',
    defaultValue: '200',
    example: '200',
  },

  // Database Configuration
  {
    key: 'DATABASE_URL',
    description: 'Primary database connection URL',
    required: false,
    category: 'database',
    example: 'postgresql://user:pass@host:5432/dbname',
    warningIfMissing: 'Database functionality will be limited to SQLite',
  },
  {
    key: 'NEON_API_KEY',
    description: 'Neon database API key for advanced features',
    required: false,
    category: 'database',
    example: 'napi_your-neon-api-key',
  },
  {
    key: 'TURSO_DATABASE_URL',
    description: 'TursoDB database URL for distributed SQLite',
    required: false,
    category: 'database',
    example: 'libsql://your-database.turso.io',
  },
  {
    key: 'TURSO_AUTH_TOKEN',
    description: 'TursoDB authentication token',
    required: false,
    category: 'database',
    example: 'your-turso-auth-token',
  },
  {
    key: 'TURSO_DATABASE_NAME',
    description: 'TursoDB database name',
    required: false,
    category: 'database',
    example: 'mexc-sniper-bot',
  },
  {
    key: 'TURSO_HOST',
    description: 'TursoDB host URL',
    required: false,
    category: 'database',
    example: 'your-database.turso.io',
  },
  {
    key: 'TURSO_EMBEDDED_PATH',
    description: 'Local path for embedded TursoDB replica',
    required: false,
    category: 'database',
    defaultValue: './data/mexc_sniper_replica.db',
    example: './data/mexc_sniper_replica.db',
  },
  {
    key: 'TURSO_SYNC_INTERVAL',
    description: 'TursoDB sync interval in seconds',
    required: false,
    category: 'database',
    defaultValue: '30',
    example: '30',
  },
  {
    key: 'TURSO_USE_EMBEDDED',
    description: 'Use embedded TursoDB replica',
    required: false,
    category: 'database',
    defaultValue: 'true',
    example: 'true',
  },
  {
    key: 'USE_EMBEDDED_REPLICA',
    description: 'Enable embedded database replica',
    required: false,
    category: 'database',
    defaultValue: 'true',
    example: 'true',
  },
  {
    key: 'TURSO_REPLICA_URL',
    description: 'TursoDB replica URL for failover',
    required: false,
    category: 'database',
    example: 'libsql://replica-url.turso.io',
  },
  {
    key: 'FORCE_SQLITE',
    description: 'Force SQLite usage instead of other databases',
    required: false,
    category: 'database',
    defaultValue: 'false',
    example: 'false',
  },

  // Caching & Performance
  {
    key: 'CACHE_ENABLED',
    description: 'Enable caching system',
    required: false,
    category: 'cache',
    defaultValue: 'true',
    example: 'true',
  },
  {
    key: 'CACHE_PREFIX',
    description: 'Cache key prefix',
    required: false,
    category: 'cache',
    defaultValue: 'mexc-sniper:',
    example: 'mexc-sniper:',
  },
  {
    key: 'CACHE_TTL',
    description: 'Default cache TTL in seconds',
    required: false,
    category: 'cache',
    defaultValue: '300',
    example: '300',
  },
  {
    key: 'CACHE_API_RESPONSE_TTL',
    description: 'API response cache TTL in milliseconds',
    required: false,
    category: 'cache',
    defaultValue: '5000',
    example: '5000',
  },
  {
    key: 'CACHE_MARKET_DATA_TTL',
    description: 'Market data cache TTL in milliseconds',
    required: false,
    category: 'cache',
    defaultValue: '5000',
    example: '5000',
  },
  {
    key: 'CACHE_PATTERN_DATA_TTL',
    description: 'Pattern analysis cache TTL in milliseconds',
    required: false,
    category: 'cache',
    defaultValue: '30000',
    example: '30000',
  },
  {
    key: 'CACHE_TRADING_SIGNAL_TTL',
    description: 'Trading signal cache TTL in milliseconds',
    required: false,
    category: 'cache',
    defaultValue: '10000',
    example: '10000',
  },
  {
    key: 'CACHE_ENABLE_GRACEFUL_DEGRADATION',
    description: 'Enable graceful cache degradation when unavailable',
    required: false,
    category: 'cache',
    defaultValue: 'true',
    example: 'true',
  },
  {
    key: 'CACHE_ENABLE_WARMING',
    description: 'Enable proactive cache warming',
    required: false,
    category: 'cache',
    defaultValue: 'true',
    example: 'true',
  },
  {
    key: 'CACHE_ENABLE_METRICS',
    description: 'Enable cache performance metrics',
    required: false,
    category: 'cache',
    defaultValue: 'true',
    example: 'true',
  },
  {
    key: 'CACHE_ENABLE_BATCH_OPERATIONS',
    description: 'Enable intelligent cache batching',
    required: false,
    category: 'cache',
    defaultValue: 'true',
    example: 'true',
  },
  {
    key: 'CACHE_MAX_BATCH_SIZE',
    description: 'Maximum cache batch operation size',
    required: false,
    category: 'cache',
    defaultValue: '50',
    example: '50',
  },
  {
    key: 'CACHE_ENABLE_INCREMENTAL_PROCESSING',
    description: 'Enable incremental cache processing',
    required: false,
    category: 'cache',
    defaultValue: 'true',
    example: 'true',
  },

  // Cache Warming Configuration
  {
    key: 'CACHE_WARMING_INTERVAL',
    description: 'Cache warming cycle interval in milliseconds',
    required: false,
    category: 'cache',
    defaultValue: '30000',
    example: '30000',
  },
  {
    key: 'CACHE_WARMING_MAX_CONCURRENT',
    description: 'Maximum concurrent cache warming operations',
    required: false,
    category: 'cache',
    defaultValue: '3',
    example: '3',
  },
  {
    key: 'CACHE_WARMING_ENABLE_MEXC_SYMBOLS',
    description: 'Enable MEXC symbol data warming',
    required: false,
    category: 'cache',
    defaultValue: 'true',
    example: 'true',
  },
  {
    key: 'CACHE_WARMING_ENABLE_PATTERN_DATA',
    description: 'Enable pattern detection data warming',
    required: false,
    category: 'cache',
    defaultValue: 'true',
    example: 'true',
  },
  {
    key: 'CACHE_WARMING_ENABLE_ACTIVITY_DATA',
    description: 'Enable activity data warming',
    required: false,
    category: 'cache',
    defaultValue: 'true',
    example: 'true',
  },

  // Redis/Valkey Configuration
  {
    key: 'VALKEY_URL',
    description: 'Valkey/Redis connection URL',
    required: false,
    category: 'cache',
    defaultValue: 'redis://localhost:6379/0',
    example: 'redis://localhost:6379/0',
  },
  {
    key: 'REDIS_URL',
    description: 'Redis connection URL (alternative to Valkey)',
    required: false,
    category: 'cache',
    example: 'redis://localhost:6379/0',
  },
  {
    key: 'REDIS_HOST',
    description: 'Redis host address',
    required: false,
    category: 'cache',
    defaultValue: 'localhost',
    example: 'localhost',
  },
  {
    key: 'REDIS_PORT',
    description: 'Redis port number',
    required: false,
    category: 'cache',
    defaultValue: '6379',
    example: '6379',
  },
  {
    key: 'REDIS_PASSWORD',
    description: 'Redis authentication password',
    required: false,
    category: 'cache',
    example: 'your-redis-password',
  },

  // Performance Monitoring
  {
    key: 'PERFORMANCE_MONITORING_ENABLED',
    description: 'Enable real-time performance monitoring',
    required: false,
    category: 'monitoring',
    defaultValue: 'true',
    example: 'true',
  },
  {
    key: 'PERFORMANCE_METRICS_INTERVAL',
    description: 'Performance metrics collection interval in milliseconds',
    required: false,
    category: 'monitoring',
    defaultValue: '30000',
    example: '30000',
  },
  {
    key: 'PERFORMANCE_ENABLE_ALERTS',
    description: 'Enable performance alerts',
    required: false,
    category: 'monitoring',
    defaultValue: 'true',
    example: 'true',
  },
  {
    key: 'PERFORMANCE_ENABLE_RECOMMENDATIONS',
    description: 'Enable optimization recommendations',
    required: false,
    category: 'monitoring',
    defaultValue: 'true',
    example: 'true',
  },

  // Rate Limiting
  {
    key: 'RATE_LIMIT_ENABLED',
    description: 'Enable API rate limiting',
    required: false,
    category: 'security',
    defaultValue: 'true',
    example: 'true',
  },
  {
    key: 'RATE_LIMIT_REQUESTS',
    description: 'Rate limit maximum requests',
    required: false,
    category: 'security',
    defaultValue: '100',
    example: '100',
  },
  {
    key: 'RATE_LIMIT_WINDOW',
    description: 'Rate limit window in seconds',
    required: false,
    category: 'security',
    defaultValue: '60',
    example: '60',
  },

  // Encryption & Security
  {
    key: 'ENCRYPTION_MASTER_KEY',
    description: 'Master encryption key for securing API credentials',
    required: true,
    category: 'security',
    example: 'generate-with-openssl-rand-base64-32',
  },
  {
    key: 'MEXC_CRED_ENCRYPTION_KEY',
    description: 'Encryption key for MEXC credentials',
    required: false,
    category: 'security',
    example: 'your-32-character-encryption-key',
  },
  {
    key: 'ENCRYPTION_KEY_ID',
    description: 'Encryption key ID for rotation tracking',
    required: false,
    category: 'security',
    defaultValue: 'default',
    example: 'default',
  },
  {
    key: 'OLD_ENCRYPTION_KEY',
    description: 'Legacy encryption key for migration',
    required: false,
    category: 'security',
    example: 'legacy-key-for-migration-only',
  },

  // Authentication
  {
    key: 'KINDE_CLIENT_ID',
    description: 'Kinde authentication client ID',
    required: true,
    category: 'security',
    example: 'your-kinde-client-id',
  },
  {
    key: 'KINDE_CLIENT_SECRET',
    description: 'Kinde authentication client secret',
    required: true,
    category: 'security',
    example: 'your-kinde-client-secret',
  },
  {
    key: 'KINDE_ISSUER_URL',
    description: 'Kinde issuer URL',
    required: true,
    category: 'security',
    example: 'https://your-domain.kinde.com',
  },
  {
    key: 'KINDE_SITE_URL',
    description: 'Kinde site URL',
    required: false,
    category: 'security',
    defaultValue: 'http://localhost:3008',
    example: 'http://localhost:3008',
  },
  {
    key: 'KINDE_POST_LOGOUT_REDIRECT_URL',
    description: 'Kinde post-logout redirect URL',
    required: false,
    category: 'security',
    defaultValue: 'http://localhost:3008',
    example: 'http://localhost:3008',
  },
  {
    key: 'KINDE_POST_LOGIN_REDIRECT_URL',
    description: 'Kinde post-login redirect URL',
    required: false,
    category: 'security',
    defaultValue: 'http://localhost:3008/dashboard',
    example: 'http://localhost:3008/dashboard',
  },
  {
    key: 'AUTH_SECRET',
    description: 'Authentication secret for NextAuth.js',
    required: false,
    category: 'security',
    example: 'your-auth-secret',
  },
  {
    key: 'NEXTAUTH_URL',
    description: 'NextAuth.js URL',
    required: false,
    category: 'security',
    defaultValue: 'http://localhost:3008',
    example: 'http://localhost:3008',
  },
  {
    key: 'NEXTAUTH_SECRET',
    description: 'NextAuth.js secret',
    required: false,
    category: 'security',
    example: 'your-nextauth-secret',
  },

  // OAuth Providers
  {
    key: 'GOOGLE_CLIENT_ID',
    description: 'Google OAuth client ID',
    required: false,
    category: 'security',
    defaultValue: 'placeholder',
    example: 'your-google-client-id',
  },
  {
    key: 'GOOGLE_CLIENT_SECRET',
    description: 'Google OAuth client secret',
    required: false,
    category: 'security',
    defaultValue: 'placeholder',
    example: 'your-google-client-secret',
  },
  {
    key: 'GITHUB_CLIENT_ID',
    description: 'GitHub OAuth client ID',
    required: false,
    category: 'security',
    defaultValue: 'placeholder',
    example: 'your-github-client-id',
  },
  {
    key: 'GITHUB_CLIENT_SECRET',
    description: 'GitHub OAuth client secret',
    required: false,
    category: 'security',
    defaultValue: 'placeholder',
    example: 'your-github-client-secret',
  },

  // Workflow Orchestration
  {
    key: 'INNGEST_SIGNING_KEY',
    description: 'Inngest workflow signing key',
    required: false,
    category: 'api',
    example: 'signkey-dev-auto-generated-if-not-provided',
  },
  {
    key: 'INNGEST_EVENT_KEY',
    description: 'Inngest event key',
    required: false,
    category: 'api',
    example: 'auto-generated-event-key-for-local-development',
  },
  {
    key: 'INNGEST_ENV',
    description: 'Inngest environment',
    required: false,
    category: 'api',
    defaultValue: 'development',
    example: 'development',
  },

  // Testing & Development
  {
    key: 'PLAYWRIGHT_TEST',
    description: 'Enable Playwright test mode',
    required: false,
    category: 'development',
    defaultValue: 'false',
    example: 'false',
  },
  {
    key: 'VITEST',
    description: 'Enable Vitest test mode',
    required: false,
    category: 'development',
    defaultValue: 'false',
    example: 'false',
  },

  // Deployment Environment
  {
    key: 'VERCEL',
    description: 'Vercel deployment indicator',
    required: false,
    category: 'deployment',
    example: '1',
  },
  {
    key: 'RAILWAY_ENVIRONMENT',
    description: 'Railway deployment environment',
    required: false,
    category: 'deployment',
    example: 'production',
  },
  {
    key: 'VERCEL_ENV',
    description: 'Vercel environment type',
    required: false,
    category: 'deployment',
    example: 'production',
  },
  {
    key: 'VERCEL_URL',
    description: 'Vercel deployment URL',
    required: false,
    category: 'deployment',
    example: 'your-app.vercel.app',
  },
  {
    key: 'VERCEL_DEPLOYMENT_ID',
    description: 'Vercel deployment ID',
    required: false,
    category: 'deployment',
    example: 'dpl_xxxxx',
  },
  {
    key: 'VERCEL_PROJECT_ID',
    description: 'Vercel project ID',
    required: false,
    category: 'deployment',
    example: 'prj_xxxxx',
  },
  {
    key: 'VERCEL_PROJECT_PRODUCTION_URL',
    description: 'Vercel production URL',
    required: false,
    category: 'deployment',
    example: 'your-app.vercel.app',
  },
  {
    key: 'VERCEL_OIDC_TOKEN',
    description: 'Vercel OIDC token',
    required: false,
    category: 'deployment',
    example: 'vercel-oidc-token',
  },

  // Monitoring & Analytics
  {
    key: 'SENTRY_DSN',
    description: 'Sentry error tracking DSN',
    required: false,
    category: 'monitoring',
    example: 'https://xxxxx@sentry.io/xxxxx',
  },
  {
    key: 'VERCEL_ANALYTICS_ID',
    description: 'Vercel Analytics ID',
    required: false,
    category: 'monitoring',
    example: 'xxxxx',
  },
  {
    key: 'BETTER_AUTH_SECRET',
    description: 'Better Auth secret',
    required: false,
    category: 'security',
    example: 'your-auth-secret',
  },
  {
    key: 'BETTER_AUTH_URL',
    description: 'Better Auth URL',
    required: false,
    category: 'security',
    example: 'https://your-app.vercel.app',
  },
];

/**
 * Enhanced Environment Validation Service
 */
export class EnhancedEnvironmentValidation {
  private static instance: EnhancedEnvironmentValidation | null = null;

  static getInstance(): EnhancedEnvironmentValidation {
    if (!EnhancedEnvironmentValidation.instance) {
      EnhancedEnvironmentValidation.instance = new EnhancedEnvironmentValidation();
    }
    return EnhancedEnvironmentValidation.instance;
  }

  /**
   * Validate all environment variables
   */
  validateEnvironment(): EnvironmentValidationResult {
    const results: EnvironmentValidationResult['results'] = [];
    const recommendations: string[] = [];
    const developmentDefaults: Record<string, string> = {};

    let configured = 0;
    let missing = 0;
    let invalid = 0;
    let warnings = 0;

    for (const envVar of ENVIRONMENT_VARIABLES) {
      const value = process.env[envVar.key];
      
      if (value !== undefined && value !== '') {
        // Variable is configured
        if (envVar.validator && !envVar.validator(value)) {
          // Value is invalid
          results.push({
            key: envVar.key,
            status: 'invalid',
            value: value,
            message: `Invalid value: "${value}"`,
            category: envVar.category,
            required: envVar.required,
          });
          invalid++;
          recommendations.push(`Fix invalid value for ${envVar.key}: ${envVar.description}`);
        } else {
          // Value is valid
          results.push({
            key: envVar.key,
            status: 'configured',
            value: this.maskSensitiveValue(envVar.key, value),
            category: envVar.category,
            required: envVar.required,
          });
          configured++;
        }
      } else {
        // Variable is missing
        if (envVar.required) {
          // Required variable missing - critical issue
          results.push({
            key: envVar.key,
            status: 'missing',
            message: `Required variable missing: ${envVar.description}`,
            category: envVar.category,
            required: envVar.required,
          });
          missing++;
          recommendations.push(`CRITICAL: Set required variable ${envVar.key}: ${envVar.description}`);
        } else {
          // Optional variable missing
          if (envVar.defaultValue) {
            results.push({
              key: envVar.key,
              status: 'default',
              value: envVar.defaultValue,
              message: `Using default value: ${envVar.defaultValue}`,
              category: envVar.category,
              required: envVar.required,
            });
            developmentDefaults[envVar.key] = envVar.defaultValue;
          } else {
            results.push({
              key: envVar.key,
              status: 'missing',
              message: envVar.warningIfMissing || `Optional variable not set: ${envVar.description}`,
              category: envVar.category,
              required: envVar.required,
            });
            missing++;
            
            if (envVar.warningIfMissing) {
              warnings++;
              recommendations.push(`OPTIONAL: ${envVar.key} - ${envVar.warningIfMissing}`);
            }
          }
        }
      }
    }

    // Determine overall status
    let status: 'complete' | 'issues' | 'critical' = 'complete';
    if (invalid > 0 || missing > 0) {
      status = results.some(r => r.required && r.status === 'missing') ? 'critical' : 'issues';
    }

    const isValid = status !== 'critical';

    // Add general recommendations
    if (status === 'complete') {
      recommendations.push('All environment variables properly configured');
    } else if (status === 'issues') {
      recommendations.push('Some optional environment variables are missing - consider adding them for enhanced functionality');
    } else {
      recommendations.push('Critical environment variables missing - system may not function properly');
    }

    return {
      isValid,
      status,
      summary: {
        total: ENVIRONMENT_VARIABLES.length,
        configured,
        missing,
        invalid,
        warnings,
      },
      results,
      recommendations,
      developmentDefaults,
    };
  }

  /**
   * Get missing variables by category
   */
  getMissingByCategory(): Record<string, EnvironmentVariable[]> {
    const missing: Record<string, EnvironmentVariable[]> = {};
    
    for (const envVar of ENVIRONMENT_VARIABLES) {
      const value = process.env[envVar.key];
      if (!value || value === '') {
        if (!missing[envVar.category]) {
          missing[envVar.category] = [];
        }
        missing[envVar.category].push(envVar);
      }
    }

    return missing;
  }

  /**
   * Generate development environment template
   */
  generateDevelopmentTemplate(): string {
    const template: string[] = [];
    const categorizedVars = this.groupByCategory();

    template.push('# ====================================');
    template.push('# MEXC Sniper Bot - Development Environment');
    template.push('# ====================================');
    template.push('# Generated development template with defaults');
    template.push('#');
    template.push('# Copy missing variables to your .env.local file');
    template.push('');

    for (const [category, vars] of Object.entries(categorizedVars)) {
      template.push(`# ${category.toUpperCase()}`);
      template.push('# ====================================');
      
      for (const envVar of vars) {
        const value = process.env[envVar.key];
        if (!value || value === '') {
          template.push(`# ${envVar.description}`);
          if (envVar.required) {
            template.push(`${envVar.key}="${envVar.example || 'REQUIRED_VALUE'}"`);
          } else {
            const defaultVal = envVar.defaultValue || envVar.example || '';
            template.push(`${envVar.key}="${defaultVal}"`);
          }
          if (envVar.warningIfMissing) {
            template.push(`# WARNING: ${envVar.warningIfMissing}`);
          }
          template.push('');
        }
      }
      template.push('');
    }

    return template.join('\n');
  }

  /**
   * Get environment health summary
   */
  getHealthSummary(): {
    status: 'healthy' | 'warning' | 'critical';
    score: number;
    issues: string[];
    recommendedActions: string[];
  } {
    const validation = this.validateEnvironment();
    const issues: string[] = [];
    const recommendedActions: string[] = [];

    // Calculate health score
    const requiredConfigured = validation.results.filter(r => r.required && r.status === 'configured').length;
    const totalRequired = validation.results.filter(r => r.required).length;
    const optionalConfigured = validation.results.filter(r => !r.required && (r.status === 'configured' || r.status === 'default')).length;
    const totalOptional = validation.results.filter(r => !r.required).length;

    const requiredScore = totalRequired > 0 ? (requiredConfigured / totalRequired) * 70 : 70;
    const optionalScore = totalOptional > 0 ? (optionalConfigured / totalOptional) * 30 : 30;
    const score = Math.round(requiredScore + optionalScore);

    // Determine status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (validation.status === 'critical') {
      status = 'critical';
      issues.push('Critical environment variables missing');
      recommendedActions.push('Set all required environment variables immediately');
    } else if (validation.status === 'issues' || score < 80) {
      status = 'warning';
      issues.push('Some optional environment variables missing');
      recommendedActions.push('Review and configure optional variables for enhanced functionality');
    }

    // Add specific issues
    const criticalMissing = validation.results.filter(r => r.required && r.status === 'missing');
    const invalidVars = validation.results.filter(r => r.status === 'invalid');

    if (criticalMissing.length > 0) {
      issues.push(`${criticalMissing.length} required variables missing`);
    }
    if (invalidVars.length > 0) {
      issues.push(`${invalidVars.length} variables have invalid values`);
    }

    return {
      status,
      score,
      issues,
      recommendedActions,
    };
  }

  /**
   * Group environment variables by category
   */
  private groupByCategory(): Record<string, EnvironmentVariable[]> {
    const grouped: Record<string, EnvironmentVariable[]> = {};
    
    for (const envVar of ENVIRONMENT_VARIABLES) {
      if (!grouped[envVar.category]) {
        grouped[envVar.category] = [];
      }
      grouped[envVar.category].push(envVar);
    }

    return grouped;
  }

  /**
   * Mask sensitive values for display
   */
  private maskSensitiveValue(key: string, value: string): string {
    const sensitiveKeys = ['key', 'secret', 'token', 'password', 'auth'];
    const isSensitive = sensitiveKeys.some(keyword => key.toLowerCase().includes(keyword));
    
    if (isSensitive && value.length > 8) {
      return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
    }
    
    return value;
  }
}

// Export singleton instance
export const environmentValidation = EnhancedEnvironmentValidation.getInstance();