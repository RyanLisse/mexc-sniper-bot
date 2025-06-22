/**
 * Tests for Simple Auto-Sniping Control Component
 *
 * Tests the user-friendly auto-sniping control interface that replaces
 * the complex technical dashboard.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StatusProvider } from "../../../contexts/status-context";
import { SimpleAutoSnipingControl } from "../simple-auto-sniping-control";

// Mock the hooks
jest.mock("../../../hooks/use-auto-sniping-execution", () => ({
  useAutoSnipingExecution: jest.fn(() => ({
    config: { enabled: true },
    isExecutionActive: false,
    executionStatus: "idle",
    activePositionsCount: 0,
    totalPnl: "0",
    successRate: 0,
    dailyTradeCount: 0,
    isLoading: false,
    isStartingExecution: false,
    isStoppingExecution: false,
    error: null,
    startExecution: jest.fn(),
    stopExecution: jest.fn(),
    updateConfig: jest.fn(),
    refreshData: jest.fn(),
    clearError: jest.fn(),
  })),
}));

jest.mock("../../../contexts/status-context", () => ({
  ...jest.requireActual("../../../contexts/status-context"),
  useStatus: jest.fn(() => ({
    status: {
      network: { connected: true, lastChecked: new Date().toISOString() },
      credentials: { hasCredentials: true, isValid: true, source: "environment" },
      trading: { canTrade: true, balanceLoaded: true },
    },
    getOverallStatus: jest.fn(() => "healthy"),
    refreshAll: jest.fn(),
  })),
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <StatusProvider>{children}</StatusProvider>
    </QueryClientProvider>
  );
};

describe("SimpleAutoSnipingControl", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the auto-sniping control interface", () => {
    render(
      <TestWrapper>
        <SimpleAutoSnipingControl />
      </TestWrapper>
    );

    expect(screen.getByText("Auto-Sniping")).toBeInTheDocument();
    expect(
      screen.getByText("Automatically trade new MEXC listings when patterns are detected")
    ).toBeInTheDocument();
  });

  it("shows ready status when system is healthy", () => {
    render(
      <TestWrapper>
        <SimpleAutoSnipingControl />
      </TestWrapper>
    );

    expect(screen.getByText("Ready to Trade")).toBeInTheDocument();
    expect(screen.getByText("All systems operational")).toBeInTheDocument();
  });

  it("displays current trading metrics", () => {
    const { useAutoSnipingExecution } = require("../../../hooks/use-auto-sniping-execution");
    useAutoSnipingExecution.mockReturnValue({
      config: { enabled: true },
      isExecutionActive: true,
      executionStatus: "active",
      activePositionsCount: 3,
      totalPnl: "25.50",
      successRate: 85,
      dailyTradeCount: 5,
      isLoading: false,
      isStartingExecution: false,
      isStoppingExecution: false,
      error: null,
      startExecution: jest.fn(),
      stopExecution: jest.fn(),
      updateConfig: jest.fn(),
      refreshData: jest.fn(),
      clearError: jest.fn(),
    });

    render(
      <TestWrapper>
        <SimpleAutoSnipingControl />
      </TestWrapper>
    );

    expect(screen.getByText("+25.50 USDT")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
    expect(screen.getByText("Today: 5 trades")).toBeInTheDocument();
  });

  it("shows setup required when credentials are missing", () => {
    const { useStatus } = require("../../../contexts/status-context");
    useStatus.mockReturnValue({
      status: {
        network: { connected: true, lastChecked: new Date().toISOString() },
        credentials: { hasCredentials: false, isValid: false, source: "none" },
        trading: { canTrade: false, balanceLoaded: false },
      },
      getOverallStatus: jest.fn(() => "warning"),
      refreshAll: jest.fn(),
    });

    render(
      <TestWrapper>
        <SimpleAutoSnipingControl />
      </TestWrapper>
    );

    expect(screen.getByText("API Setup Required")).toBeInTheDocument();
    expect(screen.getByText("Configure your MEXC API credentials")).toBeInTheDocument();
  });

  it("shows network error when disconnected", () => {
    const { useStatus } = require("../../../contexts/status-context");
    useStatus.mockReturnValue({
      status: {
        network: { connected: false, lastChecked: new Date().toISOString() },
        credentials: { hasCredentials: true, isValid: true, source: "environment" },
        trading: { canTrade: false, balanceLoaded: false },
      },
      getOverallStatus: jest.fn(() => "error"),
      refreshAll: jest.fn(),
    });

    render(
      <TestWrapper>
        <SimpleAutoSnipingControl />
      </TestWrapper>
    );

    expect(screen.getByText("Network Disconnected")).toBeInTheDocument();
    expect(screen.getByText("Check your internet connection")).toBeInTheDocument();
  });

  it("allows toggling auto-sniping on and off", async () => {
    const mockUpdateConfig = jest.fn();
    const mockStartExecution = jest.fn();
    const mockStopExecution = jest.fn();

    const { useAutoSnipingExecution } = require("../../../hooks/use-auto-sniping-execution");
    useAutoSnipingExecution.mockReturnValue({
      config: { enabled: true },
      isExecutionActive: false,
      executionStatus: "idle",
      activePositionsCount: 0,
      totalPnl: "0",
      successRate: 0,
      dailyTradeCount: 0,
      isLoading: false,
      isStartingExecution: false,
      isStoppingExecution: false,
      error: null,
      startExecution: mockStartExecution,
      stopExecution: mockStopExecution,
      updateConfig: mockUpdateConfig,
      refreshData: jest.fn(),
      clearError: jest.fn(),
    });

    render(
      <TestWrapper>
        <SimpleAutoSnipingControl />
      </TestWrapper>
    );

    const toggle = screen.getByRole("switch");
    expect(toggle).toBeChecked();

    // Toggle off
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(mockUpdateConfig).toHaveBeenCalledWith({ enabled: false });
    });
  });

  it("displays error messages clearly", () => {
    const { useAutoSnipingExecution } = require("../../../hooks/use-auto-sniping-execution");
    useAutoSnipingExecution.mockReturnValue({
      config: { enabled: true },
      isExecutionActive: false,
      executionStatus: "error",
      activePositionsCount: 0,
      totalPnl: "0",
      successRate: 0,
      dailyTradeCount: 0,
      isLoading: false,
      isStartingExecution: false,
      isStoppingExecution: false,
      error: "Failed to connect to MEXC API",
      startExecution: jest.fn(),
      stopExecution: jest.fn(),
      updateConfig: jest.fn(),
      refreshData: jest.fn(),
      clearError: jest.fn(),
    });

    render(
      <TestWrapper>
        <SimpleAutoSnipingControl />
      </TestWrapper>
    );

    expect(screen.getByText("Failed to connect to MEXC API")).toBeInTheDocument();
    expect(screen.getByText("Dismiss")).toBeInTheDocument();
  });

  it("shows running status when execution is active", () => {
    const { useAutoSnipingExecution } = require("../../../hooks/use-auto-sniping-execution");
    useAutoSnipingExecution.mockReturnValue({
      config: { enabled: true },
      isExecutionActive: true,
      executionStatus: "active",
      activePositionsCount: 2,
      totalPnl: "15.25",
      successRate: 75,
      dailyTradeCount: 3,
      isLoading: false,
      isStartingExecution: false,
      isStoppingExecution: false,
      error: null,
      startExecution: jest.fn(),
      stopExecution: jest.fn(),
      updateConfig: jest.fn(),
      refreshData: jest.fn(),
      clearError: jest.fn(),
    });

    render(
      <TestWrapper>
        <SimpleAutoSnipingControl />
      </TestWrapper>
    );

    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("2 positions")).toBeInTheDocument();
  });

  it("handles loading states gracefully", () => {
    const { useAutoSnipingExecution } = require("../../../hooks/use-auto-sniping-execution");
    useAutoSnipingExecution.mockReturnValue({
      config: { enabled: true },
      isExecutionActive: false,
      executionStatus: "idle",
      activePositionsCount: 0,
      totalPnl: "0",
      successRate: 0,
      dailyTradeCount: 0,
      isLoading: false,
      isStartingExecution: true,
      isStoppingExecution: false,
      error: null,
      startExecution: jest.fn(),
      stopExecution: jest.fn(),
      updateConfig: jest.fn(),
      refreshData: jest.fn(),
      clearError: jest.fn(),
    });

    render(
      <TestWrapper>
        <SimpleAutoSnipingControl />
      </TestWrapper>
    );

    expect(screen.getByText("Starting")).toBeInTheDocument();
    expect(screen.getByText("Starting...")).toBeInTheDocument();
  });
});
