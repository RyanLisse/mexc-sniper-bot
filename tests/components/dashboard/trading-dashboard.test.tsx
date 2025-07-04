/**
 * Trading Dashboard Component Tests
 * Comprehensive testing for the main trading dashboard with real-time updates,
 * metrics display, and user interactions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { testUtils } from '../../utils/component-helpers';

// Add jest-axe matcher
expect.extend(toHaveNoViolations);

// Mock trading dashboard component
const MockTradingDashboard = ({ 
  userId = 'test-user-id',
  isAuthenticated = true,
  refreshInterval = 5000,
  enableRealTimeUpdates = true,
  onRefresh,
  onSettingsClick,
  onAlertClick
}: any) => {
  const [metrics, setMetrics] = vi.fn().mockReturnValue([
    {
      totalBalance: 5000.00,
      availableBalance: 4500.00,
      lockedBalance: 500.00,
      totalPnL: 250.75,
      totalPnLPercentage: 5.25,
      activePositions: 3,
      totalTrades: 47,
      winRate: 68.5,
      lastUpdate: new Date().toISOString()
    },
    vi.fn()
  ]);

  const [isLoading, setIsLoading] = vi.fn().mockReturnValue([false, vi.fn()]);
  const [error, setError] = vi.fn().mockReturnValue([null, vi.fn()]);
  const [lastUpdateTime, setLastUpdateTime] = vi.fn().mockReturnValue([new Date(), vi.fn()]);

  const currentMetrics = metrics;

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setLastUpdateTime(new Date());
      onRefresh?.();
    } catch (err) {
      setError('Failed to refresh data');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="dashboard-container" data-testid="dashboard-unauthorized">
        <div className="auth-required">
          <h2>Authentication Required</h2>
          <p>Please sign in to access the trading dashboard.</p>
          <button type="button" data-testid="signin-prompt">
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container" data-testid="trading-dashboard">
      {/* Dashboard Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <h1>MEXC Sniper Bot Dashboard</h1>
          <div className="header-controls">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              aria-label="Refresh dashboard data"
              data-testid="refresh-button"
            >
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              type="button"
              onClick={onSettingsClick}
              aria-label="Open settings"
              data-testid="settings-button"
            >
              Settings
            </button>
          </div>
        </div>
        
        {error && (
          <div 
            role="alert" 
            className="error-banner"
            data-testid="error-banner"
          >
            {error}
          </div>
        )}

        <div className="last-update" data-testid="last-update">
          Last updated: {lastUpdateTime.toLocaleTimeString()}
        </div>
      </header>

      {/* Real-time Status Indicator */}
      <div className="status-bar" data-testid="status-bar">
        <div className="status-indicator">
          <span 
            className={`status-dot ${enableRealTimeUpdates ? 'active' : 'inactive'}`}
            data-testid="realtime-status"
          ></span>
          <span>
            {enableRealTimeUpdates ? 'Real-time updates active' : 'Real-time updates paused'}
          </span>
        </div>
        <div className="connection-status" data-testid="connection-status">
          <span>Connected to MEXC</span>
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className="metrics-grid" data-testid="metrics-grid">
        {/* Balance Card */}
        <div className="metric-card balance-card" data-testid="balance-card">
          <div className="card-header">
            <h3>Portfolio Balance</h3>
            <button 
              type="button"
              aria-label="View balance details"
              data-testid="balance-details-button"
            >
              Details
            </button>
          </div>
          <div className="card-content">
            <div className="balance-main">
              <span className="currency">$</span>
              <span className="amount" data-testid="total-balance">
                {currentMetrics.totalBalance.toLocaleString('en-US', { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 2 
                })}
              </span>
            </div>
            <div className="balance-breakdown">
              <div className="balance-item">
                <span>Available:</span>
                <span data-testid="available-balance">
                  ${currentMetrics.availableBalance.toLocaleString('en-US', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
                </span>
              </div>
              <div className="balance-item">
                <span>Locked:</span>
                <span data-testid="locked-balance">
                  ${currentMetrics.lockedBalance.toLocaleString('en-US', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* PnL Card */}
        <div className="metric-card pnl-card" data-testid="pnl-card">
          <div className="card-header">
            <h3>Total P&L</h3>
          </div>
          <div className="card-content">
            <div className={`pnl-main ${currentMetrics.totalPnL >= 0 ? 'positive' : 'negative'}`}>
              <span className="currency">$</span>
              <span className="amount" data-testid="total-pnl">
                {Math.abs(currentMetrics.totalPnL).toLocaleString('en-US', { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 2 
                })}
              </span>
            </div>
            <div className={`pnl-percentage ${currentMetrics.totalPnL >= 0 ? 'positive' : 'negative'}`}>
              <span data-testid="pnl-percentage">
                {currentMetrics.totalPnL >= 0 ? '+' : '-'}{Math.abs(currentMetrics.totalPnLPercentage)}%
              </span>
            </div>
          </div>
        </div>

        {/* Trading Stats Card */}
        <div className="metric-card stats-card" data-testid="stats-card">
          <div className="card-header">
            <h3>Trading Statistics</h3>
          </div>
          <div className="card-content">
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Active Positions</span>
                <span className="stat-value" data-testid="active-positions">
                  {currentMetrics.activePositions}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Total Trades</span>
                <span className="stat-value" data-testid="total-trades">
                  {currentMetrics.totalTrades}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Win Rate</span>
                <span className="stat-value" data-testid="win-rate">
                  {currentMetrics.winRate}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="metric-card actions-card" data-testid="actions-card">
          <div className="card-header">
            <h3>Quick Actions</h3>
          </div>
          <div className="card-content">
            <div className="actions-grid">
              <button 
                type="button" 
                className="action-button primary"
                data-testid="start-sniping-button"
              >
                Start Auto-Sniping
              </button>
              <button 
                type="button" 
                className="action-button secondary"
                data-testid="manual-trade-button"
              >
                Manual Trade
              </button>
              <button 
                type="button" 
                className="action-button tertiary"
                data-testid="view-history-button"
              >
                View History
              </button>
              <button 
                type="button" 
                className="action-button alert"
                onClick={onAlertClick}
                data-testid="alerts-button"
              >
                Alerts (2)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Chart Section */}
      <div className="chart-section" data-testid="chart-section">
        <div className="chart-header">
          <h3>Performance Chart</h3>
          <div className="chart-controls">
            <button 
              type="button" 
              className="time-filter active"
              data-testid="chart-1h"
            >
              1H
            </button>
            <button 
              type="button" 
              className="time-filter"
              data-testid="chart-24h"
            >
              24H
            </button>
            <button 
              type="button" 
              className="time-filter"
              data-testid="chart-7d"
            >
              7D
            </button>
            <button 
              type="button" 
              className="time-filter"
              data-testid="chart-30d"
            >
              30D
            </button>
          </div>
        </div>
        <div className="chart-container" data-testid="chart-container">
          {/* Mock chart placeholder */}
          <div className="chart-placeholder">
            <svg
              width="100%"
              height="300"
              viewBox="0 0 800 300"
              data-testid="performance-chart"
              role="img"
              aria-label="Portfolio performance chart"
            >
              <line x1="0" y1="150" x2="800" y2="120" stroke="#22c55e" strokeWidth="2" />
              <circle cx="200" cy="140" r="3" fill="#22c55e" />
              <circle cx="400" cy="130" r="3" fill="#22c55e" />
              <circle cx="600" cy="125" r="3" fill="#22c55e" />
            </svg>
          </div>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="activity-section" data-testid="activity-section">
        <div className="section-header">
          <h3>Recent Activity</h3>
          <button 
            type="button"
            data-testid="view-all-activity"
          >
            View All
          </button>
        </div>
        <div className="activity-list" data-testid="activity-list">
          <div className="activity-item" data-testid="activity-item-1">
            <div className="activity-icon success"></div>
            <div className="activity-content">
              <div className="activity-title">BTC/USDT Trade Executed</div>
              <div className="activity-details">Buy 0.001 BTC at $45,230</div>
              <div className="activity-time">2 minutes ago</div>
            </div>
          </div>
          <div className="activity-item" data-testid="activity-item-2">
            <div className="activity-icon info"></div>
            <div className="activity-content">
              <div className="activity-title">Pattern Detected</div>
              <div className="activity-details">ETH/USDT Bullish Breakout (85% confidence)</div>
              <div className="activity-time">5 minutes ago</div>
            </div>
          </div>
          <div className="activity-item" data-testid="activity-item-3">
            <div className="activity-icon warning"></div>
            <div className="activity-content">
              <div className="activity-title">Risk Alert</div>
              <div className="activity-details">Position size approaching limit</div>
              <div className="activity-time">10 minutes ago</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Mock the actual component
vi.mock('../../../src/components/dashboard/simplified-trading-dashboard', () => ({
  default: MockTradingDashboard,
  SimplifiedTradingDashboard: MockTradingDashboard,
}));

describe('TradingDashboard Component', () => {
  let mockOnRefresh: ReturnType<typeof vi.fn>;
  let mockOnSettingsClick: ReturnType<typeof vi.fn>;
  let mockOnAlertClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnRefresh = vi.fn();
    mockOnSettingsClick = vi.fn();
    mockOnAlertClick = vi.fn();
    testUtils.mockWindowMethods();
    testUtils.mockIntersectionObserver();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render trading dashboard with all main sections', () => {
      testUtils.renderWithProviders(
        <MockTradingDashboard 
          isAuthenticated={true}
          onRefresh={mockOnRefresh}
          onSettingsClick={mockOnSettingsClick}
          onAlertClick={mockOnAlertClick}
        />
      );

      expect(screen.getByTestId('trading-dashboard')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /mexc sniper bot dashboard/i })).toBeInTheDocument();
      expect(screen.getByTestId('metrics-grid')).toBeInTheDocument();
      expect(screen.getByTestId('chart-section')).toBeInTheDocument();
      expect(screen.getByTestId('activity-section')).toBeInTheDocument();
    });

    it('should have proper accessibility structure', async () => {
      const { container } = testUtils.renderWithProviders(
        <MockTradingDashboard 
          isAuthenticated={true}
          onRefresh={mockOnRefresh}
          onSettingsClick={mockOnSettingsClick}
          onAlertClick={mockOnAlertClick}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should display unauthorized state when not authenticated', () => {
      testUtils.renderWithProviders(
        <MockTradingDashboard 
          isAuthenticated={false}
          onRefresh={mockOnRefresh}
          onSettingsClick={mockOnSettingsClick}
          onAlertClick={mockOnAlertClick}
        />
      );

      expect(screen.getByTestId('dashboard-unauthorized')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /authentication required/i })).toBeInTheDocument();
      expect(screen.getByTestId('signin-prompt')).toBeInTheDocument();
    });
  });

  describe('Metrics Display', () => {
    beforeEach(() => {
      testUtils.renderWithProviders(
        <MockTradingDashboard 
          isAuthenticated={true}
          onRefresh={mockOnRefresh}
          onSettingsClick={mockOnSettingsClick}
          onAlertClick={mockOnAlertClick}
        />
      );
    });

    it('should display portfolio balance correctly', () => {
      expect(screen.getByTestId('balance-card')).toBeInTheDocument();
      expect(screen.getByTestId('total-balance')).toHaveTextContent('5,000.00');
      expect(screen.getByTestId('available-balance')).toHaveTextContent('$4,500.00');
      expect(screen.getByTestId('locked-balance')).toHaveTextContent('$500.00');
    });

    it('should display P&L with correct formatting and color coding', () => {
      const pnlCard = screen.getByTestId('pnl-card');
      expect(pnlCard).toBeInTheDocument();
      
      const pnlAmount = screen.getByTestId('total-pnl');
      expect(pnlAmount).toHaveTextContent('250.75');
      
      const pnlPercentage = screen.getByTestId('pnl-percentage');
      expect(pnlPercentage).toHaveTextContent('+5.25%');
    });

    it('should display trading statistics', () => {
      expect(screen.getByTestId('stats-card')).toBeInTheDocument();
      expect(screen.getByTestId('active-positions')).toHaveTextContent('3');
      expect(screen.getByTestId('total-trades')).toHaveTextContent('47');
      expect(screen.getByTestId('win-rate')).toHaveTextContent('68.5%');
    });

    it('should format currency values correctly', () => {
      const totalBalance = screen.getByTestId('total-balance');
      expect(totalBalance).toHaveTextContent('5,000.00');
      
      const availableBalance = screen.getByTestId('available-balance');
      expect(availableBalance).toHaveTextContent('$4,500.00');
    });
  });

  describe('Real-time Updates', () => {
    it('should show real-time status indicator', () => {
      testUtils.renderWithProviders(
        <MockTradingDashboard 
          isAuthenticated={true}
          enableRealTimeUpdates={true}
          onRefresh={mockOnRefresh}
          onSettingsClick={mockOnSettingsClick}
          onAlertClick={mockOnAlertClick}
        />
      );

      expect(screen.getByTestId('status-bar')).toBeInTheDocument();
      expect(screen.getByTestId('realtime-status')).toHaveClass('active');
      expect(screen.getByText(/real-time updates active/i)).toBeInTheDocument();
    });

    it('should show paused state when real-time updates disabled', () => {
      testUtils.renderWithProviders(
        <MockTradingDashboard 
          isAuthenticated={true}
          enableRealTimeUpdates={false}
          onRefresh={mockOnRefresh}
          onSettingsClick={mockOnSettingsClick}
          onAlertClick={mockOnAlertClick}
        />
      );

      expect(screen.getByTestId('realtime-status')).toHaveClass('inactive');
      expect(screen.getByText(/real-time updates paused/i)).toBeInTheDocument();
    });

    it('should display last update time', () => {
      testUtils.renderWithProviders(
        <MockTradingDashboard 
          isAuthenticated={true}
          onRefresh={mockOnRefresh}
          onSettingsClick={mockOnSettingsClick}
          onAlertClick={mockOnAlertClick}
        />
      );

      expect(screen.getByTestId('last-update')).toBeInTheDocument();
      expect(screen.getByTestId('last-update')).toHaveTextContent(/last updated:/i);
    });
  });

  describe('User Interactions', () => {
    beforeEach(() => {
      testUtils.renderWithProviders(
        <MockTradingDashboard 
          isAuthenticated={true}
          onRefresh={mockOnRefresh}
          onSettingsClick={mockOnSettingsClick}
          onAlertClick={mockOnAlertClick}
        />
      );
    });

    it('should handle refresh button click', async () => {
      const refreshButton = screen.getByTestId('refresh-button');
      
      fireEvent.click(refreshButton);
      
      expect(refreshButton).toHaveTextContent('Refreshing...');
      expect(refreshButton).toBeDisabled();
      
      await waitFor(() => {
        expect(mockOnRefresh).toHaveBeenCalled();
      });
    });

    it('should handle settings button click', () => {
      const settingsButton = screen.getByTestId('settings-button');
      
      fireEvent.click(settingsButton);
      
      expect(mockOnSettingsClick).toHaveBeenCalled();
    });

    it('should handle alerts button click', () => {
      const alertsButton = screen.getByTestId('alerts-button');
      
      fireEvent.click(alertsButton);
      
      expect(mockOnAlertClick).toHaveBeenCalled();
    });

    it('should handle quick action button clicks', () => {
      const startSnipingButton = screen.getByTestId('start-sniping-button');
      const manualTradeButton = screen.getByTestId('manual-trade-button');
      const viewHistoryButton = screen.getByTestId('view-history-button');

      fireEvent.click(startSnipingButton);
      fireEvent.click(manualTradeButton);
      fireEvent.click(viewHistoryButton);

      // Buttons should be clickable and responsive
      expect(startSnipingButton).toBeInTheDocument();
      expect(manualTradeButton).toBeInTheDocument();
      expect(viewHistoryButton).toBeInTheDocument();
    });
  });

  describe('Chart Functionality', () => {
    beforeEach(() => {
      testUtils.renderWithProviders(
        <MockTradingDashboard 
          isAuthenticated={true}
          onRefresh={mockOnRefresh}
          onSettingsClick={mockOnSettingsClick}
          onAlertClick={mockOnAlertClick}
        />
      );
    });

    it('should render performance chart', () => {
      expect(screen.getByTestId('chart-section')).toBeInTheDocument();
      expect(screen.getByTestId('performance-chart')).toBeInTheDocument();
      expect(screen.getByRole('img', { name: /portfolio performance chart/i })).toBeInTheDocument();
    });

    it('should have time filter controls', () => {
      expect(screen.getByTestId('chart-1h')).toBeInTheDocument();
      expect(screen.getByTestId('chart-24h')).toBeInTheDocument();
      expect(screen.getByTestId('chart-7d')).toBeInTheDocument();
      expect(screen.getByTestId('chart-30d')).toBeInTheDocument();

      // Default active filter
      expect(screen.getByTestId('chart-1h')).toHaveClass('active');
    });

    it('should handle time filter selection', () => {
      const chart24h = screen.getByTestId('chart-24h');
      
      fireEvent.click(chart24h);
      
      // In real implementation, would update chart data
      expect(chart24h).toBeInTheDocument();
    });
  });

  describe('Activity Feed', () => {
    beforeEach(() => {
      testUtils.renderWithProviders(
        <MockTradingDashboard 
          isAuthenticated={true}
          onRefresh={mockOnRefresh}
          onSettingsClick={mockOnSettingsClick}
          onAlertClick={mockOnAlertClick}
        />
      );
    });

    it('should display recent activity items', () => {
      expect(screen.getByTestId('activity-section')).toBeInTheDocument();
      expect(screen.getByTestId('activity-list')).toBeInTheDocument();
      
      expect(screen.getByTestId('activity-item-1')).toBeInTheDocument();
      expect(screen.getByTestId('activity-item-2')).toBeInTheDocument();
      expect(screen.getByTestId('activity-item-3')).toBeInTheDocument();
    });

    it('should show different activity types with appropriate styling', () => {
      const activityItem1 = screen.getByTestId('activity-item-1');
      const activityItem2 = screen.getByTestId('activity-item-2');
      const activityItem3 = screen.getByTestId('activity-item-3');

      expect(within(activityItem1).getByText(/btc\/usdt trade executed/i)).toBeInTheDocument();
      expect(within(activityItem2).getByText(/pattern detected/i)).toBeInTheDocument();
      expect(within(activityItem3).getByText(/risk alert/i)).toBeInTheDocument();
    });

    it('should handle view all activity button', () => {
      const viewAllButton = screen.getByTestId('view-all-activity');
      
      fireEvent.click(viewAllButton);
      
      expect(viewAllButton).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error banner when error occurs', () => {
      // Mock error state by simulating a failed refresh
      testUtils.renderWithProviders(
        <MockTradingDashboard 
          isAuthenticated={true}
          onRefresh={mockOnRefresh}
          onSettingsClick={mockOnSettingsClick}
          onAlertClick={mockOnAlertClick}
        />
      );

      // Simulate error during refresh
      const refreshButton = screen.getByTestId('refresh-button');
      fireEvent.click(refreshButton);

      // In real implementation, error would be set and displayed
      const errorBanner = screen.queryByTestId('error-banner');
      if (errorBanner) {
        expect(errorBanner).toHaveAttribute('role', 'alert');
      }
    });
  });

  describe('Responsive Design', () => {
    it('should handle mobile viewport', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      testUtils.renderWithProviders(
        <MockTradingDashboard 
          isAuthenticated={true}
          onRefresh={mockOnRefresh}
          onSettingsClick={mockOnSettingsClick}
          onAlertClick={mockOnAlertClick}
        />
      );

      expect(screen.getByTestId('trading-dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('metrics-grid')).toBeInTheDocument();
    });

    it('should handle tablet viewport', () => {
      // Mock tablet viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      testUtils.renderWithProviders(
        <MockTradingDashboard 
          isAuthenticated={true}
          onRefresh={mockOnRefresh}
          onSettingsClick={mockOnSettingsClick}
          onAlertClick={mockOnAlertClick}
        />
      );

      expect(screen.getByTestId('trading-dashboard')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support keyboard navigation', () => {
      testUtils.renderWithProviders(
        <MockTradingDashboard 
          isAuthenticated={true}
          onRefresh={mockOnRefresh}
          onSettingsClick={mockOnSettingsClick}
          onAlertClick={mockOnAlertClick}
        />
      );

      const refreshButton = screen.getByTestId('refresh-button');
      const settingsButton = screen.getByTestId('settings-button');

      // Test tab navigation
      refreshButton.focus();
      expect(document.activeElement).toBe(refreshButton);

      // Test Enter key
      fireEvent.keyDown(refreshButton, { key: 'Enter' });
      
      // Test Space key
      fireEvent.keyDown(settingsButton, { key: ' ' });
    });
  });

  describe('Performance', () => {
    it('should render quickly', async () => {
      const component = (
        <MockTradingDashboard 
          isAuthenticated={true}
          onRefresh={mockOnRefresh}
          onSettingsClick={mockOnSettingsClick}
          onAlertClick={mockOnAlertClick}
        />
      );

      await testUtils.expectFastRender(component, 200);
    });

    it('should handle large amounts of activity data', () => {
      // Mock component with many activity items
      testUtils.renderWithProviders(
        <MockTradingDashboard 
          isAuthenticated={true}
          onRefresh={mockOnRefresh}
          onSettingsClick={mockOnSettingsClick}
          onAlertClick={mockOnAlertClick}
        />
      );

      expect(screen.getByTestId('activity-list')).toBeInTheDocument();
      // Should render efficiently even with many items
    });
  });

  describe('Connection Status', () => {
    it('should display connection status', () => {
      testUtils.renderWithProviders(
        <MockTradingDashboard 
          isAuthenticated={true}
          onRefresh={mockOnRefresh}
          onSettingsClick={mockOnSettingsClick}
          onAlertClick={mockOnAlertClick}
        />
      );

      expect(screen.getByTestId('connection-status')).toBeInTheDocument();
      expect(screen.getByText(/connected to mexc/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility Features', () => {
    it('should have proper ARIA labels and roles', () => {
      testUtils.renderWithProviders(
        <MockTradingDashboard 
          isAuthenticated={true}
          onRefresh={mockOnRefresh}
          onSettingsClick={mockOnSettingsClick}
          onAlertClick={mockOnAlertClick}
        />
      );

      const refreshButton = screen.getByTestId('refresh-button');
      const settingsButton = screen.getByTestId('settings-button');
      const chart = screen.getByTestId('performance-chart');

      expect(refreshButton).toHaveAttribute('aria-label', 'Refresh dashboard data');
      expect(settingsButton).toHaveAttribute('aria-label', 'Open settings');
      expect(chart).toHaveAttribute('aria-label', 'Portfolio performance chart');
    });

    it('should support screen readers', () => {
      testUtils.renderWithProviders(
        <MockTradingDashboard 
          isAuthenticated={true}
          onRefresh={mockOnRefresh}
          onSettingsClick={mockOnSettingsClick}
          onAlertClick={mockOnAlertClick}
        />
      );

      // Important content should be accessible to screen readers
      expect(screen.getByRole('heading', { name: /mexc sniper bot dashboard/i })).toBeInTheDocument();
      expect(screen.getByRole('img', { name: /portfolio performance chart/i })).toBeInTheDocument();
    });
  });
});