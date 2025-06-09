/**
 * Security headers utilities for production deployment
 */

export interface SecurityHeadersConfig {
  strictTransportSecurity?: boolean;
  contentSecurityPolicy?: boolean;
  frameOptions?: boolean;
  contentTypeOptions?: boolean;
  referrerPolicy?: boolean;
  permissionsPolicy?: boolean;
  crossOriginPolicy?: boolean;
}

/**
 * Get comprehensive security headers for responses
 */
export function getSecurityHeaders(config: SecurityHeadersConfig = {}): Record<string, string> {
  const headers: Record<string, string> = {};

  // Strict Transport Security (HSTS)
  if (config.strictTransportSecurity !== false) {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload";
  }

  // Content Security Policy (CSP)
  if (config.contentSecurityPolicy !== false) {
    const cspParts = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://api.mexc.com https://www.mexc.com wss://wbs.mexc.com",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ];
    headers["Content-Security-Policy"] = cspParts.join("; ");
  }

  // X-Frame-Options
  if (config.frameOptions !== false) {
    headers["X-Frame-Options"] = "DENY";
  }

  // X-Content-Type-Options
  if (config.contentTypeOptions !== false) {
    headers["X-Content-Type-Options"] = "nosniff";
  }

  // Referrer Policy
  if (config.referrerPolicy !== false) {
    headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
  }

  // Permissions Policy (formerly Feature Policy)
  if (config.permissionsPolicy !== false) {
    const permissions = [
      "accelerometer=()",
      "camera=()",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "payment=()",
      "usb=()",
      "fullscreen=(self)",
    ];
    headers["Permissions-Policy"] = permissions.join(", ");
  }

  // Cross-Origin Policies
  if (config.crossOriginPolicy !== false) {
    headers["Cross-Origin-Embedder-Policy"] = "require-corp";
    headers["Cross-Origin-Opener-Policy"] = "same-origin";
    headers["Cross-Origin-Resource-Policy"] = "same-origin";
  }

  // Additional security headers
  headers["X-DNS-Prefetch-Control"] = "off";
  headers["X-Download-Options"] = "noopen";
  headers["X-Permitted-Cross-Domain-Policies"] = "none";
  headers["X-XSS-Protection"] = "1; mode=block";

  return headers;
}

/**
 * Apply security headers to a Next.js response
 */
export function applySecurityHeaders(response: Response, config?: SecurityHeadersConfig): Response {
  const securityHeaders = getSecurityHeaders(config);
  const headers = new Headers(response.headers);

  Object.entries(securityHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Create a middleware function for applying security headers
 */
export function createSecurityMiddleware(config?: SecurityHeadersConfig) {
  return (_request: Request, response: Response): Response => {
    return applySecurityHeaders(response, config);
  };
}

/**
 * Get development-friendly security headers (less strict CSP)
 */
export function getDevelopmentSecurityHeaders(): Record<string, string> {
  return getSecurityHeaders({
    strictTransportSecurity: false, // Not needed for localhost
    contentSecurityPolicy: false, // Can interfere with development tools
    crossOriginPolicy: false, // Can break development features
  });
}

/**
 * Get production security headers (full protection)
 */
export function getProductionSecurityHeaders(): Record<string, string> {
  return getSecurityHeaders({
    strictTransportSecurity: true,
    contentSecurityPolicy: true,
    frameOptions: true,
    contentTypeOptions: true,
    referrerPolicy: true,
    permissionsPolicy: true,
    crossOriginPolicy: true,
  });
}
