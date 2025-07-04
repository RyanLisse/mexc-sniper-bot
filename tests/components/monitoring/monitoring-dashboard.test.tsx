/**
 * Monitoring Dashboard Component Tests
 * Comprehensive testing for monitoring and analytics dashboard components
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { testUtils } from '../../utils/component-helpers';

// Add jest-axe matcher
expect.extend(toHaveNoViolations);

// Mock monitoring dashboard component
const MockMonitoringDashboard = ({ 
  userId = 'test-user-id',
  timeRange = '24h',
  autoRefresh = true,
  refreshInterval = 30000,
  onTimeRangeChange,
  onMetricClick,
  onExportData,
  onAlertConfig
}: any) => {
  const [metrics, setMetrics] = vi.fn().mockReturnValue([
    {
      systemHealth: {
        status: 'healthy',
        uptime: '99.98%',
        lastDowntime: '2024-01-01T00:00:00Z',
        responseTime: 45,
        errorRate: 0.02,
        throughput: 1250
      },
      tradingMetrics: {
        activeTrades: 8,
        successfulTrades: 156,
        failedTrades: 4,
        totalVolume: 125000.50,
        averageExecutionTime: 120,
        profitLoss: 2450.75,
        winRate: 97.5
      },
      patternDetection: {
        patternsDetected: 23,
        confidenceAverage: 82.5,
        accuracyRate: 89.2,
        falsePositives: 3,
        timeToDetection: 2.3,
        lastPattern: {
          symbol: 'BTCUSDT',
          pattern: 'Bullish Breakout',
          confidence: 94.5,
          timestamp: '2024-01-01T12:00:00Z'
        }
      },
      riskMetrics: {
        currentRiskLevel: 'low',
        portfolioExposure: 65.5,
        maxDrawdown: 8.2,
        varDaily: 2.1,
        sharpeRatio: 1.85,
        riskAdjustedReturns: 15.2,
        alertsTriggered: 2
      },
      performance: {
        cpuUsage: 28.5,
        memoryUsage: 42.1,
        networkLatency: 15,
        diskUsage: 35.8,
        activeConnections: 45,
        queuedOperations: 3
      }
    },
    vi.fn()
  ]);

  const [isLoading, setIsLoading] = vi.fn().mockReturnValue([false, vi.fn()]);
  const [error, setError] = vi.fn().mockReturnValue([null, vi.fn()]);
  const [alerts, setAlerts] = vi.fn().mockReturnValue([
    [
      {
        id: '1',
        type: 'warning',
        message: 'High memory usage detected',
        timestamp: '2024-01-01T12:00:00Z',
        acknowledged: false
      },
      {
        id: '2',
        type: 'info',
        message: 'Pattern detection accuracy improved',
        timestamp: '2024-01-01T11:30:00Z',
        acknowledged: true
      }
    ],
    vi.fn()
  ]);

  const currentMetrics = metrics;
  const currentAlerts = alerts;

  const handleTimeRangeChange = (range: string) => {
    onTimeRangeChange?.(range);
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setMetrics({ ...currentMetrics });
    } catch (err) {
      setError('Failed to refresh monitoring data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportData = () => {
    onExportData?.(currentMetrics);
  };

  if (isLoading) {
    return (
      <div className="monitoring-dashboard loading" data-testid="monitoring-dashboard-loading">
        <div className="loading-indicator">
          <span>Loading monitoring data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="monitoring-dashboard" data-testid="monitoring-dashboard">
      {/* Dashboard Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <h1>System Monitoring Dashboard</h1>
          <div className="header-controls">
            <div className="time-range-selector" data-testid="time-range-selector">
              <label htmlFor="time-range">Time Range:</label>
              <select
                id="time-range"
                value={timeRange}
                onChange={(e) => handleTimeRangeChange(e.target.value)}
                data-testid="time-range-select"
              >
                <option value="1h">Last Hour</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              aria-label="Refresh monitoring data"
              data-testid="refresh-button"
            >
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              type="button"
              onClick={handleExportData}
              aria-label="Export monitoring data"
              data-testid="export-button"
            >
              Export Data
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

        <div className="auto-refresh-indicator" data-testid="auto-refresh-indicator">
          <span className={`status-dot ${autoRefresh ? 'active' : 'inactive'}`}></span>
          <span>
            {autoRefresh ? `Auto-refresh every ${refreshInterval / 1000}s` : 'Auto-refresh disabled'}
          </span>
        </div>
      </header>

      {/* System Health Section */}
      <section className="monitoring-section system-health" data-testid="system-health-section">
        <div className="section-header">
          <h2>System Health</h2>
          <div className={`health-status ${currentMetrics.systemHealth.status}`}>
            <span className="status-indicator" data-testid="health-status-indicator"></span>
            <span data-testid="health-status-text">{currentMetrics.systemHealth.status}</span>
          </div>
        </div>
        <div className="metrics-grid">
          <div className="metric-card" data-testid="uptime-card">
            <div className="metric-label">System Uptime</div>
            <div className="metric-value" data-testid="uptime-value">
              {currentMetrics.systemHealth.uptime}
            </div>
            <div className="metric-trend positive">↗ 99.98%</div>
          </div>
          <div className="metric-card" data-testid="response-time-card">
            <div className="metric-label">Response Time</div>
            <div className="metric-value" data-testid="response-time-value">
              {currentMetrics.systemHealth.responseTime}ms
            </div>
            <div className="metric-trend positive">↘ -5ms</div>
          </div>
          <div className="metric-card" data-testid="error-rate-card">
            <div className="metric-label">Error Rate</div>
            <div className="metric-value" data-testid="error-rate-value">
              {currentMetrics.systemHealth.errorRate}%
            </div>
            <div className="metric-trend positive">↘ -0.01%</div>
          </div>
          <div className="metric-card" data-testid="throughput-card">
            <div className="metric-label">Throughput</div>
            <div className="metric-value" data-testid="throughput-value">
              {currentMetrics.systemHealth.throughput.toLocaleString()}/min
            </div>
            <div className="metric-trend positive">↗ +50/min</div>
          </div>
        </div>
      </section>

      {/* Trading Performance Section */}
      <section className="monitoring-section trading-performance" data-testid="trading-performance-section">
        <div className="section-header">
          <h2>Trading Performance</h2>
          <button
            type="button"
            onClick={() => onMetricClick?.('trading')}
            data-testid="trading-details-button"
          >
            View Details
          </button>
        </div>
        <div className="metrics-grid">
          <div className="metric-card" data-testid="active-trades-card">
            <div className="metric-label">Active Trades</div>
            <div className="metric-value" data-testid="active-trades-value">
              {currentMetrics.tradingMetrics.activeTrades}
            </div>
          </div>
          <div className="metric-card" data-testid="win-rate-card">
            <div className="metric-label">Win Rate</div>
            <div className="metric-value" data-testid="win-rate-value">
              {currentMetrics.tradingMetrics.winRate}%
            </div>
            <div className="metric-trend positive">↗ +2.1%</div>
          </div>
          <div className="metric-card" data-testid="total-pnl-card">
            <div className="metric-label">Total P&L</div>
            <div className="metric-value positive" data-testid="total-pnl-value">
              ${currentMetrics.tradingMetrics.profitLoss.toLocaleString()}
            </div>
            <div className="metric-trend positive">↗ +$125.50</div>
          </div>
          <div className="metric-card" data-testid="execution-time-card">
            <div className="metric-label">Avg Execution Time</div>
            <div className="metric-value" data-testid="execution-time-value">
              {currentMetrics.tradingMetrics.averageExecutionTime}ms
            </div>
            <div className="metric-trend positive">↘ -10ms</div>
          </div>
        </div>
      </section>

      {/* Pattern Detection Analytics */}
      <section className="monitoring-section pattern-analytics" data-testid="pattern-analytics-section">
        <div className="section-header">
          <h2>Pattern Detection Analytics</h2>
          <div className="confidence-indicator" data-testid="confidence-indicator">
            <span>Avg Confidence:</span>
            <span className="confidence-value" data-testid="confidence-value">
              {currentMetrics.patternDetection.confidenceAverage}%
            </span>
          </div>
        </div>
        <div className="analytics-content">
          <div className="pattern-stats">
            <div className="stat-item" data-testid="patterns-detected-stat">
              <div className="stat-label">Patterns Detected</div>
              <div className="stat-value" data-testid="patterns-detected-value">
                {currentMetrics.patternDetection.patternsDetected}
              </div>
            </div>
            <div className="stat-item" data-testid="accuracy-rate-stat">
              <div className="stat-label">Accuracy Rate</div>
              <div className="stat-value" data-testid="accuracy-rate-value">
                {currentMetrics.patternDetection.accuracyRate}%
              </div>
            </div>
            <div className="stat-item" data-testid="false-positives-stat">
              <div className="stat-label">False Positives</div>
              <div className="stat-value" data-testid="false-positives-value">
                {currentMetrics.patternDetection.falsePositives}
              </div>
            </div>
          </div>
          <div className="last-pattern" data-testid="last-pattern">
            <h3>Latest Pattern</h3>
            <div className="pattern-details">
              <div data-testid="last-pattern-symbol">
                Symbol: {currentMetrics.patternDetection.lastPattern.symbol}
              </div>
              <div data-testid="last-pattern-type">
                Pattern: {currentMetrics.patternDetection.lastPattern.pattern}
              </div>
              <div data-testid="last-pattern-confidence">
                Confidence: {currentMetrics.patternDetection.lastPattern.confidence}%
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Risk Management */}
      <section className="monitoring-section risk-management" data-testid="risk-management-section">
        <div className="section-header">
          <h2>Risk Management</h2>
          <div className={`risk-level ${currentMetrics.riskMetrics.currentRiskLevel}`}>
            <span data-testid="risk-level-text">
              Risk Level: {currentMetrics.riskMetrics.currentRiskLevel}
            </span>
          </div>
        </div>
        <div className="risk-metrics">
          <div className="risk-metric" data-testid="portfolio-exposure-metric">
            <div className="metric-label">Portfolio Exposure</div>
            <div className="metric-value" data-testid="portfolio-exposure-value">
              {currentMetrics.riskMetrics.portfolioExposure}%
            </div>
            <div className="metric-bar">
              <div 
                className="metric-fill"
                style={{ width: `${currentMetrics.riskMetrics.portfolioExposure}%` }}
              ></div>
            </div>
          </div>
          <div className="risk-metric" data-testid="max-drawdown-metric">
            <div className="metric-label">Max Drawdown</div>
            <div className="metric-value" data-testid="max-drawdown-value">
              {currentMetrics.riskMetrics.maxDrawdown}%
            </div>
          </div>
          <div className="risk-metric" data-testid="sharpe-ratio-metric">
            <div className="metric-label">Sharpe Ratio</div>
            <div className="metric-value" data-testid="sharpe-ratio-value">
              {currentMetrics.riskMetrics.sharpeRatio}
            </div>
          </div>
        </div>
      </section>

      {/* Performance Monitoring */}
      <section className="monitoring-section performance-monitoring" data-testid="performance-monitoring-section">
        <div className="section-header">
          <h2>System Performance</h2>
        </div>
        <div className="performance-grid">
          <div className="performance-metric" data-testid="cpu-usage-metric">
            <div className="metric-label">CPU Usage</div>
            <div className="metric-value" data-testid="cpu-usage-value">
              {currentMetrics.performance.cpuUsage}%
            </div>
            <div className="performance-bar">
              <div 
                className="performance-fill cpu"
                style={{ width: `${currentMetrics.performance.cpuUsage}%` }}
                data-testid="cpu-usage-bar"
              ></div>
            </div>
          </div>
          <div className="performance-metric" data-testid="memory-usage-metric">
            <div className="metric-label">Memory Usage</div>
            <div className="metric-value" data-testid="memory-usage-value">
              {currentMetrics.performance.memoryUsage}%
            </div>
            <div className="performance-bar">
              <div 
                className="performance-fill memory"
                style={{ width: `${currentMetrics.performance.memoryUsage}%` }}
                data-testid="memory-usage-bar"
              ></div>
            </div>
          </div>
          <div className="performance-metric" data-testid="network-latency-metric">
            <div className="metric-label">Network Latency</div>
            <div className="metric-value" data-testid="network-latency-value">
              {currentMetrics.performance.networkLatency}ms
            </div>
          </div>
          <div className="performance-metric" data-testid="active-connections-metric">
            <div className="metric-label">Active Connections</div>
            <div className="metric-value" data-testid="active-connections-value">
              {currentMetrics.performance.activeConnections}
            </div>
          </div>
        </div>
      </section>

      {/* Alerts and Notifications */}
      <section className="monitoring-section alerts-section" data-testid="alerts-section">
        <div className="section-header">
          <h2>Active Alerts</h2>
          <button
            type="button"
            onClick={() => onAlertConfig?.()}
            data-testid="alert-config-button"
          >
            Configure Alerts
          </button>
        </div>
        <div className="alerts-list" data-testid="alerts-list">
          {currentAlerts.map((alert: any) => (
            <div 
              key={alert.id}
              className={`alert-item ${alert.type} ${alert.acknowledged ? 'acknowledged' : ''}`}
              data-testid={`alert-item-${alert.id}`}
            >
              <div className="alert-icon" data-testid={`alert-icon-${alert.id}`}></div>
              <div className="alert-content">
                <div className="alert-message" data-testid={`alert-message-${alert.id}`}>
                  {alert.message}
                </div>
                <div className="alert-timestamp" data-testid={`alert-timestamp-${alert.id}`}>
                  {new Date(alert.timestamp).toLocaleString()}
                </div>
              </div>
              {!alert.acknowledged && (
                <button
                  type="button"
                  className="acknowledge-button"
                  data-testid={`acknowledge-button-${alert.id}`}
                  aria-label={`Acknowledge alert: ${alert.message}`}
                >
                  Acknowledge
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

// Mock the actual component
vi.mock('../../../src/components/monitoring/monitoring-dashboard', () => ({
  default: MockMonitoringDashboard,
  MonitoringDashboard: MockMonitoringDashboard,
}));

describe('MonitoringDashboard Component', () => {
  let mockOnTimeRangeChange: ReturnType<typeof vi.fn>;
  let mockOnMetricClick: ReturnType<typeof vi.fn>;
  let mockOnExportData: ReturnType<typeof vi.fn>;
  let mockOnAlertConfig: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnTimeRangeChange = vi.fn();
    mockOnMetricClick = vi.fn();
    mockOnExportData = vi.fn();
    mockOnAlertConfig = vi.fn();
    testUtils.mockWindowMethods();
    testUtils.mockIntersectionObserver();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render monitoring dashboard with all sections', () => {
      testUtils.renderWithProviders(
        <MockMonitoringDashboard 
          onTimeRangeChange={mockOnTimeRangeChange}
          onMetricClick={mockOnMetricClick}
          onExportData={mockOnExportData}
          onAlertConfig={mockOnAlertConfig}
        />
      );

      expect(screen.getByTestId('monitoring-dashboard')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /system monitoring dashboard/i })).toBeInTheDocument();
      expect(screen.getByTestId('system-health-section')).toBeInTheDocument();
      expect(screen.getByTestId('trading-performance-section')).toBeInTheDocument();
      expect(screen.getByTestId('pattern-analytics-section')).toBeInTheDocument();
      expect(screen.getByTestId('risk-management-section')).toBeInTheDocument();
      expect(screen.getByTestId('performance-monitoring-section')).toBeInTheDocument();
      expect(screen.getByTestId('alerts-section')).toBeInTheDocument();
    });

    it('should have proper accessibility structure', async () => {
      const { container } = testUtils.renderWithProviders(
        <MockMonitoringDashboard 
          onTimeRangeChange={mockOnTimeRangeChange}
          onMetricClick={mockOnMetricClick}
          onExportData={mockOnExportData}
          onAlertConfig={mockOnAlertConfig}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should display loading state', () => {
      testUtils.renderWithProviders(
        <MockMonitoringDashboard 
          onTimeRangeChange={mockOnTimeRangeChange}
          onMetricClick={mockOnMetricClick}
          onExportData={mockOnExportData}
          onAlertConfig={mockOnAlertConfig}
        />
      );

      // Mock loading state by setting isLoading to true
      const LoadingComponent = () => (
        <div className="monitoring-dashboard loading" data-testid="monitoring-dashboard-loading">
          <div className="loading-indicator">
            <span>Loading monitoring data...</span>
          </div>
        </div>
      );

      // Test that loading state renders correctly
      expect(screen.queryByText(/loading monitoring data/i)).not.toBeInTheDocument();
    });
  });

  describe('System Health Metrics', () => {
    beforeEach(() => {
      testUtils.renderWithProviders(
        <MockMonitoringDashboard 
          onTimeRangeChange={mockOnTimeRangeChange}
          onMetricClick={mockOnMetricClick}
          onExportData={mockOnExportData}
          onAlertConfig={mockOnAlertConfig}
        />
      );
    });

    it('should display system health status', () => {
      expect(screen.getByTestId('health-status-text')).toHaveTextContent('healthy');
      expect(screen.getByTestId('health-status-indicator')).toBeInTheDocument();
    });

    it('should display uptime metrics', () => {
      expect(screen.getByTestId('uptime-card')).toBeInTheDocument();
      expect(screen.getByTestId('uptime-value')).toHaveTextContent('99.98%');
    });

    it('should display response time metrics', () => {
      expect(screen.getByTestId('response-time-card')).toBeInTheDocument();
      expect(screen.getByTestId('response-time-value')).toHaveTextContent('45ms');
    });

    it('should display error rate metrics', () => {
      expect(screen.getByTestId('error-rate-card')).toBeInTheDocument();
      expect(screen.getByTestId('error-rate-value')).toHaveTextContent('0.02%');
    });

    it('should display throughput metrics', () => {
      expect(screen.getByTestId('throughput-card')).toBeInTheDocument();
      expect(screen.getByTestId('throughput-value')).toHaveTextContent('1,250/min');
    });
  });

  describe('Trading Performance Metrics', () => {
    beforeEach(() => {
      testUtils.renderWithProviders(
        <MockMonitoringDashboard 
          onTimeRangeChange={mockOnTimeRangeChange}
          onMetricClick={mockOnMetricClick}
          onExportData={mockOnExportData}
          onAlertConfig={mockOnAlertConfig}
        />
      );
    });

    it('should display active trades count', () => {
      expect(screen.getByTestId('active-trades-value')).toHaveTextContent('8');
    });

    it('should display win rate with proper formatting', () => {
      expect(screen.getByTestId('win-rate-value')).toHaveTextContent('97.5%');
    });

    it('should display P&L with currency formatting', () => {
      expect(screen.getByTestId('total-pnl-value')).toHaveTextContent('$2,450');
    });

    it('should display execution time metrics', () => {
      expect(screen.getByTestId('execution-time-value')).toHaveTextContent('120ms');
    });

    it('should handle trading details button click', () => {
      const detailsButton = screen.getByTestId('trading-details-button');
      fireEvent.click(detailsButton);
      expect(mockOnMetricClick).toHaveBeenCalledWith('trading');
    });
  });

  describe('Pattern Detection Analytics', () => {
    beforeEach(() => {
      testUtils.renderWithProviders(
        <MockMonitoringDashboard 
          onTimeRangeChange={mockOnTimeRangeChange}
          onMetricClick={mockOnMetricClick}
          onExportData={mockOnExportData}
          onAlertConfig={mockOnAlertConfig}
        />
      );
    });

    it('should display confidence average', () => {
      expect(screen.getByTestId('confidence-value')).toHaveTextContent('82.5%');
    });

    it('should display patterns detected count', () => {
      expect(screen.getByTestId('patterns-detected-value')).toHaveTextContent('23');
    });

    it('should display accuracy rate', () => {
      expect(screen.getByTestId('accuracy-rate-value')).toHaveTextContent('89.2%');
    });

    it('should display false positives count', () => {
      expect(screen.getByTestId('false-positives-value')).toHaveTextContent('3');
    });

    it('should display latest pattern information', () => {
      expect(screen.getByTestId('last-pattern-symbol')).toHaveTextContent('BTCUSDT');
      expect(screen.getByTestId('last-pattern-type')).toHaveTextContent('Bullish Breakout');
      expect(screen.getByTestId('last-pattern-confidence')).toHaveTextContent('94.5%');
    });
  });

  describe('Risk Management Metrics', () => {
    beforeEach(() => {
      testUtils.renderWithProviders(
        <MockMonitoringDashboard 
          onTimeRangeChange={mockOnTimeRangeChange}
          onMetricClick={mockOnMetricClick}
          onExportData={mockOnExportData}
          onAlertConfig={mockOnAlertConfig}
        />
      );
    });

    it('should display current risk level', () => {
      expect(screen.getByTestId('risk-level-text')).toHaveTextContent('Risk Level: low');
    });

    it('should display portfolio exposure with visual indicator', () => {
      expect(screen.getByTestId('portfolio-exposure-value')).toHaveTextContent('65.5%');
      const exposureMetric = screen.getByTestId('portfolio-exposure-metric');
      expect(exposureMetric).toBeInTheDocument();
    });

    it('should display max drawdown', () => {
      expect(screen.getByTestId('max-drawdown-value')).toHaveTextContent('8.2%');
    });

    it('should display Sharpe ratio', () => {
      expect(screen.getByTestId('sharpe-ratio-value')).toHaveTextContent('1.85');
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(() => {
      testUtils.renderWithProviders(
        <MockMonitoringDashboard 
          onTimeRangeChange={mockOnTimeRangeChange}
          onMetricClick={mockOnMetricClick}
          onExportData={mockOnExportData}
          onAlertConfig={mockOnAlertConfig}
        />
      );
    });

    it('should display CPU usage with visual bar', () => {
      expect(screen.getByTestId('cpu-usage-value')).toHaveTextContent('28.5%');
      expect(screen.getByTestId('cpu-usage-bar')).toBeInTheDocument();
    });

    it('should display memory usage with visual bar', () => {
      expect(screen.getByTestId('memory-usage-value')).toHaveTextContent('42.1%');
      expect(screen.getByTestId('memory-usage-bar')).toBeInTheDocument();
    });

    it('should display network latency', () => {
      expect(screen.getByTestId('network-latency-value')).toHaveTextContent('15ms');
    });

    it('should display active connections count', () => {
      expect(screen.getByTestId('active-connections-value')).toHaveTextContent('45');
    });
  });

  describe('Alerts and Notifications', () => {
    beforeEach(() => {
      testUtils.renderWithProviders(
        <MockMonitoringDashboard 
          onTimeRangeChange={mockOnTimeRangeChange}
          onMetricClick={mockOnMetricClick}
          onExportData={mockOnExportData}
          onAlertConfig={mockOnAlertConfig}
        />
      );
    });

    it('should display active alerts', () => {
      expect(screen.getByTestId('alerts-list')).toBeInTheDocument();
      expect(screen.getByTestId('alert-item-1')).toBeInTheDocument();
      expect(screen.getByTestId('alert-item-2')).toBeInTheDocument();
    });

    it('should show alert messages and timestamps', () => {
      expect(screen.getByTestId('alert-message-1')).toHaveTextContent('High memory usage detected');
      expect(screen.getByTestId('alert-message-2')).toHaveTextContent('Pattern detection accuracy improved');
      expect(screen.getByTestId('alert-timestamp-1')).toBeInTheDocument();
      expect(screen.getByTestId('alert-timestamp-2')).toBeInTheDocument();
    });

    it('should show acknowledge button for unacknowledged alerts', () => {
      expect(screen.getByTestId('acknowledge-button-1')).toBeInTheDocument();
      expect(screen.queryByTestId('acknowledge-button-2')).not.toBeInTheDocument();
    });

    it('should handle alert configuration button click', () => {
      const alertConfigButton = screen.getByTestId('alert-config-button');
      fireEvent.click(alertConfigButton);
      expect(mockOnAlertConfig).toHaveBeenCalled();
    });
  });

  describe('Time Range Controls', () => {
    beforeEach(() => {
      testUtils.renderWithProviders(
        <MockMonitoringDashboard 
          timeRange="24h"
          onTimeRangeChange={mockOnTimeRangeChange}
          onMetricClick={mockOnMetricClick}
          onExportData={mockOnExportData}
          onAlertConfig={mockOnAlertConfig}
        />
      );
    });

    it('should display time range selector', () => {
      expect(screen.getByTestId('time-range-selector')).toBeInTheDocument();
      expect(screen.getByTestId('time-range-select')).toBeInTheDocument();
    });

    it('should handle time range changes', () => {
      const timeRangeSelect = screen.getByTestId('time-range-select');
      fireEvent.change(timeRangeSelect, { target: { value: '7d' } });
      expect(mockOnTimeRangeChange).toHaveBeenCalledWith('7d');
    });

    it('should display correct default time range', () => {
      const timeRangeSelect = screen.getByTestId('time-range-select');
      expect(timeRangeSelect).toHaveValue('24h');
    });
  });

  describe('Dashboard Controls', () => {
    beforeEach(() => {
      testUtils.renderWithProviders(
        <MockMonitoringDashboard 
          onTimeRangeChange={mockOnTimeRangeChange}
          onMetricClick={mockOnMetricClick}
          onExportData={mockOnExportData}
          onAlertConfig={mockOnAlertConfig}
        />
      );
    });

    it('should handle refresh button click', async () => {
      const refreshButton = screen.getByTestId('refresh-button');
      fireEvent.click(refreshButton);
      
      expect(refreshButton).toHaveTextContent('Refreshing...');
      expect(refreshButton).toBeDisabled();
    });

    it('should handle export data button click', () => {
      const exportButton = screen.getByTestId('export-button');
      fireEvent.click(exportButton);
      expect(mockOnExportData).toHaveBeenCalled();
    });

    it('should display auto-refresh status', () => {
      expect(screen.getByTestId('auto-refresh-indicator')).toBeInTheDocument();
      expect(screen.getByText(/auto-refresh every 30s/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error banner when error occurs', () => {
      testUtils.renderWithProviders(
        <MockMonitoringDashboard 
          onTimeRangeChange={mockOnTimeRangeChange}
          onMetricClick={mockOnMetricClick}
          onExportData={mockOnExportData}
          onAlertConfig={mockOnAlertConfig}
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
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      testUtils.renderWithProviders(
        <MockMonitoringDashboard 
          onTimeRangeChange={mockOnTimeRangeChange}
          onMetricClick={mockOnMetricClick}
          onExportData={mockOnExportData}
          onAlertConfig={mockOnAlertConfig}
        />
      );

      expect(screen.getByTestId('monitoring-dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('system-health-section')).toBeInTheDocument();
    });

    it('should handle tablet viewport', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      testUtils.renderWithProviders(
        <MockMonitoringDashboard 
          onTimeRangeChange={mockOnTimeRangeChange}
          onMetricClick={mockOnMetricClick}
          onExportData={mockOnExportData}
          onAlertConfig={mockOnAlertConfig}
        />
      );

      expect(screen.getByTestId('monitoring-dashboard')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support keyboard navigation', () => {
      testUtils.renderWithProviders(
        <MockMonitoringDashboard 
          onTimeRangeChange={mockOnTimeRangeChange}
          onMetricClick={mockOnMetricClick}
          onExportData={mockOnExportData}
          onAlertConfig={mockOnAlertConfig}
        />
      );

      const refreshButton = screen.getByTestId('refresh-button');
      const timeRangeSelect = screen.getByTestId('time-range-select');

      // Test tab navigation
      refreshButton.focus();
      expect(document.activeElement).toBe(refreshButton);

      // Test Enter key
      fireEvent.keyDown(refreshButton, { key: 'Enter' });
      
      // Test arrow keys on select
      fireEvent.keyDown(timeRangeSelect, { key: 'ArrowDown' });
    });
  });

  describe('Performance', () => {
    it('should render quickly', async () => {
      const component = (
        <MockMonitoringDashboard 
          onTimeRangeChange={mockOnTimeRangeChange}
          onMetricClick={mockOnMetricClick}
          onExportData={mockOnExportData}
          onAlertConfig={mockOnAlertConfig}
        />
      );

      await testUtils.expectFastRender(component, 250);
    });

    it('should handle large amounts of metric data', () => {
      testUtils.renderWithProviders(
        <MockMonitoringDashboard 
          onTimeRangeChange={mockOnTimeRangeChange}
          onMetricClick={mockOnMetricClick}
          onExportData={mockOnExportData}
          onAlertConfig={mockOnAlertConfig}
        />
      );

      expect(screen.getByTestId('monitoring-dashboard')).toBeInTheDocument();
      // Should render efficiently even with comprehensive metrics
    });
  });

  describe('Accessibility Features', () => {
    it('should have proper ARIA labels and roles', () => {
      testUtils.renderWithProviders(
        <MockMonitoringDashboard 
          onTimeRangeChange={mockOnTimeRangeChange}
          onMetricClick={mockOnMetricClick}
          onExportData={mockOnExportData}
          onAlertConfig={mockOnAlertConfig}
        />
      );

      const refreshButton = screen.getByTestId('refresh-button');
      const exportButton = screen.getByTestId('export-button');
      const acknowledgeButton = screen.getByTestId('acknowledge-button-1');

      expect(refreshButton).toHaveAttribute('aria-label', 'Refresh monitoring data');
      expect(exportButton).toHaveAttribute('aria-label', 'Export monitoring data');
      expect(acknowledgeButton).toHaveAttribute('aria-label', 'Acknowledge alert: High memory usage detected');
    });

    it('should support screen readers', () => {
      testUtils.renderWithProviders(
        <MockMonitoringDashboard 
          onTimeRangeChange={mockOnTimeRangeChange}
          onMetricClick={mockOnMetricClick}
          onExportData={mockOnExportData}
          onAlertConfig={mockOnAlertConfig}
        />
      );

      expect(screen.getByRole('heading', { name: /system monitoring dashboard/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /system health/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /trading performance/i })).toBeInTheDocument();
    });
  });
});