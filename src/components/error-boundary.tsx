"use client";

import { AlertCircle, ChevronDown, ChevronUp, Home, RefreshCcw } from "lucide-react";
import { Component, type ComponentType, type ErrorInfo, type ReactNode } from "react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnKeysChange?: boolean;
  isolate?: boolean;
  level?: "page" | "section" | "component";
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
  showDetails: boolean;
  previousResetKeys?: Array<string | number>;
}

/**
 * React Error Boundary Component
 *
 * Provides graceful error handling for React component trees with
 * customizable fallback UI and error recovery options.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[error-boundary]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[error-boundary]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[error-boundary]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[error-boundary]", message, context || ""),
  };

  private resetTimeoutId: NodeJS.Timeout | null = null;
  private previousResetKeys: Array<string | number> = [];

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      showDetails: false,
    };
    this.previousResetKeys = props.resetKeys || [];
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState
  ): Partial<ErrorBoundaryState> | null {
    if (props.resetKeys && props.resetOnKeysChange !== false && state.hasError) {
      // Check if reset keys have changed
      const hasKeysChanged = props.resetKeys.some(
        (key, index) => key !== state.previousResetKeys?.[index]
      );

      if (hasKeysChanged) {
        return {
          hasError: false,
          error: null,
          errorInfo: null,
        };
      }
    }
    return null;
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.props.resetKeys !== prevProps.resetKeys) {
      this.previousResetKeys = this.props.resetKeys || [];
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("Error Boundary caught an error:", error, errorInfo);
    }

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Update state
    this.setState((prevState) => ({
      hasError: true,
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Log error to monitoring service (in production)
    if (process.env.NODE_ENV === "production") {
      this.logErrorToService(error, errorInfo);
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  logErrorToService = async (error: Error, errorInfo: ErrorInfo) => {
    try {
      // Only log to service on server-side to avoid bundling database code for client
      if (typeof window !== "undefined") {
        // Client-side: Send error to API endpoint instead
        fetch("/api/errors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent,
          }),
        }).catch(console.error);
        return;
      }

      // Server-side: Log to console only (no browser globals available)
      console.error("Server-side error:", error.message, error.stack);

      this.logger.info("Error logged to monitoring services", { errorId: error.name });
    } catch (loggingError) {
      // Fallback logging if error service fails
      console.error("Failed to log error to monitoring service:", loggingError);
      console.error("Original error:", error.message, errorInfo.componentStack);
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  };

  handleRetry = () => {
    // Add a small delay to prevent infinite loops
    this.resetTimeoutId = setTimeout(() => {
      this.handleReset();
    }, 100);
  };

  handleGoHome = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  toggleDetails = () => {
    this.setState((prevState) => ({
      showDetails: !prevState.showDetails,
    }));
  };

  renderErrorDetails = () => {
    const { error, errorInfo, showDetails } = this.state;

    if (!showDetails || !error || !errorInfo) {
      return null;
    }

    return (
      <div className="mt-4 space-y-4">
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4">
          <h4 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">
            Error Message:
          </h4>
          <pre className="text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap break-all">
            {error.message}
          </pre>
        </div>

        {error.stack && (
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Stack Trace:
            </h4>
            <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-all overflow-x-auto">
              {error.stack}
            </pre>
          </div>
        )}

        {errorInfo.componentStack && (
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Component Stack:
            </h4>
            <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-all overflow-x-auto">
              {errorInfo.componentStack}
            </pre>
          </div>
        )}
      </div>
    );
  };

  // Helper methods to reduce complexity
  getErrorTitle = (isPageLevel: boolean, isSectionLevel: boolean) => {
    if (isPageLevel) return "Page Error";
    if (isSectionLevel) return "Section Error";
    return "Component Error";
  };

  getErrorDescription = (isPageLevel: boolean, isSectionLevel: boolean) => {
    if (isPageLevel) return "Something went wrong while loading this page";
    if (isSectionLevel) return "This section encountered an error";
    return "This component encountered an error";
  };

  renderErrorHeader = (isPageLevel: boolean, isSectionLevel: boolean) => (
    <CardHeader>
      <div className="flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-red-500" />
        <CardTitle className="text-lg">{this.getErrorTitle(isPageLevel, isSectionLevel)}</CardTitle>
      </div>
      <CardDescription>{this.getErrorDescription(isPageLevel, isSectionLevel)}</CardDescription>
    </CardHeader>
  );

  renderErrorMessage = () => {
    const { error } = this.state;
    if (process.env.NODE_ENV !== "development" || !error) return null;

    return (
      <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
        <span className="font-medium">Error: </span>
        {error.message}
      </div>
    );
  };

  renderErrorCountWarning = () => {
    const { errorCount } = this.state;
    if (errorCount <= 2) return null;

    return (
      <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md">
        This component has crashed {errorCount} times. Consider refreshing the page.
      </div>
    );
  };

  renderActionButtons = (isPageLevel: boolean) => (
    <div className="flex flex-col sm:flex-row gap-2">
      <Button
        onClick={this.handleRetry}
        variant="default"
        size="sm"
        className="flex items-center gap-2"
      >
        <RefreshCcw className="h-4 w-4" />
        Try Again
      </Button>

      {isPageLevel && (
        <Button
          onClick={this.handleGoHome}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <Home className="h-4 w-4" />
          Go Home
        </Button>
      )}

      {process.env.NODE_ENV === "development" && (
        <Button
          onClick={this.toggleDetails}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          {this.state.showDetails ? (
            <>
              <ChevronUp className="h-4 w-4" />
              Hide Details
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              Show Details
            </>
          )}
        </Button>
      )}
    </div>
  );

  renderDefaultFallback = () => {
    const { level = "component" } = this.props;
    const isPageLevel = level === "page";
    const isSectionLevel = level === "section";

    return (
      <div
        className={cn(
          "flex items-center justify-center",
          isPageLevel && "min-h-screen",
          isSectionLevel && "min-h-[400px] py-8",
          !isPageLevel && !isSectionLevel && "py-4"
        )}
      >
        <Card
          className={cn(
            "border-red-200 dark:border-red-800",
            isPageLevel && "max-w-lg w-full mx-4",
            isSectionLevel && "max-w-md w-full",
            !isPageLevel && !isSectionLevel && "w-full"
          )}
        >
          {this.renderErrorHeader(isPageLevel, isSectionLevel)}
          <CardContent className="space-y-4">
            {this.renderErrorMessage()}
            {this.renderErrorCountWarning()}
            {this.renderActionButtons(isPageLevel)}
            {process.env.NODE_ENV === "development" && this.renderErrorDetails()}
          </CardContent>
        </Card>
      </div>
    );
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      // Use default fallback
      return this.renderDefaultFallback();
    }

    return this.props.children;
  }
}

/**
 * Higher-order component to wrap components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, "children">
): ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

/**
 * Hook to manually trigger error boundary
 */
