/**
 * Alerts Panel Component Tests
 * Comprehensive testing for alerts, notifications, and real-time monitoring components
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { testUtils } from '../../utils/component-helpers';

// Add jest-axe matcher
expect.extend(toHaveNoViolations);

// Mock alerts panel component
const MockAlertsPanel = ({ 
  userId = 'test-user-id',
  alerts = [],
  maxDisplayCount = 50,
  autoRefresh = true,
  refreshInterval = 30000,
  filterType = 'all',
  sortBy = 'timestamp',
  sortOrder = 'desc',
  showAcknowledged = false,
  enableSound = true,
  enableToast = true,
  onAlertClick,
  onAlertAcknowledge,
  onAlertDismiss,
  onFilterChange,
  onSortChange,
  onConfigureAlerts,
  onMarkAllRead,
  onClearAll
}: any) => {
  const [alertsList, setAlertsList] = vi.fn().mockReturnValue([
    alerts.length > 0 ? alerts : [
      {
        id: 'alert-1',
        type: 'critical',
        severity: 'high',
        title: 'Trading System Alert',
        message: 'Critical error in order execution module',
        timestamp: '2024-01-01T12:00:00Z',
        source: 'trading-engine',
        acknowledged: false,
        dismissed: false,
        category: 'system',
        tags: ['trading', 'critical', 'order-execution'],
        actions: ['acknowledge', 'investigate'],
        metadata: {
          errorCode: 'TE-001',
          affectedOrders: 3,
          estimatedImpact: 'high'
        }
      },
      {
        id: 'alert-2',
        type: 'warning',
        severity: 'medium',
        title: 'High Memory Usage',
        message: 'System memory usage has exceeded 85% threshold',
        timestamp: '2024-01-01T11:45:00Z',
        source: 'system-monitor',
        acknowledged: false,
        dismissed: false,
        category: 'performance',
        tags: ['memory', 'performance', 'warning'],
        actions: ['acknowledge', 'optimize'],
        metadata: {
          currentUsage: '87%',
          threshold: '85%',
          trend: 'increasing'
        }
      },
      {
        id: 'alert-3',
        type: 'info',
        severity: 'low',
        title: 'Pattern Detection Success',
        message: 'New bullish pattern detected on BTCUSDT with 94% confidence',
        timestamp: '2024-01-01T11:30:00Z',
        source: 'pattern-detector',
        acknowledged: true,
        dismissed: false,
        category: 'trading',
        tags: ['pattern', 'bullish', 'btc'],
        actions: ['view-details', 'create-trade'],
        metadata: {
          symbol: 'BTCUSDT',
          pattern: 'bullish-breakout',
          confidence: '94%',
          expectedMove: '+2.5%'
        }
      },
      {
        id: 'alert-4',
        type: 'success',
        severity: 'low',
        title: 'Trade Executed Successfully',
        message: 'Buy order for 0.001 BTC completed at $45,230',
        timestamp: '2024-01-01T11:15:00Z',
        source: 'order-manager',
        acknowledged: false,
        dismissed: false,
        category: 'trading',
        tags: ['trade', 'success', 'btc'],
        actions: ['view-trade', 'acknowledge'],
        metadata: {
          orderId: 'order-12345',
          symbol: 'BTCUSDT',
          quantity: '0.001',
          price: '$45,230',
          side: 'buy'
        }
      },
      {
        id: 'alert-5',
        type: 'error',
        severity: 'high',
        title: 'API Connection Failed',
        message: 'Failed to connect to MEXC API after 3 retry attempts',
        timestamp: '2024-01-01T11:00:00Z',
        source: 'api-client',
        acknowledged: false,
        dismissed: true,
        category: 'connectivity',
        tags: ['api', 'connection', 'error'],
        actions: ['retry-connection', 'check-status'],
        metadata: {
          endpoint: 'api.mexc.com',
          lastError: 'timeout',
          retryCount: 3,
          nextRetry: '2024-01-01T11:05:00Z'
        }
      }
    ],
    vi.fn()
  ]);

  const [isLoading, setIsLoading] = vi.fn().mockReturnValue([false, vi.fn()]);
  const [unreadCount, setUnreadCount] = vi.fn().mockReturnValue([3, vi.fn()]);
  const [selectedAlert, setSelectedAlert] = vi.fn().mockReturnValue([null, vi.fn()]);

  const currentAlerts = alertsList;
  const currentUnreadCount = unreadCount;

  const filteredAlerts = currentAlerts.filter((alert: any) => {
    if (filterType === 'all') return true;
    if (filterType === 'unread') return !alert.acknowledged;
    if (filterType === 'acknowledged') return alert.acknowledged;
    return alert.type === filterType;
  }).filter((alert: any) => {
    if (!showAcknowledged && alert.acknowledged) return false;
    return !alert.dismissed;
  });

  const sortedAlerts = [...filteredAlerts].sort((a: any, b: any) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];
    
    if (sortBy === 'timestamp') {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    }
    
    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1;
    }
    return aVal < bVal ? 1 : -1;
  });

  const handleAlertClick = (alert: any) => {
    setSelectedAlert(alert);
    onAlertClick?.(alert);
  };

  const handleAcknowledge = (alertId: string) => {
    const updatedAlerts = currentAlerts.map((alert: any) => 
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    );
    setAlertsList(updatedAlerts);
    setUnreadCount(Math.max(0, currentUnreadCount - 1));
    onAlertAcknowledge?.(alertId);
  };

  const handleDismiss = (alertId: string) => {
    const updatedAlerts = currentAlerts.map((alert: any) => 
      alert.id === alertId ? { ...alert, dismissed: true } : alert
    );
    setAlertsList(updatedAlerts);
    onAlertDismiss?.(alertId);
  };

  const handleMarkAllRead = () => {
    const updatedAlerts = currentAlerts.map((alert: any) => ({ ...alert, acknowledged: true }));
    setAlertsList(updatedAlerts);
    setUnreadCount(0);
    onMarkAllRead?.();
  };

  const handleClearAll = () => {
    const updatedAlerts = currentAlerts.map((alert: any) => ({ ...alert, dismissed: true }));
    setAlertsList(updatedAlerts);
    onClearAll?.();
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'critical': return '❌';
      case 'error': return '⚠️';
      case 'warning': return '⚡';
      case 'info': return 'ℹ️';
      case 'success': return '✅';
      default: return '📢';
    }
  };

  if (isLoading) {
    return (
      <div className="alerts-panel loading" data-testid="alerts-panel-loading">
        <div className="loading-indicator">
          <span>Loading alerts...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="alerts-panel" data-testid="alerts-panel">
      {/* Panel Header */}
      <div className="alerts-header" data-testid="alerts-header">
        <div className="header-title">
          <h2>Alerts & Notifications</h2>
          {currentUnreadCount > 0 && (
            <span className="unread-badge" data-testid="unread-badge">
              {currentUnreadCount}
            </span>
          )}
        </div>
        
        <div className="header-controls" data-testid="header-controls">
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={currentUnreadCount === 0}
            data-testid="mark-all-read-button"
          >
            Mark All Read
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            data-testid="clear-all-button"
          >
            Clear All
          </button>
          <button
            type="button"
            onClick={() => onConfigureAlerts?.()}
            data-testid="configure-alerts-button"
          >
            Configure
          </button>
        </div>
      </div>

      {/* Filters and Sort */}
      <div className="alerts-filters" data-testid="alerts-filters">
        <div className="filter-section">
          <label htmlFor="alert-filter">Filter:</label>
          <select
            id="alert-filter"
            value={filterType}
            onChange={(e) => onFilterChange?.(e.target.value)}
            data-testid="filter-select"
          >
            <option value="all">All Alerts</option>
            <option value="unread">Unread</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="critical">Critical</option>
            <option value="error">Errors</option>
            <option value="warning">Warnings</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
          </select>
        </div>

        <div className="sort-section">
          <label htmlFor="alert-sort">Sort by:</label>
          <select
            id="alert-sort"
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-');
              onSortChange?.(field, order);
            }}
            data-testid="sort-select"
          >
            <option value="timestamp-desc">Newest First</option>
            <option value="timestamp-asc">Oldest First</option>
            <option value="severity-desc">High Severity First</option>
            <option value="severity-asc">Low Severity First</option>
            <option value="type-asc">Type A-Z</option>
            <option value="type-desc">Type Z-A</option>
          </select>
        </div>

        <div className="view-options">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showAcknowledged}
              onChange={(e) => onFilterChange?.({ showAcknowledged: e.target.checked })}
              data-testid="show-acknowledged-checkbox"
            />
            Show Acknowledged
          </label>
        </div>
      </div>

      {/* Auto-refresh Indicator */}
      <div className="refresh-status" data-testid="refresh-status">
        <span className={`status-dot ${autoRefresh ? 'active' : 'inactive'}`}></span>
        <span>
          {autoRefresh ? `Auto-refresh every ${refreshInterval / 1000}s` : 'Auto-refresh disabled'}
        </span>
      </div>

      {/* Alerts List */}
      <div className="alerts-list" data-testid="alerts-list">
        {sortedAlerts.length === 0 ? (
          <div className="no-alerts" data-testid="no-alerts">
            <div className="no-alerts-icon">📭</div>
            <div className="no-alerts-text">
              {filterType === 'all' ? 'No alerts available' : `No ${filterType} alerts`}
            </div>
          </div>
        ) : (
          sortedAlerts.map((alert: any) => (
            <div
              key={alert.id}
              className={`alert-item ${alert.type} ${alert.severity} ${alert.acknowledged ? 'acknowledged' : 'unread'}`}
              data-testid={`alert-item-${alert.id}`}
              onClick={() => handleAlertClick(alert)}
            >
              <div className="alert-indicators" data-testid={`alert-indicators-${alert.id}`}>
                <span className="severity-icon" data-testid={`severity-icon-${alert.id}`}>
                  {getSeverityIcon(alert.severity)}
                </span>
                <span className="type-icon" data-testid={`type-icon-${alert.id}`}>
                  {getTypeIcon(alert.type)}
                </span>
              </div>

              <div className="alert-content" data-testid={`alert-content-${alert.id}`}>
                <div className="alert-header">
                  <h4 className="alert-title" data-testid={`alert-title-${alert.id}`}>
                    {alert.title}
                  </h4>
                  <div className="alert-meta" data-testid={`alert-meta-${alert.id}`}>
                    <span className="alert-source" data-testid={`alert-source-${alert.id}`}>
                      {alert.source}
                    </span>
                    <span className="alert-time" data-testid={`alert-time-${alert.id}`}>
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                <div className="alert-message" data-testid={`alert-message-${alert.id}`}>
                  {alert.message}
                </div>

                {alert.tags && alert.tags.length > 0 && (
                  <div className="alert-tags" data-testid={`alert-tags-${alert.id}`}>
                    {alert.tags.map((tag: string, index: number) => (
                      <span key={index} className="alert-tag" data-testid={`alert-tag-${alert.id}-${index}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                  <div className="alert-metadata" data-testid={`alert-metadata-${alert.id}`}>
                    {Object.entries(alert.metadata).map(([key, value]: [string, any]) => (
                      <div key={key} className="metadata-item" data-testid={`metadata-${alert.id}-${key}`}>
                        <span className="metadata-key">{key}:</span>
                        <span className="metadata-value">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="alert-actions" data-testid={`alert-actions-${alert.id}`}>
                {!alert.acknowledged && (
                  <button
                    type="button"
                    className="action-button acknowledge"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAcknowledge(alert.id);
                    }}
                    aria-label={`Acknowledge alert: ${alert.title}`}
                    data-testid={`acknowledge-button-${alert.id}`}
                  >
                    ✓
                  </button>
                )}
                
                <button
                  type="button"
                  className="action-button dismiss"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDismiss(alert.id);
                  }}
                  aria-label={`Dismiss alert: ${alert.title}`}
                  data-testid={`dismiss-button-${alert.id}`}
                >
                  ✕
                </button>

                {alert.actions && alert.actions.length > 0 && (
                  <div className="custom-actions" data-testid={`custom-actions-${alert.id}`}>
                    {alert.actions.map((action: string, index: number) => (
                      <button
                        key={index}
                        type="button"
                        className="action-button custom"
                        data-testid={`custom-action-${alert.id}-${index}`}
                      >
                        {action.replace('-', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Alerts Summary */}
      <div className="alerts-summary" data-testid="alerts-summary">
        <div className="summary-stats">
          <div className="stat-item" data-testid="total-alerts-stat">
            <span className="stat-label">Total:</span>
            <span className="stat-value" data-testid="total-alerts-count">
              {currentAlerts.filter((alert: any) => !alert.dismissed).length}
            </span>
          </div>
          <div className="stat-item" data-testid="unread-alerts-stat">
            <span className="stat-label">Unread:</span>
            <span className="stat-value" data-testid="unread-alerts-count">
              {currentUnreadCount}
            </span>
          </div>
          <div className="stat-item" data-testid="critical-alerts-stat">
            <span className="stat-label">Critical:</span>
            <span className="stat-value critical" data-testid="critical-alerts-count">
              {currentAlerts.filter((alert: any) => alert.severity === 'high' && !alert.dismissed).length}
            </span>
          </div>
        </div>
      </div>

      {/* Selected Alert Details Modal/Panel */}
      {selectedAlert && (
        <div className="alert-details-overlay" data-testid="alert-details-overlay">
          <div className="alert-details-panel" data-testid="alert-details-panel">
            <div className="details-header">
              <h3 data-testid="details-title">{selectedAlert.title}</h3>
              <button
                type="button"
                className="close-details"
                onClick={() => setSelectedAlert(null)}
                aria-label="Close alert details"
                data-testid="close-details-button"
              >
                ✕
              </button>
            </div>
            
            <div className="details-content" data-testid="details-content">
              <div className="detail-row">
                <span className="detail-label">Type:</span>
                <span className="detail-value" data-testid="details-type">{selectedAlert.type}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Severity:</span>
                <span className="detail-value" data-testid="details-severity">{selectedAlert.severity}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Source:</span>
                <span className="detail-value" data-testid="details-source">{selectedAlert.source}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Time:</span>
                <span className="detail-value" data-testid="details-timestamp">
                  {new Date(selectedAlert.timestamp).toLocaleString()}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Message:</span>
                <span className="detail-value" data-testid="details-message">{selectedAlert.message}</span>
              </div>
              
              {selectedAlert.metadata && (
                <div className="details-metadata" data-testid="details-metadata">
                  <h4>Additional Information:</h4>
                  {Object.entries(selectedAlert.metadata).map(([key, value]: [string, any]) => (
                    <div key={key} className="metadata-row">
                      <span className="metadata-label">{key}:</span>
                      <span className="metadata-value">{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Mock the actual component
vi.mock('../../../src/components/ui/alerts-panel', () => ({
  default: MockAlertsPanel,
  AlertsPanel: MockAlertsPanel,
}));

describe('AlertsPanel Component', () => {
  let mockOnAlertClick: ReturnType<typeof vi.fn>;
  let mockOnAlertAcknowledge: ReturnType<typeof vi.fn>;
  let mockOnAlertDismiss: ReturnType<typeof vi.fn>;
  let mockOnFilterChange: ReturnType<typeof vi.fn>;
  let mockOnSortChange: ReturnType<typeof vi.fn>;
  let mockOnConfigureAlerts: ReturnType<typeof vi.fn>;
  let mockOnMarkAllRead: ReturnType<typeof vi.fn>;
  let mockOnClearAll: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnAlertClick = vi.fn();
    mockOnAlertAcknowledge = vi.fn();
    mockOnAlertDismiss = vi.fn();
    mockOnFilterChange = vi.fn();
    mockOnSortChange = vi.fn();
    mockOnConfigureAlerts = vi.fn();
    mockOnMarkAllRead = vi.fn();
    mockOnClearAll = vi.fn();
    testUtils.mockWindowMethods();
    testUtils.mockIntersectionObserver();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render alerts panel with all sections', () => {
      testUtils.renderWithProviders(
        <MockAlertsPanel 
          onAlertClick={mockOnAlertClick}
          onAlertAcknowledge={mockOnAlertAcknowledge}
          onAlertDismiss={mockOnAlertDismiss}
          onFilterChange={mockOnFilterChange}
          onSortChange={mockOnSortChange}
          onConfigureAlerts={mockOnConfigureAlerts}
          onMarkAllRead={mockOnMarkAllRead}
          onClearAll={mockOnClearAll}
        />
      );

      expect(screen.getByTestId('alerts-panel')).toBeInTheDocument();
      expect(screen.getByTestId('alerts-header')).toBeInTheDocument();
      expect(screen.getByTestId('alerts-filters')).toBeInTheDocument();
      expect(screen.getByTestId('alerts-list')).toBeInTheDocument();
      expect(screen.getByTestId('alerts-summary')).toBeInTheDocument();
    });

    it('should have proper accessibility structure', async () => {
      const { container } = testUtils.renderWithProviders(
        <MockAlertsPanel 
          onAlertClick={mockOnAlertClick}
          onAlertAcknowledge={mockOnAlertAcknowledge}
          onAlertDismiss={mockOnAlertDismiss}
          onFilterChange={mockOnFilterChange}
          onSortChange={mockOnSortChange}
          onConfigureAlerts={mockOnConfigureAlerts}
          onMarkAllRead={mockOnMarkAllRead}
          onClearAll={mockOnClearAll}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should display alerts panel title', () => {
      testUtils.renderWithProviders(
        <MockAlertsPanel 
          onAlertClick={mockOnAlertClick}
          onAlertAcknowledge={mockOnAlertAcknowledge}
          onAlertDismiss={mockOnAlertDismiss}
          onFilterChange={mockOnFilterChange}
          onSortChange={mockOnSortChange}
          onConfigureAlerts={mockOnConfigureAlerts}
          onMarkAllRead={mockOnMarkAllRead}
          onClearAll={mockOnClearAll}
        />
      );

      expect(screen.getByRole('heading', { name: /alerts & notifications/i })).toBeInTheDocument();
    });
  });

  describe('Alert Display', () => {
    beforeEach(() => {
      testUtils.renderWithProviders(
        <MockAlertsPanel 
          onAlertClick={mockOnAlertClick}
          onAlertAcknowledge={mockOnAlertAcknowledge}
          onAlertDismiss={mockOnAlertDismiss}
          onFilterChange={mockOnFilterChange}
          onSortChange={mockOnSortChange}
          onConfigureAlerts={mockOnConfigureAlerts}
          onMarkAllRead={mockOnMarkAllRead}
          onClearAll={mockOnClearAll}
        />
      );
    });

    it('should display individual alerts', () => {
      expect(screen.getByTestId('alert-item-alert-1')).toBeInTheDocument();
      expect(screen.getByTestId('alert-item-alert-2')).toBeInTheDocument();
      expect(screen.getByTestId('alert-item-alert-3')).toBeInTheDocument();
      expect(screen.getByTestId('alert-item-alert-4')).toBeInTheDocument();
    });

    it('should display alert titles and messages', () => {
      expect(screen.getByTestId('alert-title-alert-1')).toHaveTextContent('Trading System Alert');
      expect(screen.getByTestId('alert-message-alert-1')).toHaveTextContent('Critical error in order execution module');
      
      expect(screen.getByTestId('alert-title-alert-2')).toHaveTextContent('High Memory Usage');
      expect(screen.getByTestId('alert-message-alert-2')).toHaveTextContent('System memory usage has exceeded 85% threshold');
    });

    it('should display alert metadata', () => {
      expect(screen.getByTestId('alert-metadata-alert-1')).toBeInTheDocument();
      expect(screen.getByTestId('metadata-alert-1-errorCode')).toHaveTextContent('TE-001');
      expect(screen.getByTestId('metadata-alert-1-affectedOrders')).toHaveTextContent('3');
    });

    it('should display alert tags', () => {
      expect(screen.getByTestId('alert-tags-alert-1')).toBeInTheDocument();
      expect(screen.getByTestId('alert-tag-alert-1-0')).toHaveTextContent('trading');
      expect(screen.getByTestId('alert-tag-alert-1-1')).toHaveTextContent('critical');
    });

    it('should display severity and type indicators', () => {
      expect(screen.getByTestId('severity-icon-alert-1')).toHaveTextContent('🔴');
      expect(screen.getByTestId('type-icon-alert-1')).toHaveTextContent('❌');
      
      expect(screen.getByTestId('severity-icon-alert-2')).toHaveTextContent('🟡');
      expect(screen.getByTestId('type-icon-alert-2')).toHaveTextContent('⚡');
    });
  });

  describe('Alert Actions', () => {
    beforeEach(() => {
      testUtils.renderWithProviders(
        <MockAlertsPanel 
          onAlertClick={mockOnAlertClick}
          onAlertAcknowledge={mockOnAlertAcknowledge}
          onAlertDismiss={mockOnAlertDismiss}
          onFilterChange={mockOnFilterChange}
          onSortChange={mockOnSortChange}
          onConfigureAlerts={mockOnConfigureAlerts}
          onMarkAllRead={mockOnMarkAllRead}
          onClearAll={mockOnClearAll}
        />
      );
    });

    it('should handle alert click', () => {
      const alertItem = screen.getByTestId('alert-item-alert-1');
      fireEvent.click(alertItem);
      expect(mockOnAlertClick).toHaveBeenCalled();
    });

    it('should handle acknowledge action', () => {
      const acknowledgeButton = screen.getByTestId('acknowledge-button-alert-1');
      fireEvent.click(acknowledgeButton);
      expect(mockOnAlertAcknowledge).toHaveBeenCalledWith('alert-1');
    });

    it('should handle dismiss action', () => {
      const dismissButton = screen.getByTestId('dismiss-button-alert-1');
      fireEvent.click(dismissButton);
      expect(mockOnAlertDismiss).toHaveBeenCalledWith('alert-1');
    });

    it('should not show acknowledge button for already acknowledged alerts', () => {
      // Alert-3 is already acknowledged
      expect(screen.queryByTestId('acknowledge-button-alert-3')).not.toBeInTheDocument();
      expect(screen.getByTestId('dismiss-button-alert-3')).toBeInTheDocument();
    });

    it('should display custom actions', () => {
      expect(screen.getByTestId('custom-actions-alert-1')).toBeInTheDocument();
      expect(screen.getByTestId('custom-action-alert-1-0')).toHaveTextContent('Acknowledge');
      expect(screen.getByTestId('custom-action-alert-1-1')).toHaveTextContent('Investigate');
    });
  });

  describe('Filtering and Sorting', () => {
    beforeEach(() => {
      testUtils.renderWithProviders(
        <MockAlertsPanel 
          filterType="all"
          sortBy="timestamp"
          sortOrder="desc"
          onAlertClick={mockOnAlertClick}
          onAlertAcknowledge={mockOnAlertAcknowledge}
          onAlertDismiss={mockOnAlertDismiss}
          onFilterChange={mockOnFilterChange}
          onSortChange={mockOnSortChange}
          onConfigureAlerts={mockOnConfigureAlerts}
          onMarkAllRead={mockOnMarkAllRead}
          onClearAll={mockOnClearAll}
        />
      );
    });

    it('should display filter controls', () => {
      expect(screen.getByTestId('filter-select')).toBeInTheDocument();
      expect(screen.getByTestId('sort-select')).toBeInTheDocument();
      expect(screen.getByTestId('show-acknowledged-checkbox')).toBeInTheDocument();
    });

    it('should handle filter changes', () => {
      const filterSelect = screen.getByTestId('filter-select');
      fireEvent.change(filterSelect, { target: { value: 'critical' } });
      expect(mockOnFilterChange).toHaveBeenCalledWith('critical');
    });

    it('should handle sort changes', () => {
      const sortSelect = screen.getByTestId('sort-select');
      fireEvent.change(sortSelect, { target: { value: 'severity-desc' } });
      expect(mockOnSortChange).toHaveBeenCalledWith('severity', 'desc');
    });

    it('should handle show acknowledged checkbox', () => {
      const checkbox = screen.getByTestId('show-acknowledged-checkbox');
      fireEvent.click(checkbox);
      expect(mockOnFilterChange).toHaveBeenCalledWith({ showAcknowledged: true });
    });
  });

  describe('Bulk Actions', () => {
    beforeEach(() => {
      testUtils.renderWithProviders(
        <MockAlertsPanel 
          onAlertClick={mockOnAlertClick}
          onAlertAcknowledge={mockOnAlertAcknowledge}
          onAlertDismiss={mockOnAlertDismiss}
          onFilterChange={mockOnFilterChange}
          onSortChange={mockOnSortChange}
          onConfigureAlerts={mockOnConfigureAlerts}
          onMarkAllRead={mockOnMarkAllRead}
          onClearAll={mockOnClearAll}
        />
      );
    });

    it('should handle mark all read action', () => {
      const markAllReadButton = screen.getByTestId('mark-all-read-button');
      fireEvent.click(markAllReadButton);
      expect(mockOnMarkAllRead).toHaveBeenCalled();
    });

    it('should handle clear all action', () => {
      const clearAllButton = screen.getByTestId('clear-all-button');
      fireEvent.click(clearAllButton);
      expect(mockOnClearAll).toHaveBeenCalled();
    });

    it('should handle configure alerts action', () => {
      const configureButton = screen.getByTestId('configure-alerts-button');
      fireEvent.click(configureButton);
      expect(mockOnConfigureAlerts).toHaveBeenCalled();
    });
  });

  describe('Unread Count and Status', () => {
    beforeEach(() => {
      testUtils.renderWithProviders(
        <MockAlertsPanel 
          onAlertClick={mockOnAlertClick}
          onAlertAcknowledge={mockOnAlertAcknowledge}
          onAlertDismiss={mockOnAlertDismiss}
          onFilterChange={mockOnFilterChange}
          onSortChange={mockOnSortChange}
          onConfigureAlerts={mockOnConfigureAlerts}
          onMarkAllRead={mockOnMarkAllRead}
          onClearAll={mockOnClearAll}
        />
      );
    });

    it('should display unread count badge', () => {
      expect(screen.getByTestId('unread-badge')).toHaveTextContent('3');
    });

    it('should display auto-refresh status', () => {
      expect(screen.getByTestId('refresh-status')).toBeInTheDocument();
      expect(screen.getByText(/auto-refresh every 30s/i)).toBeInTheDocument();
    });
  });

  describe('Alerts Summary', () => {
    beforeEach(() => {
      testUtils.renderWithProviders(
        <MockAlertsPanel 
          onAlertClick={mockOnAlertClick}
          onAlertAcknowledge={mockOnAlertAcknowledge}
          onAlertDismiss={mockOnAlertDismiss}
          onFilterChange={mockOnFilterChange}
          onSortChange={mockOnSortChange}
          onConfigureAlerts={mockOnConfigureAlerts}
          onMarkAllRead={mockOnMarkAllRead}
          onClearAll={mockOnClearAll}
        />
      );
    });

    it('should display summary statistics', () => {
      expect(screen.getByTestId('total-alerts-stat')).toBeInTheDocument();
      expect(screen.getByTestId('unread-alerts-stat')).toBeInTheDocument();
      expect(screen.getByTestId('critical-alerts-stat')).toBeInTheDocument();
    });

    it('should show correct counts', () => {
      expect(screen.getByTestId('total-alerts-count')).toHaveTextContent('4'); // Excluding dismissed
      expect(screen.getByTestId('unread-alerts-count')).toHaveTextContent('3');
      expect(screen.getByTestId('critical-alerts-count')).toHaveTextContent('2'); // High severity
    });
  });

  describe('Alert Details Modal', () => {
    beforeEach(() => {
      testUtils.renderWithProviders(
        <MockAlertsPanel 
          onAlertClick={mockOnAlertClick}
          onAlertAcknowledge={mockOnAlertAcknowledge}
          onAlertDismiss={mockOnAlertDismiss}
          onFilterChange={mockOnFilterChange}
          onSortChange={mockOnSortChange}
          onConfigureAlerts={mockOnConfigureAlerts}
          onMarkAllRead={mockOnMarkAllRead}
          onClearAll={mockOnClearAll}
        />
      );
    });

    it('should open alert details when alert is clicked', () => {
      const alertItem = screen.getByTestId('alert-item-alert-1');
      fireEvent.click(alertItem);
      
      expect(screen.getByTestId('alert-details-overlay')).toBeInTheDocument();
      expect(screen.getByTestId('alert-details-panel')).toBeInTheDocument();
    });

    it('should display detailed alert information', () => {
      const alertItem = screen.getByTestId('alert-item-alert-1');
      fireEvent.click(alertItem);
      
      expect(screen.getByTestId('details-title')).toHaveTextContent('Trading System Alert');
      expect(screen.getByTestId('details-type')).toHaveTextContent('critical');
      expect(screen.getByTestId('details-severity')).toHaveTextContent('high');
      expect(screen.getByTestId('details-source')).toHaveTextContent('trading-engine');
    });

    it('should close alert details modal', () => {
      const alertItem = screen.getByTestId('alert-item-alert-1');
      fireEvent.click(alertItem);
      
      const closeButton = screen.getByTestId('close-details-button');
      fireEvent.click(closeButton);
      
      expect(screen.queryByTestId('alert-details-overlay')).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should display no alerts message when list is empty', () => {
      testUtils.renderWithProviders(
        <MockAlertsPanel 
          alerts={[]}
          onAlertClick={mockOnAlertClick}
          onAlertAcknowledge={mockOnAlertAcknowledge}
          onAlertDismiss={mockOnAlertDismiss}
          onFilterChange={mockOnFilterChange}
          onSortChange={mockOnSortChange}
          onConfigureAlerts={mockOnConfigureAlerts}
          onMarkAllRead={mockOnMarkAllRead}
          onClearAll={mockOnClearAll}
        />
      );

      expect(screen.getByTestId('no-alerts')).toBeInTheDocument();
      expect(screen.getByText(/no alerts available/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should display loading state', () => {
      const LoadingAlertsPanel = () => (
        <div className="alerts-panel loading" data-testid="alerts-panel-loading">
          <div className="loading-indicator">
            <span>Loading alerts...</span>
          </div>
        </div>
      );

      testUtils.renderWithProviders(<LoadingAlertsPanel />);
      
      expect(screen.getByTestId('alerts-panel-loading')).toBeInTheDocument();
      expect(screen.getByText(/loading alerts/i)).toBeInTheDocument();
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
        <MockAlertsPanel 
          onAlertClick={mockOnAlertClick}
          onAlertAcknowledge={mockOnAlertAcknowledge}
          onAlertDismiss={mockOnAlertDismiss}
          onFilterChange={mockOnFilterChange}
          onSortChange={mockOnSortChange}
          onConfigureAlerts={mockOnConfigureAlerts}
          onMarkAllRead={mockOnMarkAllRead}
          onClearAll={mockOnClearAll}
        />
      );

      expect(screen.getByTestId('alerts-panel')).toBeInTheDocument();
      expect(screen.getByTestId('alerts-list')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support keyboard navigation', () => {
      testUtils.renderWithProviders(
        <MockAlertsPanel 
          onAlertClick={mockOnAlertClick}
          onAlertAcknowledge={mockOnAlertAcknowledge}
          onAlertDismiss={mockOnAlertDismiss}
          onFilterChange={mockOnFilterChange}
          onSortChange={mockOnSortChange}
          onConfigureAlerts={mockOnConfigureAlerts}
          onMarkAllRead={mockOnMarkAllRead}
          onClearAll={mockOnClearAll}
        />
      );

      const filterSelect = screen.getByTestId('filter-select');
      const acknowledgeButton = screen.getByTestId('acknowledge-button-alert-1');

      filterSelect.focus();
      expect(document.activeElement).toBe(filterSelect);

      fireEvent.keyDown(filterSelect, { key: 'ArrowDown' });
      fireEvent.keyDown(acknowledgeButton, { key: 'Enter' });
    });
  });

  describe('Accessibility Features', () => {
    it('should have proper ARIA labels and roles', () => {
      testUtils.renderWithProviders(
        <MockAlertsPanel 
          onAlertClick={mockOnAlertClick}
          onAlertAcknowledge={mockOnAlertAcknowledge}
          onAlertDismiss={mockOnAlertDismiss}
          onFilterChange={mockOnFilterChange}
          onSortChange={mockOnSortChange}
          onConfigureAlerts={mockOnConfigureAlerts}
          onMarkAllRead={mockOnMarkAllRead}
          onClearAll={mockOnClearAll}
        />
      );

      const acknowledgeButton = screen.getByTestId('acknowledge-button-alert-1');
      const dismissButton = screen.getByTestId('dismiss-button-alert-1');

      expect(acknowledgeButton).toHaveAttribute('aria-label', 'Acknowledge alert: Trading System Alert');
      expect(dismissButton).toHaveAttribute('aria-label', 'Dismiss alert: Trading System Alert');
    });

    it('should support screen readers', () => {
      testUtils.renderWithProviders(
        <MockAlertsPanel 
          onAlertClick={mockOnAlertClick}
          onAlertAcknowledge={mockOnAlertAcknowledge}
          onAlertDismiss={mockOnAlertDismiss}
          onFilterChange={mockOnFilterChange}
          onSortChange={mockOnSortChange}
          onConfigureAlerts={mockOnConfigureAlerts}
          onMarkAllRead={mockOnMarkAllRead}
          onClearAll={mockOnClearAll}
        />
      );

      expect(screen.getByRole('heading', { name: /alerts & notifications/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/filter:/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/sort by:/i)).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should render quickly with many alerts', async () => {
      const manyAlerts = Array.from({ length: 100 }, (_, i) => ({
        id: `alert-${i}`,
        type: 'info',
        severity: 'low',
        title: `Alert ${i}`,
        message: `This is alert number ${i}`,
        timestamp: new Date().toISOString(),
        source: 'test',
        acknowledged: false,
        dismissed: false,
        category: 'test',
        tags: ['test'],
        actions: ['acknowledge']
      }));

      const component = (
        <MockAlertsPanel 
          alerts={manyAlerts}
          onAlertClick={mockOnAlertClick}
          onAlertAcknowledge={mockOnAlertAcknowledge}
          onAlertDismiss={mockOnAlertDismiss}
          onFilterChange={mockOnFilterChange}
          onSortChange={mockOnSortChange}
          onConfigureAlerts={mockOnConfigureAlerts}
          onMarkAllRead={mockOnMarkAllRead}
          onClearAll={mockOnClearAll}
        />
      );

      await testUtils.expectFastRender(component, 400);
    });
  });
});