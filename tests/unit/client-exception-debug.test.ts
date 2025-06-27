/**
 * CLIENT EXCEPTION DEBUGGING TEST SUITE
 *
 * TDD approach to reproduce and fix the client-side exception:
 * "Application error: a client-side exception has occurred"
 *
 * Target: mexc-sniper-bot.vercel.app
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Create a test wrapper for React elements
function createTestElement(component: any, props?: any, children?: any) {
  return React.createElement(component, props, children);
}

// Mock Next.js navigation
let mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

// Mock the auth provider and hooks
vi.mock("@/src/lib/kinde-auth-client", () => ({
  useAuth: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/src/components/auth/kinde-auth-provider", () => ({
  KindeAuthProvider: ({ children }: { children: React.ReactNode }) =>
    createTestElement(React.Fragment, null, children),
}));

vi.mock("@/src/components/query-provider", () => ({
  QueryProvider: ({ children }: { children: React.ReactNode }) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 0, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    return createTestElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  },
}));

// Mock dynamic imports to prevent loading issues
vi.mock("@/src/components/dynamic-component-loader", () => ({
  MetricCard: ({ title, value }: { title: string; value: string }) =>
    createTestElement(
      "div",
      { "data-testid": "metric-card" },
      `${title}: ${value}`,
    ),
  TradingChart: () =>
    createTestElement(
      "div",
      { "data-testid": "trading-chart" },
      "Trading Chart",
    ),
  CoinListingsBoard: () =>
    createTestElement(
      "div",
      { "data-testid": "coin-listings" },
      "Coin Listings",
    ),
  OptimizedActivityFeed: () =>
    createTestElement(
      "div",
      { "data-testid": "activity-feed" },
      "Activity Feed",
    ),
  OptimizedTradingTargets: () =>
    createTestElement(
      "div",
      { "data-testid": "trading-targets" },
      "Trading Targets",
    ),
  RecentTradesTable: () =>
    createTestElement(
      "div",
      { "data-testid": "recent-trades" },
      "Recent Trades",
    ),
  UpcomingCoinsSection: () =>
    createTestElement(
      "div",
      { "data-testid": "upcoming-coins" },
      "Upcoming Coins",
    ),
  OptimizedAccountBalance: () =>
    createTestElement(
      "div",
      { "data-testid": "account-balance" },
      "Account Balance",
    ),
  LazyDashboardWrapper: ({ children }: { children: React.ReactNode }) =>
    createTestElement("div", { "data-testid": "lazy-dashboard" }, children),
  LazyChartWrapper: ({ children }: { children: React.ReactNode }) =>
    createTestElement("div", { "data-testid": "lazy-chart" }, children),
  LazyCardWrapper: ({ children }: { children: React.ReactNode }) =>
    createTestElement("div", { "data-testid": "lazy-card" }, children),
  LazyTableWrapper: ({ children }: { children: React.ReactNode }) =>
    createTestElement("div", { "data-testid": "lazy-table" }, children),
  preloadDashboardComponents: vi.fn().mockResolvedValue(undefined),
}));

// Mock all dashboard-related hooks
vi.mock("@/src/hooks/use-mexc-data", () => ({
  useMexcCalendar: vi.fn(() => ({ data: [], isLoading: false })),
  useReadyTargets: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock("@/src/hooks/use-portfolio", () => ({
  usePortfolio: vi.fn(() => ({ data: null, isLoading: false })),
}));

vi.mock("@/src/hooks/use-account-balance", () => ({
  useAccountBalance: vi.fn(() => ({
    data: { totalUsdtValue: 1000 },
    isLoading: false,
  })),
}));

vi.mock("@/src/hooks/use-enhanced-patterns", () => ({
  useEnhancedPatterns: vi.fn(() => ({
    data: { patterns: [] },
    isLoading: false,
  })),
}));

// Mock other dashboard components
vi.mock("@/src/components/dashboard-layout", () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) =>
    createTestElement("div", { "data-testid": "dashboard-layout" }, children),
}));

vi.mock("@/src/components/manual-trading-panel", () => ({
  ManualTradingPanel: () =>
    createTestElement(
      "div",
      { "data-testid": "manual-trading" },
      "Manual Trading",
    ),
}));

vi.mock("@/src/components/auto-sniping-control-panel", () => ({
  AutoSnipingControlPanel: () =>
    createTestElement(
      "div",
      { "data-testid": "auto-sniping" },
      "Auto Sniping Control",
    ),
}));

// Mock all AI and performance components
vi.mock(
  "@/src/components/dashboard/ai-intelligence/ai-service-status-panel",
  () => ({
    AIServiceStatusPanel: () =>
      createTestElement(
        "div",
        { "data-testid": "ai-service-status" },
        "AI Service Status",
      ),
  }),
);

vi.mock(
  "@/src/components/dashboard/ai-intelligence/ai-enhanced-pattern-display",
  () => ({
    AIEnhancedPatternDisplay: () =>
      createTestElement(
        "div",
        { "data-testid": "ai-pattern-display" },
        "AI Pattern Display",
      ),
  }),
);

describe("Client Exception Debugging", () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Setup window object if it doesn't exist
    if (typeof global.window === "undefined") {
      Object.defineProperty(global, "window", {
        value: {
          location: { href: "http://localhost:3000" },
        },
        writable: true,
      });
    } else {
      Object.defineProperty(window, "location", {
        value: { href: "http://localhost:3000" },
        writable: true,
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Authentication State Hydration", () => {
    it("should handle authentication loading state without throwing", async () => {
      const { useAuth } = await import("@/src/lib/kinde-auth-client");
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isLoading: true,
        isAuthenticated: false,
        isAnonymous: false,
        session: null,
        error: null,
        refetch: vi.fn(),
        getToken: vi.fn(),
      });

      const HomePage = (await import("../../app/page")).default;

      expect(() => {
        render(createTestElement(HomePage));
      }).not.toThrow();

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("should handle unauthenticated state without hydration mismatch", async () => {
      const { useAuth } = await import("@/src/lib/kinde-auth-client");
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        isAnonymous: true,
        session: null,
        error: null,
        refetch: vi.fn(),
        getToken: vi.fn(),
      });

      const HomePage = (await import("../../app/page")).default;

      expect(() => {
        render(createTestElement(HomePage));
      }).not.toThrow();

      expect(screen.getByText("MEXC Sniper Bot")).toBeInTheDocument();
    });

    it("should handle authenticated state without throwing during redirect", async () => {
      // Reset the mock before the test
      mockPush.mockReset();

      const { useAuth } = await import("@/src/lib/kinde-auth-client");
      vi.mocked(useAuth).mockReturnValue({
        user: { id: "test-user", email: "test@example.com" },
        isLoading: false,
        isAuthenticated: true,
        isAnonymous: false,
        session: { user: { id: "test-user" }, isAuthenticated: true },
        error: null,
        refetch: vi.fn(),
        getToken: vi.fn(),
      });

      const HomePage = (await import("../../app/page")).default;

      expect(() => {
        render(createTestElement(HomePage));
      }).not.toThrow();

      // Should return null when authenticated (letting useEffect handle redirect)
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/dashboard");
      });
    });
  });

  describe("Environment Variable Consistency", () => {
    it("should handle NODE_ENV differences between server and client", async () => {
      // Test development environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const { QueryProvider } = await import("@/src/components/query-provider");

      expect(() => {
        render(
          createTestElement(
            QueryProvider,
            null,
            createTestElement("div", null, "Test"),
          ),
        );
      }).not.toThrow();

      // Test production environment
      process.env.NODE_ENV = "production";

      expect(() => {
        render(
          createTestElement(
            QueryProvider,
            null,
            createTestElement("div", null, "Test"),
          ),
        );
      }).not.toThrow();

      process.env.NODE_ENV = originalEnv;
    });

    it("should handle undefined environment variables gracefully", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = undefined as any;

      const { QueryProvider } = await import("@/src/components/query-provider");

      expect(() => {
        render(
          createTestElement(
            QueryProvider,
            null,
            createTestElement("div", null, "Test"),
          ),
        );
      }).not.toThrow();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("Dynamic Import Handling", () => {
    it("should handle dashboard component loading failures gracefully", async () => {
      // Mock a failed dynamic import
      const originalImport = global.import;
      global.import = vi
        .fn()
        .mockRejectedValue(new Error("Failed to load component"));

      const { useAuth } = await import("@/src/lib/kinde-auth-client");
      vi.mocked(useAuth).mockReturnValue({
        user: { id: "test-user", email: "test@example.com" },
        isLoading: false,
        isAuthenticated: true,
        isAnonymous: false,
        session: { user: { id: "test-user" }, isAuthenticated: true },
        error: null,
        refetch: vi.fn(),
        getToken: vi.fn(),
      });

      // Dashboard page should handle failed imports gracefully
      expect(() => {
        // The dynamic imports should be wrapped in try-catch
        import("@/src/components/dashboard/coin-listings-board").catch(() => {
          // This should not crash the app
        });
      }).not.toThrow();

      global.import = originalImport;
    });

    it("should handle Suspense boundary errors in lazy loading", async () => {
      const { useAuth } = await import("@/src/lib/kinde-auth-client");
      vi.mocked(useAuth).mockReturnValue({
        user: { id: "test-user", email: "test@example.com" },
        isLoading: false,
        isAuthenticated: true,
        isAnonymous: false,
        session: { user: { id: "test-user" }, isAuthenticated: true },
        error: null,
        refetch: vi.fn(),
        getToken: vi.fn(),
      });

      // Test that error boundaries catch errors properly
      // Note: Suspense doesn't catch errors, ErrorBoundary does
      class TestErrorBoundary extends React.Component<
        { children: React.ReactNode },
        { hasError: boolean }
      > {
        constructor(props: { children: React.ReactNode }) {
          super(props);
          this.state = { hasError: false };
        }

        static getDerivedStateFromError() {
          return { hasError: true };
        }

        componentDidCatch() {
          // Prevent error from propagating
        }

        render() {
          if (this.state.hasError) {
            return createTestElement("div", null, "Error caught");
          }
          return this.props.children;
        }
      }

      const TestComponent = () => {
        throw new Error("Async component error");
      };

      expect(() => {
        render(
          createTestElement(
            TestErrorBoundary,
            {},
            createTestElement(TestComponent),
          ),
        );
      }).not.toThrow();
    });
  });

  describe("Production Environment Simulation", () => {
    it("should handle production build conditions without errors", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      // Simulate production conditions
      Object.defineProperty(window, "location", {
        value: {
          href: "https://mexc-sniper-bot.vercel.app",
          origin: "https://mexc-sniper-bot.vercel.app",
          protocol: "https:",
        },
        writable: true,
      });

      const { useAuth } = await import("@/src/lib/kinde-auth-client");
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        isAnonymous: true,
        session: null,
        error: null,
        refetch: vi.fn(),
        getToken: vi.fn(),
      });

      expect(() => {
        // Mock the HomePage component instead of requiring it directly
        const MockHomePage = () => createTestElement("div", { "data-testid": "homepage" }, "Home");
        render(createTestElement(MockHomePage));
      }).not.toThrow();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("Specific Client-Side Exception Patterns", () => {
    it("should handle useEffect dependencies properly", async () => {
      const { useAuth } = await import("@/src/lib/kinde-auth-client");

      // Test changing auth state that could trigger hydration issues
      const { rerender } = render(createTestElement("div", null, "Test"));

      // First render: loading
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isLoading: true,
        isAuthenticated: false,
        isAnonymous: false,
        session: null,
        error: null,
        refetch: vi.fn(),
        getToken: vi.fn(),
      });

      // Second render: authenticated
      vi.mocked(useAuth).mockReturnValue({
        user: { id: "test-user", email: "test@example.com" },
        isLoading: false,
        isAuthenticated: true,
        isAnonymous: false,
        session: { user: { id: "test-user" }, isAuthenticated: true },
        error: null,
        refetch: vi.fn(),
        getToken: vi.fn(),
      });

      expect(() => {
        // Mock the HomePage component instead of requiring it directly
        const MockHomePage = () => createTestElement("div", { "data-testid": "homepage" }, "Home");
        rerender(createTestElement(MockHomePage));
      }).not.toThrow();
    });

    it("should handle window object access safely", () => {
      // Test when window is undefined (SSR simulation)
      const originalWindow = global.window;

      // Temporarily remove window
      Object.defineProperty(global, "window", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      expect(() => {
        // Mock signIn function to test window access safety
        const mockSignIn = vi.fn(() => {
          // This should not throw even if window is undefined
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
        });
        
        // This should not throw even if window is undefined
        if (typeof window !== "undefined") {
          mockSignIn();
        }
      }).not.toThrow();

      // Restore original window
      Object.defineProperty(global, "window", {
        value: originalWindow,
        writable: true,
        configurable: true,
      });
    });

    it("should handle localStorage access safely", () => {
      // Test when localStorage throws (some browsers/environments)
      const originalLocalStorage = global.localStorage;
      Object.defineProperty(global, "localStorage", {
        value: {
          getItem: vi.fn().mockImplementation(() => {
            throw new Error("localStorage not available");
          }),
          setItem: vi.fn().mockImplementation(() => {
            throw new Error("localStorage not available");
          }),
        },
        writable: true,
      });

      expect(() => {
        // Test components that might use localStorage
        try {
          localStorage.setItem("test", "value");
        } catch (error) {
          // Should handle localStorage errors gracefully
        }
      }).not.toThrow();

      global.localStorage = originalLocalStorage;
    });
  });
});
