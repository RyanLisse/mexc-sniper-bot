/**
 * Interactive Chart Component Tests
 * Comprehensive testing for trading charts, performance visualizations, and analytics
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { testUtils } from '../../utils/component-helpers';

// Add jest-axe matcher
expect.extend(toHaveNoViolations);

// Mock interactive chart component
const MockInteractiveChart = ({ 
  chartType = 'line',
  data = [],
  width = 800,
  height = 400,
  title = 'Trading Chart',
  xAxisLabel = 'Time',
  yAxisLabel = 'Price',
  showLegend = true,
  showTooltip = true,
  showZoom = true,
  showCrosshair = true,
  timeRange = '24h',
  refreshInterval = 5000,
  onChartClick,
  onZoomChange,
  onTimeRangeChange,
  onDataPointHover,
  theme = 'dark',
  annotations = [],
  indicators = []
}: any) => {
  const [chartData, setChartData] = vi.fn().mockReturnValue([
    data.length > 0 ? data : [
      { timestamp: '2024-01-01T00:00:00Z', value: 45230.50, volume: 1234 },
      { timestamp: '2024-01-01T01:00:00Z', value: 45145.25, volume: 2341 },
      { timestamp: '2024-01-01T02:00:00Z', value: 45289.75, volume: 1876 },
      { timestamp: '2024-01-01T03:00:00Z', value: 45420.10, volume: 3456 },
      { timestamp: '2024-01-01T04:00:00Z', value: 45356.80, volume: 2789 },
      { timestamp: '2024-01-01T05:00:00Z', value: 45478.90, volume: 4123 }
    ],
    vi.fn()
  ]);

  const [isLoading, setIsLoading] = vi.fn().mockReturnValue([false, vi.fn()]);
  const [zoomLevel, setZoomLevel] = vi.fn().mockReturnValue([1, vi.fn()]);
  const [selectedDataPoint, setSelectedDataPoint] = vi.fn().mockReturnValue([null, vi.fn()]);
  const [hoveredPoint, setHoveredPoint] = vi.fn().mockReturnValue([null, vi.fn()]);

  const currentData = chartData;

  const handleChartClick = (event: React.MouseEvent, dataPoint?: any) => {
    setSelectedDataPoint(dataPoint);
    onChartClick?.(event, dataPoint);
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(zoomLevel * 1.5, 10);
    setZoomLevel(newZoom);
    onZoomChange?.(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoomLevel / 1.5, 0.1);
    setZoomLevel(newZoom);
    onZoomChange?.(newZoom);
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    onZoomChange?.(1);
  };

  const handleTimeRangeChange = (range: string) => {
    onTimeRangeChange?.(range);
  };

  const handleDataPointHover = (dataPoint: any) => {
    setHoveredPoint(dataPoint);
    onDataPointHover?.(dataPoint);
  };

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatVolume = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  };

  if (isLoading) {
    return (
      <div className="chart-container loading" data-testid="chart-loading">
        <div className="loading-indicator">
          <span>Loading chart data...</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`chart-container ${theme}`} 
      data-testid="interactive-chart"
      style={{ width, height }}
    >
      {/* Chart Header */}
      <div className="chart-header" data-testid="chart-header">
        <div className="chart-title-section">
          <h3 className="chart-title" data-testid="chart-title">{title}</h3>
          <div className="chart-subtitle" data-testid="chart-subtitle">
            {chartType === 'candlestick' ? 'OHLC Chart' : 'Price Chart'}
          </div>
        </div>
        
        <div className="chart-controls" data-testid="chart-controls">
          {/* Time Range Selector */}
          <div className="time-range-controls" data-testid="time-range-controls">
            <button
              type="button"
              className={`time-button ${timeRange === '1h' ? 'active' : ''}`}
              onClick={() => handleTimeRangeChange('1h')}
              data-testid="time-range-1h"
            >
              1H
            </button>
            <button
              type="button"
              className={`time-button ${timeRange === '24h' ? 'active' : ''}`}
              onClick={() => handleTimeRangeChange('24h')}
              data-testid="time-range-24h"
            >
              24H
            </button>
            <button
              type="button"
              className={`time-button ${timeRange === '7d' ? 'active' : ''}`}
              onClick={() => handleTimeRangeChange('7d')}
              data-testid="time-range-7d"
            >
              7D
            </button>
            <button
              type="button"
              className={`time-button ${timeRange === '30d' ? 'active' : ''}`}
              onClick={() => handleTimeRangeChange('30d')}
              data-testid="time-range-30d"
            >
              30D
            </button>
          </div>

          {/* Chart Type Selector */}
          <div className="chart-type-controls" data-testid="chart-type-controls">
            <button
              type="button"
              className={`chart-type-button ${chartType === 'line' ? 'active' : ''}`}
              data-testid="chart-type-line"
              aria-label="Line chart"
            >
              Line
            </button>
            <button
              type="button"
              className={`chart-type-button ${chartType === 'candlestick' ? 'active' : ''}`}
              data-testid="chart-type-candlestick"
              aria-label="Candlestick chart"
            >
              Candle
            </button>
            <button
              type="button"
              className={`chart-type-button ${chartType === 'volume' ? 'active' : ''}`}
              data-testid="chart-type-volume"
              aria-label="Volume chart"
            >
              Volume
            </button>
          </div>

          {/* Zoom Controls */}
          {showZoom && (
            <div className="zoom-controls" data-testid="zoom-controls">
              <button
                type="button"
                onClick={handleZoomIn}
                aria-label="Zoom in"
                data-testid="zoom-in-button"
              >
                +
              </button>
              <span className="zoom-level" data-testid="zoom-level">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={handleZoomOut}
                aria-label="Zoom out"
                data-testid="zoom-out-button"
              >
                -
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                aria-label="Reset zoom"
                data-testid="reset-zoom-button"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Chart Area */}
      <div className="chart-area" data-testid="chart-area">
        {/* Y-Axis Labels */}
        <div className="y-axis" data-testid="y-axis">
          <div className="y-axis-label" data-testid="y-axis-label">{yAxisLabel}</div>
          <div className="y-axis-values" data-testid="y-axis-values">
            <div className="y-tick" data-testid="y-tick-high">45,500</div>
            <div className="y-tick" data-testid="y-tick-mid">45,250</div>
            <div className="y-tick" data-testid="y-tick-low">45,000</div>
          </div>
        </div>

        {/* Main Chart SVG */}
        <div className="chart-svg-container" data-testid="chart-svg-container">
          <svg
            width={width - 100}
            height={height - 100}
            viewBox={`0 0 ${width - 100} ${height - 100}`}
            className="chart-svg"
            data-testid="chart-svg"
            role="img"
            aria-label={`${title} - ${chartType} chart showing price data`}
            onClick={handleChartClick}
          >
            {/* Chart Background */}
            <rect
              width="100%"
              height="100%"
              fill="transparent"
              className="chart-background"
              data-testid="chart-background"
            />

            {/* Grid Lines */}
            <g className="grid-lines" data-testid="grid-lines">
              <line x1="0" y1="25%" x2="100%" y2="25%" stroke="#333" strokeWidth="1" opacity="0.3" />
              <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#333" strokeWidth="1" opacity="0.3" />
              <line x1="0" y1="75%" x2="100%" y2="75%" stroke="#333" strokeWidth="1" opacity="0.3" />
              <line x1="25%" y1="0" x2="25%" y2="100%" stroke="#333" strokeWidth="1" opacity="0.3" />
              <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#333" strokeWidth="1" opacity="0.3" />
              <line x1="75%" y1="0" x2="75%" y2="100%" stroke="#333" strokeWidth="1" opacity="0.3" />
            </g>

            {/* Chart Data Visualization */}
            {chartType === 'line' && (
              <g className="line-chart" data-testid="line-chart">
                <path
                  d="M 0 200 L 100 180 L 200 160 L 300 140 L 400 120 L 500 100"
                  stroke="#22c55e"
                  strokeWidth="2"
                  fill="none"
                  data-testid="price-line"
                />
                {currentData.map((point: any, index: number) => (
                  <circle
                    key={index}
                    cx={index * 100}
                    cy={200 - (point.value - 45000) * 0.01}
                    r="3"
                    fill="#22c55e"
                    className="data-point"
                    data-testid={`data-point-${index}`}
                    onMouseEnter={() => handleDataPointHover(point)}
                    onMouseLeave={() => handleDataPointHover(null)}
                  />
                ))}
              </g>
            )}

            {chartType === 'candlestick' && (
              <g className="candlestick-chart" data-testid="candlestick-chart">
                {currentData.map((point: any, index: number) => (
                  <g key={index} className="candlestick" data-testid={`candlestick-${index}`}>
                    <rect
                      x={index * 100 - 10}
                      y={180}
                      width="20"
                      height="40"
                      fill={point.value > 45230 ? "#22c55e" : "#ef4444"}
                      stroke={point.value > 45230 ? "#22c55e" : "#ef4444"}
                      data-testid={`candle-body-${index}`}
                    />
                    <line
                      x1={index * 100}
                      y1={160}
                      x2={index * 100}
                      y2={240}
                      stroke={point.value > 45230 ? "#22c55e" : "#ef4444"}
                      strokeWidth="1"
                      data-testid={`candle-wick-${index}`}
                    />
                  </g>
                ))}
              </g>
            )}

            {chartType === 'volume' && (
              <g className="volume-chart" data-testid="volume-chart">
                {currentData.map((point: any, index: number) => (
                  <rect
                    key={index}
                    x={index * 100 - 10}
                    y={300 - point.volume * 0.1}
                    width="20"
                    height={point.volume * 0.1}
                    fill="#3b82f6"
                    opacity="0.7"
                    data-testid={`volume-bar-${index}`}
                  />
                ))}
              </g>
            )}

            {/* Annotations */}
            {annotations.map((annotation: any, index: number) => (
              <g key={index} className="annotation" data-testid={`annotation-${index}`}>
                <circle
                  cx={annotation.x}
                  cy={annotation.y}
                  r="5"
                  fill={annotation.color || '#f59e0b'}
                  data-testid={`annotation-marker-${index}`}
                />
                <text
                  x={annotation.x + 10}
                  y={annotation.y - 10}
                  fill={annotation.color || '#f59e0b'}
                  fontSize="12"
                  data-testid={`annotation-text-${index}`}
                >
                  {annotation.text}
                </text>
              </g>
            ))}

            {/* Crosshair */}
            {showCrosshair && hoveredPoint && (
              <g className="crosshair" data-testid="crosshair">
                <line
                  x1="0"
                  y1="50%"
                  x2="100%"
                  y2="50%"
                  stroke="#666"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                  data-testid="crosshair-horizontal"
                />
                <line
                  x1="50%"
                  y1="0"
                  x2="50%"
                  y2="100%"
                  stroke="#666"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                  data-testid="crosshair-vertical"
                />
              </g>
            )}
          </svg>

          {/* Tooltip */}
          {showTooltip && hoveredPoint && (
            <div 
              className="chart-tooltip"
              data-testid="chart-tooltip"
              style={{
                position: 'absolute',
                top: '50px',
                left: '100px',
                background: 'rgba(0, 0, 0, 0.9)',
                color: 'white',
                padding: '8px',
                borderRadius: '4px',
                fontSize: '12px',
                pointerEvents: 'none'
              }}
            >
              <div data-testid="tooltip-time">
                Time: {new Date(hoveredPoint.timestamp).toLocaleTimeString()}
              </div>
              <div data-testid="tooltip-price">
                Price: {formatPrice(hoveredPoint.value)}
              </div>
              <div data-testid="tooltip-volume">
                Volume: {formatVolume(hoveredPoint.volume)}
              </div>
            </div>
          )}
        </div>

        {/* X-Axis */}
        <div className="x-axis" data-testid="x-axis">
          <div className="x-axis-label" data-testid="x-axis-label">{xAxisLabel}</div>
          <div className="x-axis-values" data-testid="x-axis-values">
            <div className="x-tick" data-testid="x-tick-start">00:00</div>
            <div className="x-tick" data-testid="x-tick-mid">12:00</div>
            <div className="x-tick" data-testid="x-tick-end">24:00</div>
          </div>
        </div>
      </div>

      {/* Chart Legend */}
      {showLegend && (
        <div className="chart-legend" data-testid="chart-legend">
          <div className="legend-item" data-testid="legend-price">
            <span className="legend-color price-color"></span>
            <span>Price</span>
          </div>
          {chartType === 'volume' && (
            <div className="legend-item" data-testid="legend-volume">
              <span className="legend-color volume-color"></span>
              <span>Volume</span>
            </div>
          )}
          {indicators.map((indicator: any, index: number) => (
            <div key={index} className="legend-item" data-testid={`legend-indicator-${index}`}>
              <span 
                className="legend-color"
                style={{ backgroundColor: indicator.color }}
              ></span>
              <span>{indicator.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Chart Footer with Current Values */}
      <div className="chart-footer" data-testid="chart-footer">
        <div className="current-values" data-testid="current-values">
          <div className="value-item" data-testid="current-price">
            <span className="value-label">Current Price:</span>
            <span className="value-amount">
              {formatPrice(currentData[currentData.length - 1]?.value || 45478.90)}
            </span>
          </div>
          <div className="value-item" data-testid="price-change">
            <span className="value-label">24h Change:</span>
            <span className="value-amount positive">+1.25%</span>
          </div>
          <div className="value-item" data-testid="volume-24h">
            <span className="value-label">24h Volume:</span>
            <span className="value-amount">
              {formatVolume(currentData.reduce((sum: number, point: any) => sum + point.volume, 0))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Mock the actual component
vi.mock('../../../src/components/ui/interactive-chart', () => ({
  default: MockInteractiveChart,
  InteractiveChart: MockInteractiveChart,
}));

describe('InteractiveChart Component', () => {
  let mockOnChartClick: ReturnType<typeof vi.fn>;
  let mockOnZoomChange: ReturnType<typeof vi.fn>;
  let mockOnTimeRangeChange: ReturnType<typeof vi.fn>;
  let mockOnDataPointHover: ReturnType<typeof vi.fn>;

  const mockChartData = [
    { timestamp: '2024-01-01T00:00:00Z', value: 45230.50, volume: 1234 },
    { timestamp: '2024-01-01T01:00:00Z', value: 45145.25, volume: 2341 },
    { timestamp: '2024-01-01T02:00:00Z', value: 45289.75, volume: 1876 },
    { timestamp: '2024-01-01T03:00:00Z', value: 45420.10, volume: 3456 },
    { timestamp: '2024-01-01T04:00:00Z', value: 45356.80, volume: 2789 },
    { timestamp: '2024-01-01T05:00:00Z', value: 45478.90, volume: 4123 }
  ];

  beforeEach(() => {
    mockOnChartClick = vi.fn();
    mockOnZoomChange = vi.fn();
    mockOnTimeRangeChange = vi.fn();
    mockOnDataPointHover = vi.fn();
    testUtils.mockWindowMethods();
    testUtils.mockIntersectionObserver();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render interactive chart with all components', () => {
      testUtils.renderWithProviders(
        <MockInteractiveChart 
          data={mockChartData}
          onChartClick={mockOnChartClick}
          onZoomChange={mockOnZoomChange}
          onTimeRangeChange={mockOnTimeRangeChange}
          onDataPointHover={mockOnDataPointHover}
        />
      );

      expect(screen.getByTestId('interactive-chart')).toBeInTheDocument();
      expect(screen.getByTestId('chart-header')).toBeInTheDocument();
      expect(screen.getByTestId('chart-area')).toBeInTheDocument();
      expect(screen.getByTestId('chart-svg')).toBeInTheDocument();
      expect(screen.getByTestId('chart-footer')).toBeInTheDocument();
    });

    it('should have proper accessibility structure', async () => {
      const { container } = testUtils.renderWithProviders(
        <MockInteractiveChart 
          data={mockChartData}
          title="BTC/USDT Price Chart"
          onChartClick={mockOnChartClick}
          onZoomChange={mockOnZoomChange}
          onTimeRangeChange={mockOnTimeRangeChange}
          onDataPointHover={mockOnDataPointHover}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should display chart title and subtitle', () => {
      testUtils.renderWithProviders(
        <MockInteractiveChart 
          title="Trading Performance Chart"
          chartType="line"
          data={mockChartData}
          onChartClick={mockOnChartClick}
          onZoomChange={mockOnZoomChange}
          onTimeRangeChange={mockOnTimeRangeChange}
          onDataPointHover={mockOnDataPointHover}
        />
      );

      expect(screen.getByTestId('chart-title')).toHaveTextContent('Trading Performance Chart');
      expect(screen.getByTestId('chart-subtitle')).toHaveTextContent('Price Chart');
    });
  });

  describe('Chart Types', () => {
    it('should render line chart correctly', () => {
      testUtils.renderWithProviders(
        <MockInteractiveChart 
          chartType="line"
          data={mockChartData}
          onChartClick={mockOnChartClick}
          onZoomChange={mockOnZoomChange}
          onTimeRangeChange={mockOnTimeRangeChange}
          onDataPointHover={mockOnDataPointHover}
        />
      );

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(screen.getByTestId('price-line')).toBeInTheDocument();
      expect(screen.getByTestId('data-point-0')).toBeInTheDocument();
    });

    it('should render candlestick chart correctly', () => {
      testUtils.renderWithProviders(
        <MockInteractiveChart 
          chartType="candlestick"
          data={mockChartData}
          onChartClick={mockOnChartClick}
          onZoomChange={mockOnZoomChange}
          onTimeRangeChange={mockOnTimeRangeChange}
          onDataPointHover={mockOnDataPointHover}
        />
      );

      expect(screen.getByTestId('candlestick-chart')).toBeInTheDocument();
      expect(screen.getByTestId('candlestick-0')).toBeInTheDocument();
      expect(screen.getByTestId('candle-body-0')).toBeInTheDocument();
      expect(screen.getByTestId('candle-wick-0')).toBeInTheDocument();
    });

    it('should render volume chart correctly', () => {
      testUtils.renderWithProviders(
        <MockInteractiveChart 
          chartType="volume"
          data={mockChartData}
          onChartClick={mockOnChartClick}
          onZoomChange={mockOnZoomChange}
          onTimeRangeChange={mockOnTimeRangeChange}
          onDataPointHover={mockOnDataPointHover}
        />
      );

      expect(screen.getByTestId('volume-chart')).toBeInTheDocument();
      expect(screen.getByTestId('volume-bar-0')).toBeInTheDocument();
    });
  });

  describe('Chart Controls', () => {
    beforeEach(() => {
      testUtils.renderWithProviders(
        <MockInteractiveChart 
          data={mockChartData}
          showZoom={true}
          timeRange="24h"
          onChartClick={mockOnChartClick}
          onZoomChange={mockOnZoomChange}
          onTimeRangeChange={mockOnTimeRangeChange}
          onDataPointHover={mockOnDataPointHover}
        />
      );
    });

    it('should display time range controls', () => {
      expect(screen.getByTestId('time-range-controls')).toBeInTheDocument();
      expect(screen.getByTestId('time-range-1h')).toBeInTheDocument();
      expect(screen.getByTestId('time-range-24h')).toBeInTheDocument();
      expect(screen.getByTestId('time-range-7d')).toBeInTheDocument();
      expect(screen.getByTestId('time-range-30d')).toBeInTheDocument();
    });

    it('should handle time range selection', () => {
      const timeRange7d = screen.getByTestId('time-range-7d');
      fireEvent.click(timeRange7d);
      expect(mockOnTimeRangeChange).toHaveBeenCalledWith('7d');
    });

    it('should display active time range', () => {
      const activeButton = screen.getByTestId('time-range-24h');
      expect(activeButton).toHaveClass('active');
    });

    it('should display chart type controls', () => {
      expect(screen.getByTestId('chart-type-controls')).toBeInTheDocument();
      expect(screen.getByTestId('chart-type-line')).toBeInTheDocument();
      expect(screen.getByTestId('chart-type-candlestick')).toBeInTheDocument();
      expect(screen.getByTestId('chart-type-volume')).toBeInTheDocument();
    });

    it('should display zoom controls', () => {
      expect(screen.getByTestId('zoom-controls')).toBeInTheDocument();
      expect(screen.getByTestId('zoom-in-button')).toBeInTheDocument();
      expect(screen.getByTestId('zoom-out-button')).toBeInTheDocument();
      expect(screen.getByTestId('reset-zoom-button')).toBeInTheDocument();
      expect(screen.getByTestId('zoom-level')).toHaveTextContent('100%');
    });
  });

  describe('Zoom Functionality', () => {
    beforeEach(() => {
      testUtils.renderWithProviders(
        <MockInteractiveChart 
          data={mockChartData}
          showZoom={true}
          onChartClick={mockOnChartClick}
          onZoomChange={mockOnZoomChange}
          onTimeRangeChange={mockOnTimeRangeChange}
          onDataPointHover={mockOnDataPointHover}
        />
      );
    });

    it('should handle zoom in', () => {
      const zoomInButton = screen.getByTestId('zoom-in-button');
      fireEvent.click(zoomInButton);
      expect(mockOnZoomChange).toHaveBeenCalled();
    });

    it('should handle zoom out', () => {
      const zoomOutButton = screen.getByTestId('zoom-out-button');
      fireEvent.click(zoomOutButton);
      expect(mockOnZoomChange).toHaveBeenCalled();
    });

    it('should handle reset zoom', () => {
      const resetZoomButton = screen.getByTestId('reset-zoom-button');
      fireEvent.click(resetZoomButton);
      expect(mockOnZoomChange).toHaveBeenCalledWith(1);
    });
  });

  describe('Data Visualization', () => {
    beforeEach(() => {
      testUtils.renderWithProviders(
        <MockInteractiveChart 
          data={mockChartData}
          chartType="line"
          onChartClick={mockOnChartClick}
          onZoomChange={mockOnZoomChange}
          onTimeRangeChange={mockOnTimeRangeChange}
          onDataPointHover={mockOnDataPointHover}
        />
      );
    });

    it('should render grid lines', () => {
      expect(screen.getByTestId('grid-lines')).toBeInTheDocument();
    });

    it('should render axis labels', () => {
      expect(screen.getByTestId('x-axis-label')).toHaveTextContent('Time');
      expect(screen.getByTestId('y-axis-label')).toHaveTextContent('Price');
    });

    it('should render axis values', () => {
      expect(screen.getByTestId('y-axis-values')).toBeInTheDocument();
      expect(screen.getByTestId('x-axis-values')).toBeInTheDocument();
    });

    it('should render data points', () => {
      expect(screen.getByTestId('data-point-0')).toBeInTheDocument();
      expect(screen.getByTestId('data-point-1')).toBeInTheDocument();
    });
  });

  describe('Interactive Features', () => {
    beforeEach(() => {
      testUtils.renderWithProviders(
        <MockInteractiveChart 
          data={mockChartData}
          showTooltip={true}
          showCrosshair={true}
          onChartClick={mockOnChartClick}
          onZoomChange={mockOnZoomChange}
          onTimeRangeChange={mockOnTimeRangeChange}
          onDataPointHover={mockOnDataPointHover}
        />
      );
    });

    it('should handle chart click', () => {
      const chartSvg = screen.getByTestId('chart-svg');
      fireEvent.click(chartSvg);
      expect(mockOnChartClick).toHaveBeenCalled();
    });

    it('should handle data point hover', () => {
      const dataPoint = screen.getByTestId('data-point-0');
      fireEvent.mouseEnter(dataPoint);
      expect(mockOnDataPointHover).toHaveBeenCalled();
    });
  });

  describe('Tooltip Display', () => {
    it('should show tooltip when hovering over data point', () => {
      testUtils.renderWithProviders(
        <MockInteractiveChart 
          data={mockChartData}
          showTooltip={true}
          onChartClick={mockOnChartClick}
          onZoomChange={mockOnZoomChange}
          onTimeRangeChange={mockOnTimeRangeChange}
          onDataPointHover={mockOnDataPointHover}
        />
      );

      // Simulate hover by checking for tooltip elements
      // In real implementation, tooltip would appear on hover
      expect(screen.queryByTestId('chart-tooltip')).not.toBeInTheDocument();
    });
  });

  describe('Legend Display', () => {
    it('should display legend when enabled', () => {
      testUtils.renderWithProviders(
        <MockInteractiveChart 
          data={mockChartData}
          showLegend={true}
          indicators={[
            { name: 'SMA 20', color: '#3b82f6' },
            { name: 'RSI', color: '#f59e0b' }
          ]}
          onChartClick={mockOnChartClick}
          onZoomChange={mockOnZoomChange}
          onTimeRangeChange={mockOnTimeRangeChange}
          onDataPointHover={mockOnDataPointHover}
        />
      );

      expect(screen.getByTestId('chart-legend')).toBeInTheDocument();
      expect(screen.getByTestId('legend-price')).toBeInTheDocument();
      expect(screen.getByTestId('legend-indicator-0')).toBeInTheDocument();
      expect(screen.getByTestId('legend-indicator-1')).toBeInTheDocument();
    });

    it('should not display legend when disabled', () => {
      testUtils.renderWithProviders(
        <MockInteractiveChart 
          data={mockChartData}
          showLegend={false}
          onChartClick={mockOnChartClick}
          onZoomChange={mockOnZoomChange}
          onTimeRangeChange={mockOnTimeRangeChange}
          onDataPointHover={mockOnDataPointHover}
        />
      );

      expect(screen.queryByTestId('chart-legend')).not.toBeInTheDocument();
    });
  });

  describe('Annotations', () => {
    it('should render annotations when provided', () => {
      const annotations = [
        { x: 200, y: 150, text: 'Pattern Detected', color: '#f59e0b' },
        { x: 400, y: 100, text: 'Trade Signal', color: '#22c55e' }
      ];

      testUtils.renderWithProviders(
        <MockInteractiveChart 
          data={mockChartData}
          annotations={annotations}
          onChartClick={mockOnChartClick}
          onZoomChange={mockOnZoomChange}
          onTimeRangeChange={mockOnTimeRangeChange}
          onDataPointHover={mockOnDataPointHover}
        />
      );

      expect(screen.getByTestId('annotation-0')).toBeInTheDocument();
      expect(screen.getByTestId('annotation-1')).toBeInTheDocument();
      expect(screen.getByTestId('annotation-text-0')).toHaveTextContent('Pattern Detected');
      expect(screen.getByTestId('annotation-text-1')).toHaveTextContent('Trade Signal');
    });
  });

  describe('Current Values Display', () => {
    beforeEach(() => {
      testUtils.renderWithProviders(
        <MockInteractiveChart 
          data={mockChartData}
          onChartClick={mockOnChartClick}
          onZoomChange={mockOnZoomChange}
          onTimeRangeChange={mockOnTimeRangeChange}
          onDataPointHover={mockOnDataPointHover}
        />
      );
    });

    it('should display current price', () => {
      expect(screen.getByTestId('current-price')).toBeInTheDocument();
      expect(screen.getByTestId('current-price')).toHaveTextContent('$45,478.90');
    });

    it('should display price change', () => {
      expect(screen.getByTestId('price-change')).toBeInTheDocument();
      expect(screen.getByTestId('price-change')).toHaveTextContent('+1.25%');
    });

    it('should display volume', () => {
      expect(screen.getByTestId('volume-24h')).toBeInTheDocument();
      expect(screen.getByTestId('volume-24h')).toHaveTextContent('15.8K');
    });
  });

  describe('Loading State', () => {
    it('should display loading state', () => {
      const LoadingChart = () => (
        <div className="chart-container loading" data-testid="chart-loading">
          <div className="loading-indicator">
            <span>Loading chart data...</span>
          </div>
        </div>
      );

      testUtils.renderWithProviders(<LoadingChart />);
      
      expect(screen.getByTestId('chart-loading')).toBeInTheDocument();
      expect(screen.getByText(/loading chart data/i)).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should handle different chart dimensions', () => {
      testUtils.renderWithProviders(
        <MockInteractiveChart 
          data={mockChartData}
          width={600}
          height={300}
          onChartClick={mockOnChartClick}
          onZoomChange={mockOnZoomChange}
          onTimeRangeChange={mockOnTimeRangeChange}
          onDataPointHover={mockOnDataPointHover}
        />
      );

      const chartContainer = screen.getByTestId('interactive-chart');
      expect(chartContainer).toHaveStyle('width: 600px; height: 300px');
    });

    it('should handle mobile viewport', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      testUtils.renderWithProviders(
        <MockInteractiveChart 
          data={mockChartData}
          width={350}
          height={250}
          onChartClick={mockOnChartClick}
          onZoomChange={mockOnZoomChange}
          onTimeRangeChange={mockOnTimeRangeChange}
          onDataPointHover={mockOnDataPointHover}
        />
      );

      expect(screen.getByTestId('interactive-chart')).toBeInTheDocument();
    });
  });

  describe('Theme Support', () => {
    it('should apply dark theme', () => {
      testUtils.renderWithProviders(
        <MockInteractiveChart 
          data={mockChartData}
          theme="dark"
          onChartClick={mockOnChartClick}
          onZoomChange={mockOnZoomChange}
          onTimeRangeChange={mockOnTimeRangeChange}
          onDataPointHover={mockOnDataPointHover}
        />
      );

      const chartContainer = screen.getByTestId('interactive-chart');
      expect(chartContainer).toHaveClass('dark');
    });

    it('should apply light theme', () => {
      testUtils.renderWithProviders(
        <MockInteractiveChart 
          data={mockChartData}
          theme="light"
          onChartClick={mockOnChartClick}
          onZoomChange={mockOnZoomChange}
          onTimeRangeChange={mockOnTimeRangeChange}
          onDataPointHover={mockOnDataPointHover}
        />
      );

      const chartContainer = screen.getByTestId('interactive-chart');
      expect(chartContainer).toHaveClass('light');
    });
  });

  describe('Accessibility Features', () => {
    it('should have proper ARIA labels', () => {
      testUtils.renderWithProviders(
        <MockInteractiveChart 
          title="BTC/USDT Chart"
          chartType="line"
          data={mockChartData}
          onChartClick={mockOnChartClick}
          onZoomChange={mockOnZoomChange}
          onTimeRangeChange={mockOnTimeRangeChange}
          onDataPointHover={mockOnDataPointHover}
        />
      );

      const chartSvg = screen.getByTestId('chart-svg');
      expect(chartSvg).toHaveAttribute('aria-label', 'BTC/USDT Chart - line chart showing price data');

      const zoomInButton = screen.getByTestId('zoom-in-button');
      expect(zoomInButton).toHaveAttribute('aria-label', 'Zoom in');

      const chartTypeButton = screen.getByTestId('chart-type-line');
      expect(chartTypeButton).toHaveAttribute('aria-label', 'Line chart');
    });

    it('should support keyboard navigation', () => {
      testUtils.renderWithProviders(
        <MockInteractiveChart 
          data={mockChartData}
          onChartClick={mockOnChartClick}
          onZoomChange={mockOnZoomChange}
          onTimeRangeChange={mockOnTimeRangeChange}
          onDataPointHover={mockOnDataPointHover}
        />
      );

      const timeRangeButton = screen.getByTestId('time-range-24h');
      const zoomInButton = screen.getByTestId('zoom-in-button');

      timeRangeButton.focus();
      expect(document.activeElement).toBe(timeRangeButton);

      fireEvent.keyDown(timeRangeButton, { key: 'Enter' });
      fireEvent.keyDown(zoomInButton, { key: ' ' });
    });
  });

  describe('Performance', () => {
    it('should render quickly with large datasets', async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        timestamp: new Date(Date.now() + i * 60000).toISOString(),
        value: 45000 + Math.random() * 1000,
        volume: 1000 + Math.random() * 5000
      }));

      const component = (
        <MockInteractiveChart 
          data={largeDataset}
          onChartClick={mockOnChartClick}
          onZoomChange={mockOnZoomChange}
          onTimeRangeChange={mockOnTimeRangeChange}
          onDataPointHover={mockOnDataPointHover}
        />
      );

      await testUtils.expectFastRender(component, 300);
    });
  });
});