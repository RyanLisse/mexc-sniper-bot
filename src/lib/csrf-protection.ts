/**
 * CSRF Protection utilities
 */

import { randomBytes, timingSafeEqual } from "node:crypto";

// CSRF token configuration
const CSRF_TOKEN_LENGTH = 32;
const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour in milliseconds
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_COOKIE_NAME = "__csrf";

interface CSRFTokenData {
  token: string;
  timestamp: number;
}

// In-memory store for CSRF tokens (use Redis in production)
const csrfTokens = new Map<string, CSRFTokenData>();

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCSRFToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
}

/**
 * Create a CSRF token for a session
 */
export function createCSRFToken(sessionId: string): string {
  const token = generateCSRFToken();
  const tokenData: CSRFTokenData = {
    token,
    timestamp: Date.now(),
  };

  csrfTokens.set(sessionId, tokenData);

  // Clean up expired tokens periodically
  cleanupExpiredTokens();

  return token;
}

/**
 * Validate a CSRF token
 */
export function validateCSRFToken(sessionId: string, submittedToken: string): boolean {
  const tokenData = csrfTokens.get(sessionId);

  if (!tokenData) {
    return false;
  }

  // Check if token has expired
  if (Date.now() - tokenData.timestamp > CSRF_TOKEN_EXPIRY) {
    csrfTokens.delete(sessionId);
    return false;
  }

  // Use timing-safe comparison to prevent timing attacks
  try {
    const expectedBuffer = Buffer.from(tokenData.token, "hex");
    const submittedBuffer = Buffer.from(submittedToken, "hex");

    if (expectedBuffer.length !== submittedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, submittedBuffer);
  } catch (_error) {
    return false;
  }
}

/**
 * Extract CSRF token from request headers or body
 */
export function extractCSRFToken(request: Request): string | null {
  // Try header first
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  if (headerToken) {
    return headerToken;
  }

  // For form submissions, you might want to extract from body
  // This would require parsing the body, which is more complex
  return null;
}

/**
 * Extract session ID from request (you'll need to adapt this to your session implementation)
 */
export function extractSessionId(request: Request): string | null {
  // This is a simplified version - adapt to your actual session implementation
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // Try to get from cookies
  const cookies = request.headers.get("cookie");
  if (cookies) {
    const sessionMatch = cookies.match(/session=([^;]+)/);
    if (sessionMatch) {
      return sessionMatch[1];
    }
  }

  return null;
}

/**
 * Create CSRF protection middleware
 */
export function createCSRFProtection() {
  return {
    /**
     * Generate and set CSRF token for a session
     */
    generateToken(sessionId: string): string {
      return createCSRFToken(sessionId);
    },

    /**
     * Validate CSRF token from request
     */
    validateRequest(request: Request): { valid: boolean; sessionId?: string; error?: string } {
      const sessionId = extractSessionId(request);

      if (!sessionId) {
        return { valid: false, error: "No session found" };
      }

      const csrfToken = extractCSRFToken(request);

      if (!csrfToken) {
        return { valid: false, sessionId, error: "CSRF token missing" };
      }

      const isValid = validateCSRFToken(sessionId, csrfToken);

      if (!isValid) {
        return { valid: false, sessionId, error: "Invalid CSRF token" };
      }

      return { valid: true, sessionId };
    },

    /**
     * Create response with CSRF token cookie
     */
    setTokenCookie(response: Response, token: string): Response {
      const headers = new Headers(response.headers);
      headers.append(
        "Set-Cookie",
        `${CSRF_COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600`
      );

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    },
  };
}

/**
 * Clean up expired CSRF tokens
 */
function cleanupExpiredTokens(): void {
  const now = Date.now();

  for (const [sessionId, tokenData] of csrfTokens.entries()) {
    if (now - tokenData.timestamp > CSRF_TOKEN_EXPIRY) {
      csrfTokens.delete(sessionId);
    }
  }
}

/**
 * Create CSRF error response
 */
export function createCSRFErrorResponse(error: string): Response {
  return new Response(
    JSON.stringify({
      error: "CSRF Protection Violation",
      message: error,
      code: "CSRF_ERROR",
    }),
    {
      status: 403,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

// Auto-cleanup expired tokens every 10 minutes
if (typeof window === "undefined") {
  setInterval(cleanupExpiredTokens, 10 * 60 * 1000);
}
