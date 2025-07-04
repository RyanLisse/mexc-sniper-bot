/**
 * Metric Card Component Tests
 * Tests metric display, trends, changes, and visual states
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricCard } from '@/components/dashboard/metric-card';

describe('MetricCard Component', () => {
  describe('Basic Rendering', () => {
    it('should render metric card with title and value', () => {
      render(<MetricCard title="Total Trades" value={150} />);
      
      expect(screen.getByText('Total Trades')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument();
    });

    it('should render with string value', () => {
      render(<MetricCard title="Success Rate" value="85.5%" />);
      
      expect(screen.getByText('Success Rate')).toBeInTheDocument();
      expect(screen.getByText('85.5%')).toBeInTheDocument();
    });

    it('should render with custom className', () => {
      const { container } = render(
        <MetricCard title="Test" value={100} className="custom-metric-card" />
      );
      
      expect(container.firstChild).toHaveClass('custom-metric-card');
    });

    it('should render description when provided', () => {
      render(
        <MetricCard 
          title="Portfolio Value" 
          value="$10,000" 
          description="Total value of all positions"
        />
      );
      
      expect(screen.getByText('Total value of all positions')).toBeInTheDocument();
    });
  });

  describe('Change Indicators', () => {
    it('should display positive change with green color and up arrow', () => {
      render(<MetricCard title="Profit" value="$500" change={15.5} />);
      
      const changeElement = screen.getByText('+15.5%');
      expect(changeElement).toBeInTheDocument();
      expect(changeElement.parentElement).toHaveClass('text-green-600');
      
      // Check for up arrow icon (aria-hidden svg)
      const upArrow = changeElement.parentElement?.querySelector('svg');
      expect(upArrow).toBeInTheDocument();
    });

    it('should display negative change with red color and down arrow', () => {
      render(<MetricCard title="Loss" value="$200" change={-8.2} />);
      
      const changeElement = screen.getByText('-8.2%');
      expect(changeElement).toBeInTheDocument();
      expect(changeElement.parentElement).toHaveClass('text-red-600');
      
      // Check for down arrow icon
      const downArrow = changeElement.parentElement?.querySelector('svg');
      expect(downArrow).toBeInTheDocument();
    });

    it('should display zero change with neutral color', () => {
      render(<MetricCard title="Stable" value="$1000" change={0} />);
      
      const changeElement = screen.getByText('0%');
      expect(changeElement).toBeInTheDocument();
      expect(changeElement.parentElement).toHaveClass('text-muted-foreground');
    });

    it('should not display change when not provided', () => {
      render(<MetricCard title="Test" value={100} />);
      
      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    });

    it('should handle undefined change correctly', () => {
      render(<MetricCard title="Test" value={100} change={undefined} />);
      
      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    });
  });

  describe('Trend Indicators', () => {
    it('should display trending up icon with up trend', () => {
      render(
        <MetricCard 
          title="Growth" 
          value={100} 
          trend="up" 
          changeLabel="Growing trend"
        />
      );
      
      expect(screen.getByText('Growing trend')).toBeInTheDocument();
      
      // Check for trending up icon
      const trendingUpIcon = screen.getByText('Growing trend').parentElement?.querySelector('svg');
      expect(trendingUpIcon).toBeInTheDocument();
    });

    it('should display trending down icon with down trend', () => {
      render(
        <MetricCard 
          title="Decline" 
          value={100} 
          trend="down" 
          changeLabel="Declining trend"
        />
      );
      
      expect(screen.getByText('Declining trend')).toBeInTheDocument();
      
      // Check for trending down icon
      const trendingDownIcon = screen.getByText('Declining trend').parentElement?.querySelector('svg');
      expect(trendingDownIcon).toBeInTheDocument();
    });

    it('should not display trend icon with neutral trend', () => {
      render(
        <MetricCard 
          title="Stable" 
          value={100} 
          trend="neutral" 
          changeLabel="Stable trend"
        />
      );
      
      expect(screen.getByText('Stable trend')).toBeInTheDocument();
      
      // Should not have trending icons with neutral trend
      const changeLabel = screen.getByText('Stable trend');
      const trendIcons = changeLabel.parentElement?.querySelectorAll('svg');
      expect(trendIcons).toHaveLength(0);
    });

    it('should not display change label when not provided', () => {
      render(<MetricCard title="Test" value={100} trend="up" />);
      
      // No trending icon should be displayed without changeLabel
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('should handle default neutral trend', () => {
      render(<MetricCard title="Test" value={100} changeLabel="Some label" />);
      
      expect(screen.getByText('Some label')).toBeInTheDocument();
      
      // Should not have trending icons with default neutral trend
      const changeLabel = screen.getByText('Some label');
      const trendIcons = changeLabel.parentElement?.querySelectorAll('svg');
      expect(trendIcons).toHaveLength(0);
    });
  });

  describe('Complex Scenarios', () => {
    it('should display all elements when all props are provided', () => {
      render(
        <MetricCard 
          title="Complete Metric"
          value="$1,500"
          change={12.5}
          changeLabel="Last 30 days"
          description="Total portfolio value"
          trend="up"
          className="test-class"
        />
      );
      
      expect(screen.getByText('Complete Metric')).toBeInTheDocument();
      expect(screen.getByText('$1,500')).toBeInTheDocument();
      expect(screen.getByText('+12.5%')).toBeInTheDocument();
      expect(screen.getByText('Last 30 days')).toBeInTheDocument();
      expect(screen.getByText('Total portfolio value')).toBeInTheDocument();
    });

    it('should handle large numbers correctly', () => {
      render(<MetricCard title="Large Number" value={1234567890} />);
      
      expect(screen.getByText('1234567890')).toBeInTheDocument();
    });

    it('should handle very small numbers correctly', () => {
      render(<MetricCard title="Small Number" value={0.0001} />);
      
      expect(screen.getByText('0.0001')).toBeInTheDocument();
    });

    it('should handle formatted currency strings', () => {
      render(<MetricCard title="Currency" value="$1,234.56" />);
      
      expect(screen.getByText('$1,234.56')).toBeInTheDocument();
    });

    it('should handle percentage strings', () => {
      render(<MetricCard title="Percentage" value="85.5%" />);
      
      expect(screen.getByText('85.5%')).toBeInTheDocument();
    });

    it('should handle special characters in values', () => {
      render(<MetricCard title="Special" value="€1,000.00" />);
      
      expect(screen.getByText('€1,000.00')).toBeInTheDocument();
    });
  });

  describe('Change Calculation Logic', () => {
    it('should correctly identify positive changes', () => {
      render(<MetricCard title="Positive" value={100} change={0.1} />);
      
      const changeElement = screen.getByText('+0.1%');
      expect(changeElement.parentElement).toHaveClass('text-green-600');
    });

    it('should correctly identify negative changes', () => {
      render(<MetricCard title="Negative" value={100} change={-0.1} />);
      
      const changeElement = screen.getByText('-0.1%');
      expect(changeElement.parentElement).toHaveClass('text-red-600');
    });

    it('should handle very large positive changes', () => {
      render(<MetricCard title="Huge Gain" value={100} change={999.99} />);
      
      const changeElement = screen.getByText('+999.99%');
      expect(changeElement.parentElement).toHaveClass('text-green-600');
    });

    it('should handle very large negative changes', () => {
      render(<MetricCard title="Huge Loss" value={100} change={-999.99} />);
      
      const changeElement = screen.getByText('-999.99%');
      expect(changeElement.parentElement).toHaveClass('text-red-600');
    });
  });

  describe('Visual Structure', () => {
    it('should have proper card structure', () => {
      render(<MetricCard title="Structure Test" value={100} />);
      
      // Check for card components
      expect(screen.getByText('Structure Test').closest('[role="img"], .card, [class*="card"]')).toBeInTheDocument();
    });

    it('should have proper text sizing', () => {
      render(<MetricCard title="Sizing Test" value="$100" />);
      
      const valueElement = screen.getByText('$100');
      expect(valueElement).toHaveClass('text-2xl', 'font-bold');
    });

    it('should have proper text coloring for description', () => {
      render(
        <MetricCard 
          title="Color Test" 
          value={100} 
          description="Test description"
        />
      );
      
      const descriptionElement = screen.getByText('Test description');
      expect(descriptionElement).toHaveClass('text-muted-foreground');
    });

    it('should have proper header layout', () => {
      render(<MetricCard title="Layout Test" value={100} change={5} />);
      
      const title = screen.getByText('Layout Test');
      const change = screen.getByText('+5%');
      
      // Both should be in the header area
      expect(title.parentElement).toContainElement(change);
    });
  });

  describe('Accessibility', () => {
    it('should have semantic structure', () => {
      render(<MetricCard title="Accessibility Test" value={100} />);
      
      const title = screen.getByText('Accessibility Test');
      const value = screen.getByText('100');
      
      expect(title).toBeInTheDocument();
      expect(value).toBeInTheDocument();
    });

    it('should handle screen reader friendly content', () => {
      render(
        <MetricCard 
          title="Screen Reader Test"
          value="$1,000"
          change={5.5}
          description="Monthly revenue"
        />
      );
      
      // All text content should be accessible to screen readers
      expect(screen.getByText('Screen Reader Test')).toBeInTheDocument();
      expect(screen.getByText('$1,000')).toBeInTheDocument();
      expect(screen.getByText('+5.5%')).toBeInTheDocument();
      expect(screen.getByText('Monthly revenue')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string values', () => {
      render(<MetricCard title="Empty" value="" />);
      
      expect(screen.getByText('Empty')).toBeInTheDocument();
      // Value element should exist even if empty
      const valueElements = screen.getAllByText('');
      expect(valueElements.length).toBeGreaterThan(0);
    });

    it('should handle zero values', () => {
      render(<MetricCard title="Zero" value={0} />);
      
      expect(screen.getByText('Zero')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should handle null values gracefully', () => {
      render(<MetricCard title="Null Test" value={null as any} />);
      
      expect(screen.getByText('Null Test')).toBeInTheDocument();
      // Should render null as empty or string
      expect(screen.getByText('Null Test').parentElement).toBeInTheDocument();
    });

    it('should handle undefined values gracefully', () => {
      render(<MetricCard title="Undefined Test" value={undefined as any} />);
      
      expect(screen.getByText('Undefined Test')).toBeInTheDocument();
    });

    it('should handle very long titles', () => {
      const longTitle = 'Very Long Title That Should Still Render Properly In The Card Component';
      render(<MetricCard title={longTitle} value={100} />);
      
      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    it('should handle very long descriptions', () => {
      const longDescription = 'This is a very long description that should wrap properly and not break the card layout even when it contains a lot of text that exceeds normal expectations.';
      render(
        <MetricCard 
          title="Long Description" 
          value={100} 
          description={longDescription}
        />
      );
      
      expect(screen.getByText(longDescription)).toBeInTheDocument();
    });
  });

  describe('Default Export', () => {
    it('should have default export available for dynamic loading', () => {
      // This test ensures the default export exists for dynamic imports
      const { default: DefaultMetricCard } = require('@/src/components/dashboard/metric-card');
      expect(DefaultMetricCard).toBe(MetricCard);
    });
  });
});