export function useErrorHandler() {
  return (error: Error) => {
    throw error;
  };
}

/**
 * Async error boundary for handling async component errors
 */
export function AsyncErrorBoundary({ children, fallback, ...props }: ErrorBoundaryProps) {
  return (
    <ErrorBoundary
      {...props}
      fallback={
        fallback || (
          <div className="flex items-center justify-center p-4">
            <Card className="border-amber-200 dark:border-amber-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  Loading Error
                </CardTitle>
                <CardDescription>
                  Failed to load this section. Please try refreshing.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.location.reload();
                    }
                  }}
                  size="sm"
                >
                  Refresh Page
                </Button>
              </CardContent>
            </Card>
          </div>
        )
      }
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * SSR-Safe Error Boundary for handling hydration mismatches
 */
export function SSRSafeErrorBoundary({ children, fallback, ...props }: ErrorBoundaryProps) {
  return (
    <ErrorBoundary
      {...props}
      onError={(error, errorInfo) => {
        // Enhanced logging for hydration errors
        if (
          error.message.includes("hydration") ||
          error.message.includes("client") ||
          error.message.includes("server")
        ) {
          console.warn("[SSR-Safe Error Boundary] Potential hydration mismatch:", {
            error: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
          });
        }

        // Call parent error handler if provided
        props.onError?.(error, errorInfo);
      }}
      fallback={
        fallback || (
          <div className="flex items-center justify-center p-4">
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-500" />
                  Hydration Error
                </CardTitle>
                <CardDescription>
                  There was a mismatch between server and client rendering.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.location.reload();
                    }
                  }}
                  size="sm"
                >
                  Reload Page
                </Button>
              </CardContent>
            </Card>
          </div>
        )
      }
    >
      {children}
    </ErrorBoundary>
  );
}
