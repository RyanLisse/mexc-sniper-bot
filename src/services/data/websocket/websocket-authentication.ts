/**
 * WebSocket Authentication Service
 *
 * Handles WebSocket connection authentication and authorization.
 * Extracted from websocket-server.ts for modularity and reusability.
 *
 * Features:
 * - Token validation
 * - User authentication
 * - Connection authorization
 * - Authentication timeout handling
 */

import type { IncomingMessage } from "node:http";

export interface AuthenticationResult {
  valid: boolean;
  userId?: string;
  error?: string;
}

export interface AuthenticationConfig {
  required: boolean;
  tokenValidation: (
    token: string
  ) => Promise<{ valid: boolean; userId?: string }>;
}

export class WebSocketAuthenticationService {
  private logger = {
    info: (message: string, context?: unknown) =>
      console.info("[websocket-authentication]", message, context || ""),
    warn: (message: string, context?: unknown) =>
      console.warn("[websocket-authentication]", message, context || ""),
    error: (message: string, context?: unknown, error?: Error) =>
      console.error(
        "[websocket-authentication]",
        message,
        context || "",
        error || ""
      ),
    debug: (message: string, context?: unknown) =>
      console.debug("[websocket-authentication]", message, context || ""),
  };

  constructor(private config: AuthenticationConfig) {}

  /**
   * Authenticate a WebSocket connection
   */
  async authenticateConnection(
    request: IncomingMessage,
    connectionId: string
  ): Promise<AuthenticationResult> {
    try {
      if (!this.config.required) {
        this.logger.debug(`Authentication not required for: ${connectionId}`);
        return { valid: true };
      }

      const token = this.extractToken(request);
      if (!token) {
        this.logger.warn(`No token provided for connection: ${connectionId}`);
        return { valid: false, error: "Authentication token required" };
      }

      this.logger.debug(`Validating token for connection: ${connectionId}`);

      // Create timeout promise for authentication
      const authTimeout = new Promise<{ valid: false; error: string }>(
        (resolve) =>
          setTimeout(
            () => resolve({ valid: false, error: "Authentication timeout" }),
            5000 // 5 second timeout
          )
      );

      const authPromise = this.config.tokenValidation(token);
      const authResult = await Promise.race([authPromise, authTimeout]);

      if (!authResult.valid) {
        const errorMsg =
          "error" in authResult ? authResult.error : "Authentication failed";
        this.logger.warn(
          `Authentication failed for ${connectionId}: ${errorMsg}`
        );
        return { valid: false, error: errorMsg };
      }

      this.logger.info(
        `Authentication successful for connection: ${connectionId}`,
        {
          userId: authResult.userId,
        }
      );

      return {
        valid: true,
        userId: authResult.userId,
      };
    } catch (error) {
      this.logger.error(
        `Authentication error for connection: ${connectionId}`,
        {},
        error as Error
      );
      return {
        valid: false,
        error: "Authentication service error",
      };
    }
  }

  /**
   * Extract authentication token from request
   */
  private extractToken(request: IncomingMessage): string | undefined {
    try {
      // Try to get token from URL parameters first
      const url = new URL(request.url || "", `http://${request.headers.host}`);
      const urlToken = url.searchParams.get("token");
      if (urlToken) {
        return urlToken;
      }

      // Try to get token from Authorization header
      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        return authHeader.replace("Bearer ", "");
      }

      // Try to get token from custom header
      const customToken = request.headers["x-auth-token"];
      if (customToken && typeof customToken === "string") {
        return customToken;
      }

      return undefined;
    } catch (error) {
      this.logger.error(
        "Error extracting token from request",
        {},
        error as Error
      );
      return undefined;
    }
  }

  /**
   * Default token validation implementation
   */
  static async defaultTokenValidation(
    token: string
  ): Promise<{ valid: boolean; userId?: string }> {
    try {
      // This would integrate with your actual auth system (Kinde, Auth0, etc.)
      // For now, returning a basic validation
      if (!token || token.length < 10) {
        return { valid: false };
      }

      // In a real implementation, this would:
      // 1. Validate the JWT token
      // 2. Check token expiration
      // 3. Verify token signature
      // 4. Extract user information
      // 5. Check user permissions

      // Placeholder implementation
      if (token === "demo-token") {
        return { valid: true, userId: "demo-user" };
      }

      // For development, accept any token that looks like a valid format
      if (token.includes(".") && token.length > 20) {
        return { valid: true, userId: `user-${token.slice(0, 8)}` };
      }

      return { valid: false };
    } catch (error) {
      console.error(
        "[websocket-authentication] Token validation error:",
        error
      );
      return { valid: false };
    }
  }

  /**
   * Update authentication configuration
   */
  updateConfig(newConfig: Partial<AuthenticationConfig>): void {
    const oldConfig = { ...this.config };

    if (newConfig.required !== undefined) {
      this.config.required = newConfig.required;
    }

    if (newConfig.tokenValidation !== undefined) {
      this.config.tokenValidation = newConfig.tokenValidation;
    }

    this.logger.info("Authentication configuration updated", {
      oldRequired: oldConfig.required,
      newRequired: this.config.required,
      tokenValidationChanged: newConfig.tokenValidation !== undefined,
    });
  }

  /**
   * Check if authentication is required
   */
  isAuthenticationRequired(): boolean {
    return this.config.required;
  }

  /**
   * Get authentication configuration
   */
  getConfig(): Readonly<AuthenticationConfig> {
    return {
      required: this.config.required,
      tokenValidation: this.config.tokenValidation,
    };
  }
}
