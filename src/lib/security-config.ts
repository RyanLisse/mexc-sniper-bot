/**
 * Security Configuration for MEXC Sniper Bot
 *
 * Centralized security settings and configurations for production deployment.
 * Implements security best practices and headers for web application protection.
 */

import { UniversalCrypto } from "@/src/lib/browser-compatible-events";

export const SECURITY_CONFIG = {
  // Security Headers for Production
  SECURITY_HEADERS: {
    // HTTPS Enforcement
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",

    // Content Type Protection
    "X-Content-Type-Options": "nosniff",

    // Clickjacking Protection
    "X-Frame-Options": "DENY",

    // XSS Protection
    "X-XSS-Protection": "1; mode=block",

    // Referrer Policy
    "Referrer-Policy": "strict-origin-when-cross-origin",

    // Content Security Policy
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Required for Next.js
      "style-src 'self' 'unsafe-inline'", // Required for Tailwind CSS
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' https://api.mexc.com wss://wbs.mexc.com https://*.supabase.co",
      "frame-ancestors 'none'",
      "form-action 'self' https://*.supabase.co",
      "base-uri 'self'",
    ].join("; "),

    // Permissions Policy
    "Permissions-Policy": [
      "geolocation=()",
      "microphone=()",
      "camera=()",
      "payment=()",
      "usb=()",
      "magnetometer=()",
      "gyroscope=()",
      "accelerometer=()",
    ].join(", "),
  },

  // Rate Limiting Configuration
  RATE_LIMITING: {
    // API endpoints rate limits
    API_GENERAL: {
      windowMs: 60 * 1000, // 1 minute
      max: 100, // limit each IP to 100 requests per windowMs
      message: "Too many requests from this IP, please try again later.",
      standardHeaders: true,
      legacyHeaders: false,
    },

    API_AUTH: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // limit each IP to 5 login attempts per windowMs
      message: "Too many authentication attempts, please try again later.",
      standardHeaders: true,
      legacyHeaders: false,
    },

    API_TRADING: {
      windowMs: 60 * 1000, // 1 minute
      max: 30, // limit trading operations
      message: "Trading rate limit exceeded, please slow down.",
      standardHeaders: true,
      legacyHeaders: false,
    },
  },

  // Input Validation Rules
  INPUT_VALIDATION: {
    // Maximum lengths for various inputs
    MAX_LENGTHS: {
      SYMBOL: 20,
      QUANTITY: 20,
      PRICE: 20,
      PERCENTAGE: 5,
      NOTES: 500,
      CONFIG_VALUE: 1000,
    },

    // Allowed patterns
    PATTERNS: {
      SYMBOL: /^[A-Z0-9]{2,20}$/,
      QUANTITY: /^\d+(\.\d{1,8})?$/,
      PRICE: /^\d+(\.\d{1,8})?$/,
      PERCENTAGE: /^\d{1,2}(\.\d{1,2})?$/,
    },

    // Sanitization rules
    SANITIZE: {
      REMOVE_HTML: true,
      REMOVE_SCRIPTS: true,
      ESCAPE_SQL: true,
    },
  },

  // API Security Configuration
  API_SECURITY: {
    // Allowed origins for CORS
    ALLOWED_ORIGINS: [
      "http://localhost:3008",
      "https://mexcsniper.com",
      "https://*.vercel.app",
    ],

    // API timeout settings
    TIMEOUTS: {
      DEFAULT: 30000, // 30 seconds
      MEXC_API: 15000, // 15 seconds
      DATABASE: 10000, // 10 seconds
      AUTHENTICATION: 5000, // 5 seconds
    },

    // Request size limits
    REQUEST_LIMITS: {
      JSON_PAYLOAD: "10mb",
      URL_ENCODED: "10mb",
      MULTIPART: "50mb",
    },
  },

  // Encryption Configuration
  ENCRYPTION: {
    // Algorithm settings
    ALGORITHM: "aes-256-gcm",
    KEY_LENGTH: 32, // 256 bits
    IV_LENGTH: 12, // 96 bits for GCM
    TAG_LENGTH: 16, // 128 bits

    // Key rotation settings
    KEY_ROTATION: {
      ENABLED: true,
      INTERVAL_DAYS: 90,
      OVERLAP_DAYS: 7,
    },
  },

  // Session Security
  SESSION_SECURITY: {
    // Cookie settings
    COOKIE: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax", // Relaxed for development
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      domain: undefined, // Will be set based on environment
    },

    // Session settings
    SESSION: {
      regenerateOnLogin: true,
      invalidateOnLogout: true,
      timeoutMinutes: 120, // 2 hours of inactivity
    },
  },

  // Monitoring and Alerting
  SECURITY_MONITORING: {
    // Failed login attempt thresholds
    FAILED_LOGIN_THRESHOLD: 5,
    FAILED_LOGIN_WINDOW: 15 * 60 * 1000, // 15 minutes

    // Suspicious activity patterns
    SUSPICIOUS_PATTERNS: {
      RAPID_REQUESTS: {
        threshold: 100,
        windowMs: 60 * 1000, // 1 minute
      },
      UNUSUAL_ENDPOINTS: {
        enabled: true,
        alertOnNewEndpoints: true,
      },
      GEOGRAPHIC_ANOMALIES: {
        enabled: false, // Disabled for now
        alertOnNewCountries: false,
      },
    },

    // Alert channels
    ALERT_CHANNELS: {
      LOG: true,
      EMAIL: false, // Configure as needed
      WEBHOOK: false, // Configure as needed
    },
  },
} as const;

