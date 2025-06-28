"use client";

/**
 * Standardized Error Boundary Component
 *
 * Provides consistent error handling and recovery for React components.
 * Integrates with the standardized error handling system.
 */

import { AlertTriangle, HelpCircle, Home, RefreshCw } from "lucide-react";
import type React from "react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { errorHandler, type StandardizedErrorContext } from "../../lib/standardized-error-handler";
import { createLogger } from "../../lib/unified-logger";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

const logger = createLogger("error-boundary", {
  enableStructuredLogging: true,
  enablePerformanceLogging: false,
});

interface ErrorBoundaryState {
  hasError: boolean;
  errorId?: string;
  userMessage?: string;
  recoveryActions?: string[];
  retryable?: boolean;
  showDetails?: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  context?: Partial<StandardizedErrorContext>;
  level?: "page" | "component" | "feature";
  enableRetry?: boolean;
}

/**
 * Enhanced Error Boundary with standardized error handling
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Process error through standardized handler
    const context: Partial<StandardizedErrorContext> = {
      ...this.props.context,
      operation: "React.ErrorBoundary",
      resource: this.props.level || "component",
      additionalData: {
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
        retryCount: this.retryCount,
      },
    };

    const standardizedError = errorHandler.processError(error, context);
    const { metadata } = standardizedError;

    // Get recovery actions
    const recoveryActions = errorHandler.getRecoveryActions(error);

    // Update state with error details
    this.setState({
      hasError: true,
      errorId: metadata.errorCode,
      userMessage: metadata.userMessage,
      recoveryActions,
      retryable: metadata.retryable && this.props.enableRetry !== false,
      error,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log the error
    logger.error(
      "React component error caught by boundary",
      {
        errorCode: metadata.errorCode,
        level: this.props.level,
        retryCount: this.retryCount,
        componentStack: errorInfo.componentStack,
      },
      error
    );
  }

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      logger.info("Retrying component render", {
        retryCount: this.retryCount,
        maxRetries: this.maxRetries,
      });

      this.setState({ hasError: false });
    } else {
      logger.warn("Max retries exceeded for component", {
        retryCount: this.retryCount,
        maxRetries: this.maxRetries,
      });
    }
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  private handleReload = () => {
    window.location.reload();
  };

  private toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  private renderErrorUI() {
    const { errorId, userMessage, recoveryActions, retryable, showDetails, error } = this.state;

    const canRetry = retryable && this.retryCount < this.maxRetries;
    const isPageLevel = this.props.level === "page";

    return (
      <div className="flex items-center justify-center min-h-[400px] p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-lg">
              {isPageLevel ? "Page Error" : "Something went wrong"}
            </CardTitle>
            <CardDescription>{userMessage || "An unexpected error occurred"}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Recovery Actions */}
            {recoveryActions && recoveryActions.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">What you can do:</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {recoveryActions.map((action, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-blue-600">•</span>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2">
              {canRetry && (
                <Button onClick={this.handleRetry} className="w-full" variant="default">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again ({this.maxRetries - this.retryCount} attempts left)
                </Button>
              )}

              {isPageLevel ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={this.handleGoHome} variant="outline" size="sm">
                    <Home className="mr-2 h-4 w-4" />
                    Home
                  </Button>
                  <Button onClick={this.handleReload} variant="outline" size="sm">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reload
                  </Button>
                </div>
              ) : (
                <Button onClick={this.handleReload} variant="outline" className="w-full">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reload Page
                </Button>
              )}
            </div>

            {/* Error Details */}
            <div className="space-y-2">
              <Button onClick={this.toggleDetails} variant="ghost" size="sm" className="w-full">
                <HelpCircle className="mr-2 h-4 w-4" />
                {showDetails ? "Hide" : "Show"} Technical Details
              </Button>

              {showDetails && (
                <div className="rounded border bg-muted p-3 text-xs font-mono">
                  <div className="space-y-1">
                    <div>
                      <strong>Error ID:</strong> {errorId}
                    </div>
                    <div>
                      <strong>Type:</strong> {error?.constructor.name}
                    </div>
                    <div>
                      <strong>Message:</strong> {error?.message}
                    </div>
                    {error?.stack && (
                      <details className="mt-2">
                        <summary className="cursor-pointer font-semibold">Stack Trace</summary>
                        <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-[10px]">
                          {error.stack}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Render standardized error UI
      return this.renderErrorUI();
    }

    return this.props.children;
  }
}

/**
 * Higher-order component for wrapping components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, "children">
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

/**
 * Lightweight error boundary for non-critical components
 */
export function LightErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      level="component"
      enableRetry={true}
      fallback={
        <div className="rounded border border-red-200 bg-red-50 p-4 text-center">
          <AlertTriangle className="mx-auto mb-2 h-5 w-5 text-red-600" />
          <p className="text-sm text-red-800">Component failed to load. Please refresh the page.</p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Page-level error boundary for entire routes
 */
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      level="page"
      enableRetry={true}
      context={{
        resource: "page",
        operation: "page.render",
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Feature-level error boundary for complex features
 */
export function FeatureErrorBoundary({
  children,
  featureName,
}: {
  children: ReactNode;
  featureName: string;
}) {
  return (
    <ErrorBoundary
      level="feature"
      enableRetry={true}
      context={{
        resource: featureName,
        operation: `${featureName}.render`,
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
