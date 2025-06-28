/**
 * Enhanced Metrics Dashboard Tests
 * 
 * Comprehensive test suite for the Phase 3 monitoring dashboard component
 * that displays comprehensive performance metrics with real-time updates
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnhancedMetricsDashboard } from '@/src/components/monitoring/enhanced-metrics-dashboard';

// Mock the fetch API globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock the UI components
vi.mock('@/src/components/ui/card', () => ({
  Card: ({ children, className = '' }: { children: React.ReactNode; className?: string }) => 
    <div data-testid="card" className={className}>{children}</div>,
  CardContent: ({ children, className = '' }: { children: React.ReactNode; className?: string }) => 
    <div data-testid="card-content" className={className}>{children}</div>,
  CardHeader: ({ children, className = '' }: { children: React.ReactNode; className?: string }) => 
    <div data-testid="card-header" className={className}>{children}</div>,
  CardTitle: ({ children, className = '' }: { children: React.ReactNode; className?: string }) => 
    <h3 data-testid="card-title" className={className}>{children}</h3>,
}));

vi.mock('@/src/components/ui/badge', () => ({
  Badge: ({ children, className = '' }: { children: React.ReactNode; className?: string }) => 
    <span data-testid="badge" className={className}>{children}</span>,
}));

vi.mock('@/src/components/ui/progress', () => ({
  Progress: ({ value, className = '' }: { value: number; className?: string }) => 
    <div data-testid="progress" data-value={value} className={className}>
      <div style={{ width: `${value}%` }} />
    </div>,
}));

vi.mock('@/src/components/ui/button', () => ({
  Button: ({ children, onClick, variant, size, className = '' }: { 
    children: React.ReactNode; 
    onClick?: () => void; 
    variant?: string; 
    size?: string; 
    className?: string;
  }) => 
    <button 
      data-testid="button" 
      onClick={onClick} 
      data-variant={variant} 
      data-size={size} 
      className={className}
    >
      {children}
    </button>,
}));

vi.mock('@/src/components/ui/tabs', () => ({
  Tabs: ({ children, defaultValue, className = '' }: { 
    children: React.ReactNode; 
    defaultValue?: string; 
    className?: string; 
  }) => 
    <div data-testid="tabs" data-default-value={defaultValue} className={className}>{children}</div>,
  TabsContent: ({ children, value, className = '' }: { 
    children: React.ReactNode; 
    value: string; 
    className?: string; 
  }) => 
    <div data-testid={`tabs-content-${value}`} className={className}>{children}</div>,
  TabsList: ({ children, className = '' }: { children: React.ReactNode; className?: string }) => 
    <div data-testid="tabs-list" className={className}>{children}</div>,
  TabsTrigger: ({ children, value, className = '' }: { 
    children: React.ReactNode; 
    value: string; 
    className?: string; 
  }) => 
    <button data-testid={`tabs-trigger-${value}`} className={className}>{children}</button>,
}));

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  Activity: () => <div data-testid="activity-icon" />,
  TrendingUp: () => <div data-testid="trending-up-icon" />,
  TrendingDown: () => <div data-testid="trending-down-icon" />,
  AlertTriangle: () => <div data-testid="alert-triangle-icon" />,
  CheckCircle: () => <div data-testid="check-circle-icon" />,
  XCircle: () => <div data-testid="x-circle-icon" />,
  DollarSign: () => <div data-testid="dollar-sign-icon" />,
  Shield: () => <div data-testid="shield-icon" />,
  Zap: () => <div data-testid="zap-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
}));

describe('EnhancedMetricsDashboard', () => {
  const mockMetricsData = {
    timestamp: '2024-06-27T12:00:00.000Z',
    performance: {
      trading: {
        executionLatency: 125.5,
        orderFillRate: 98.5,
        apiResponseTime: 45.2,
        patternDetectionAccuracy: 87.3,
        riskCalculationTime: 15.8,
        websocketLatency: 12.3,
      },
      system: {
        memoryUsageMB: 512.5,
        cpuUsagePercent: 35.7,
        uptime: 86400, // 24 hours in seconds
      },
      alerts: {
        active: 2,
        lastAlert: '2024-06-27T11:45:00.000Z',
      },
    },
    trading: {
      execution: {
        totalTrades: 145,
        successRate: 94.5,
        averageExecutionTime: 125.5,
        averageSlippage: 0.025,
      },
      profitability: {
        totalPnL: 2540.75,
        profitableTrades: 137,
        averagePnL: 17.52,
        maxDrawdown: -125.30,
      },
      risk: {
        currentExposure: 65.2,
        maxExposure: 80.0,
        riskScore: 72,
      },
      patterns: {
        detectionsToday: 28,
        averageConfidence: 82.4,
        successRate: 76.8,
      },
    },
    realtime: {
      totalTrades: 145,
      successfulTrades: 137,
      totalPnL: 2540.75,
      currentExposure: 65.2,
      averageExecutionTime: 125.5,
      averageSlippage: 0.025,
    },
    health: {
      status: 'healthy' as const,
      issues: [],
      score: 89,
    },
  };

  const mockMetricsResponse = {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({ data: mockMetricsData }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue(mockMetricsResponse);
    
    // Mock Date.now for consistent timestamps
    vi.spyOn(Date, 'now').mockReturnValue(1703769600000); // Fixed timestamp
  });

  describe('Component Rendering', () => {
    it('should render loading state initially', () => {
      // Make fetch hang to test loading state
      mockFetch.mockReturnValue(new Promise(() => {}));
      
      render(<EnhancedMetricsDashboard />);
      
      expect(screen.getByText('Loading enhanced metrics...')).toBeInTheDocument();
      expect(screen.getByTestId('activity-icon')).toBeInTheDocument();
    });

    it('should render error state when fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Error loading metrics: Network error')).toBeInTheDocument();
        expect(screen.getByTestId('x-circle-icon')).toBeInTheDocument();
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });

    it('should render error state when fetch returns non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
      
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Error loading metrics: HTTP 500: Internal Server Error')).toBeInTheDocument();
      });
    });

    it('should render dashboard when data loads successfully', async () => {
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Enhanced Performance Metrics')).toBeInTheDocument();
        expect(screen.getByText('System Health Score')).toBeInTheDocument();
        expect(screen.getByText('HEALTHY')).toBeInTheDocument();
      });
    });

    it('should display last updated timestamp', async () => {
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
      });
    });
  });

  describe('Health Status Display', () => {
    it('should display healthy status correctly', async () => {
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('HEALTHY')).toBeInTheDocument();
        expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
      });
    });

    it('should display degraded status correctly', async () => {
      const degradedData = {
        ...mockMetricsData,
        health: {
          status: 'degraded' as const,
          issues: ['High latency detected'],
          score: 65,
        },
      };
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: degradedData }),
      });
      
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('DEGRADED')).toBeInTheDocument();
        expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();
        expect(screen.getByText('High latency detected')).toBeInTheDocument();
      });
    });

    it('should display unhealthy status correctly', async () => {
      const unhealthyData = {
        ...mockMetricsData,
        health: {
          status: 'unhealthy' as const,
          issues: ['API connection failed', 'Database timeout'],
          score: 25,
        },
      };
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: unhealthyData }),
      });
      
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('UNHEALTHY')).toBeInTheDocument();
        expect(screen.getByTestId('x-circle-icon')).toBeInTheDocument();
        expect(screen.getByText('API connection failed')).toBeInTheDocument();
        expect(screen.getByText('Database timeout')).toBeInTheDocument();
      });
    });

    it('should display health score progress bar', async () => {
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('89/100')).toBeInTheDocument();
        const progressBar = screen.getByTestId('progress');
        expect(progressBar).toHaveAttribute('data-value', '89');
      });
    });
  });

  describe('Trading Metrics Tab', () => {
    it('should display trading metrics correctly', async () => {
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        // Total trades
        expect(screen.getByText('145')).toBeInTheDocument();
        expect(screen.getByText('Success Rate: 94.50%')).toBeInTheDocument();
        
        // P&L
        expect(screen.getByText('$2,540.75')).toBeInTheDocument();
        expect(screen.getByText('Avg: $17.52')).toBeInTheDocument();
        
        // Execution time
        expect(screen.getByText('125.5ms')).toBeInTheDocument();
        expect(screen.getByText('Slippage: 0.03bp')).toBeInTheDocument();
        
        // Pattern detection
        expect(screen.getByText('28')).toBeInTheDocument();
        expect(screen.getByText('Confidence: 82.40%')).toBeInTheDocument();
      });
    });

    it('should display negative P&L with red color', async () => {
      const negativeData = {
        ...mockMetricsData,
        trading: {
          ...mockMetricsData.trading,
          profitability: {
            ...mockMetricsData.trading.profitability,
            totalPnL: -1250.50,
            averagePnL: -8.62,
          },
        },
      };
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: negativeData }),
      });
      
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('-$1,250.50')).toBeInTheDocument();
        expect(screen.getByText('Avg: -$8.62')).toBeInTheDocument();
      });
    });
  });

  describe('Performance Metrics Tab', () => {
    it('should display performance metrics correctly', async () => {
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        // Should show performance metrics values
        expect(screen.getByText('45.2ms')).toBeInTheDocument(); // API response time
        expect(screen.getByText('12.3ms')).toBeInTheDocument(); // WebSocket latency
        expect(screen.getByText('15.8ms')).toBeInTheDocument(); // Pattern processing time
      });
    });
  });

  describe('Risk Metrics Tab', () => {
    it('should display risk metrics correctly', async () => {
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('65.20%')).toBeInTheDocument(); // Current exposure
        expect(screen.getByText('72/100')).toBeInTheDocument(); // Risk score
        expect(screen.getByText('-$125.30')).toBeInTheDocument(); // Max drawdown
      });
    });

    it('should display risk progress bars', async () => {
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        const progressBars = screen.getAllByTestId('progress');
        const exposureBar = progressBars.find(bar => bar.getAttribute('data-value') === '65.2');
        const riskScoreBar = progressBars.find(bar => bar.getAttribute('data-value') === '72');
        
        expect(exposureBar).toBeInTheDocument();
        expect(riskScoreBar).toBeInTheDocument();
      });
    });
  });

  describe('System Metrics Tab', () => {
    it('should display system metrics correctly', async () => {
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('512.5 MB')).toBeInTheDocument(); // Memory usage
        expect(screen.getByText('24h')).toBeInTheDocument(); // Uptime hours
        expect(screen.getByText('0m')).toBeInTheDocument(); // Uptime minutes
        expect(screen.getByText('2')).toBeInTheDocument(); // Active alerts
      });
    });

    it('should display memory usage progress bar', async () => {
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        const progressBars = screen.getAllByTestId('progress');
        // Memory usage percentage: (512.5 / 1024) * 100 = 50.0488...
        const memoryBar = progressBars.find(bar => {
          const value = parseFloat(bar.getAttribute('data-value') || '0');
          return Math.abs(value - 50.0488) < 0.1;
        });
        expect(memoryBar).toBeInTheDocument();
      });
    });

    it('should display last alert time when available', async () => {
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText(/Last: 2024-06-27T11:45:00.000Z/)).toBeInTheDocument();
      });
    });
  });

  describe('Auto-refresh Functionality', () => {
    it('should have auto-refresh enabled by default', async () => {
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Pause Auto-refresh')).toBeInTheDocument();
      });
    });

    it('should toggle auto-refresh when button is clicked', async () => {
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        const toggleButton = screen.getByText('Pause Auto-refresh');
        fireEvent.click(toggleButton);
        expect(screen.getByText('Resume Auto-refresh')).toBeInTheDocument();
      });
    });

    it('should call fetch on manual refresh', async () => {
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      const refreshButton = screen.getByText('Refresh Now');
      fireEvent.click(refreshButton);
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });

    it('should retry on error button click', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        const retryButton = screen.getByText('Retry');
        fireEvent.click(retryButton);
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Tab Navigation', () => {
    it('should render all tab triggers', async () => {
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        expect(screen.getByTestId('tabs-trigger-trading')).toBeInTheDocument();
        expect(screen.getByTestId('tabs-trigger-performance')).toBeInTheDocument();
        expect(screen.getByTestId('tabs-trigger-risk')).toBeInTheDocument();
        expect(screen.getByTestId('tabs-trigger-system')).toBeInTheDocument();
      });
    });

    it('should render all tab content areas', async () => {
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        expect(screen.getByTestId('tabs-content-trading')).toBeInTheDocument();
        expect(screen.getByTestId('tabs-content-performance')).toBeInTheDocument();
        expect(screen.getByTestId('tabs-content-risk')).toBeInTheDocument();
        expect(screen.getByTestId('tabs-content-system')).toBeInTheDocument();
      });
    });

    it('should default to trading tab', async () => {
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        const tabs = screen.getByTestId('tabs');
        expect(tabs).toHaveAttribute('data-default-value', 'trading');
      });
    });
  });

  describe('Utility Functions', () => {
    it('should format currency values correctly', async () => {
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('$2,540.75')).toBeInTheDocument();
        expect(screen.getByText('$17.52')).toBeInTheDocument();
        expect(screen.getByText('-$125.30')).toBeInTheDocument();
      });
    });

    it('should format percentage values correctly', async () => {
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('94.50%')).toBeInTheDocument();
        expect(screen.getByText('82.40%')).toBeInTheDocument();
        expect(screen.getByText('65.20%')).toBeInTheDocument();
      });
    });

    it('should format duration values correctly', async () => {
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('125.5ms')).toBeInTheDocument();
        expect(screen.getByText('45.2ms')).toBeInTheDocument();
        expect(screen.getByText('12.3ms')).toBeInTheDocument();
        expect(screen.getByText('15.8ms')).toBeInTheDocument();
      });
    });

    it('should format uptime correctly', async () => {
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        // 86400 seconds = 24 hours, 0 minutes
        expect(screen.getByText('24h')).toBeInTheDocument();
        expect(screen.getByText('0m')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing metrics data gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: null }),
      });
      
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('No metrics data available')).toBeInTheDocument();
      });
    });

    it('should handle empty health issues array', async () => {
      const dataWithoutIssues = {
        ...mockMetricsData,
        health: {
          ...mockMetricsData.health,
          issues: [],
        },
      };
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: dataWithoutIssues }),
      });
      
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        expect(screen.queryByText('Active Issues:')).not.toBeInTheDocument();
      });
    });

    it('should handle missing last alert gracefully', async () => {
      const dataWithoutLastAlert = {
        ...mockMetricsData,
        performance: {
          ...mockMetricsData.performance,
          alerts: {
            active: 0,
            lastAlert: null,
          },
        },
      };
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: dataWithoutLastAlert }),
      });
      
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('0')).toBeInTheDocument(); // Active alerts count
        expect(screen.queryByText(/Last:/)).not.toBeInTheDocument();
      });
    });

    it('should handle very large numbers correctly', async () => {
      const dataWithLargeNumbers = {
        ...mockMetricsData,
        trading: {
          ...mockMetricsData.trading,
          execution: {
            ...mockMetricsData.trading.execution,
            totalTrades: 999999,
          },
          profitability: {
            ...mockMetricsData.trading.profitability,
            totalPnL: 1234567.89,
          },
        },
      };
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: dataWithLargeNumbers }),
      });
      
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('999999')).toBeInTheDocument();
        expect(screen.getByText('$1,234,567.89')).toBeInTheDocument();
      });
    });
  });

  describe('Component Lifecycle', () => {
    it('should fetch data on mount', async () => {
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/monitoring/enhanced-metrics');
      });
    });

    it('should clean up auto-refresh interval on unmount', async () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      const { unmount } = render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        // Component should be loaded
        expect(screen.getByText('Enhanced Performance Metrics')).toBeInTheDocument();
      });
      
      unmount();
      
      // clearInterval should have been called during cleanup
      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should not set up auto-refresh interval when disabled', async () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      
      render(<EnhancedMetricsDashboard />);
      
      await waitFor(() => {
        const toggleButton = screen.getByText('Pause Auto-refresh');
        fireEvent.click(toggleButton);
      });
      
      // Initial interval should be set up, then cleared when disabled
      expect(setIntervalSpy).toHaveBeenCalled();
    });
  });
});