/**
 * Get security headers for Next.js middleware
 */
export function getSecurityHeaders(): Record<string, string> {
  const isDevelopment = process.env.NODE_ENV === "development";

  if (isDevelopment) {
    // Relaxed headers for development
    return {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "X-XSS-Protection": "1; mode=block",
    };
  }

  return SECURITY_CONFIG.SECURITY_HEADERS;
}

/**
 * Get cookie configuration based on environment
 */
export function getCookieConfig() {
  const isDevelopment = process.env.NODE_ENV === "development";

  if (isDevelopment) {
    // Development-friendly cookie settings
    return {
      httpOnly: true,
      secure: false, // Allow HTTP in development
      sameSite: "lax" as const, // Less restrictive for development
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      domain: undefined,
    };
  }

  return SECURITY_CONFIG.SESSION_SECURITY.COOKIE;
}

/**
 * Get rate limiting configuration based on endpoint type
 */
export function getRateLimitConfig(type: "general" | "auth" | "trading") {
  switch (type) {
    case "auth":
      return SECURITY_CONFIG.RATE_LIMITING.API_AUTH;
    case "trading":
      return SECURITY_CONFIG.RATE_LIMITING.API_TRADING;
    default:
      return SECURITY_CONFIG.RATE_LIMITING.API_GENERAL;
  }
}

/**
 * Validate input against security rules
 */
export function validateInput(
  value: string,
  type: keyof typeof SECURITY_CONFIG.INPUT_VALIDATION.PATTERNS
): boolean {
  const pattern = SECURITY_CONFIG.INPUT_VALIDATION.PATTERNS[type];
  const maxLength = SECURITY_CONFIG.INPUT_VALIDATION.MAX_LENGTHS[type];

  if (!value || value.length > maxLength) {
    return false;
  }

  return pattern.test(value);
}

/**
 * Sanitize input string for security
 */
export function sanitizeInput(input: string): string {
  if (!input) return "";

  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, "");

  // Remove script content
  sanitized = sanitized.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    ""
  );

  // Escape potential SQL injection characters
  sanitized = sanitized.replace(/['";\\]/g, "\\$&");

  return sanitized.trim();
}

/**
 * Check if request is from allowed origin
 */
export function isAllowedOrigin(origin: string): boolean {
  const allowedOrigins = SECURITY_CONFIG.API_SECURITY.ALLOWED_ORIGINS;

  return allowedOrigins.some((allowed) => {
    if (allowed.includes("*")) {
      const regex = new RegExp(allowed.replace(/\*/g, ".*"));
      return regex.test(origin);
    }
    return allowed === origin;
  });
}

/**
 * Security utilities for common operations
 */
export const SecurityUtils = {
  headers: getSecurityHeaders,
  cookies: getCookieConfig,
  rateLimit: getRateLimitConfig,
  validate: validateInput,
  sanitize: sanitizeInput,
  allowedOrigin: isAllowedOrigin,

  // Generate secure random values
  generateSecureRandom: (length = 32): string => {
    return randomBytes(length).toString("hex");
  },

  // Hash sensitive data
  hashSensitiveData: (data: string): string => {
    return UniversalCrypto.createHash("sha256").update(data).digest("hex");
  },

  // Time-safe string comparison
  timeSafeCompare: (a: string, b: string): boolean => {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  },
} as const;

export default SECURITY_CONFIG;
