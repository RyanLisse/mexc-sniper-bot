/**
 * Auto-Sniping Control Panel Component Tests
 * Tests all functionality including status fetching, configuration updates, and user interactions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AutoSnipingControlPanel } from '@/components/auto-sniping-control-panel';
import { renderWithProviders, testUtils } from '@/tests/utils/component-helpers';
import { componentMocks } from '@/tests/fixtures/component-mocks';

// Mock the query keys
vi.mock('@/src/lib/query-client', () => ({
  queryKeys: {
    autoSniping: {
      status: () => ['autoSniping', 'status'],
      config: () => ['autoSniping', 'config'],
    },
  },
}));

// Mock the streamlined components
vi.mock('@/components/streamlined-credential-status', () => ({
  StreamlinedCredentialStatus: ({ variant, autoRefresh }: any) => (
    <div data-testid="credential-status">
      Credential Status - {variant} - {autoRefresh ? 'Auto Refresh' : 'Manual'}
    </div>
  ),
}));

vi.mock('@/components/streamlined-workflow-status', () => ({
  StreamlinedWorkflowStatus: ({ autoRefresh }: any) => (
    <div data-testid="workflow-status">
      Workflow Status - {autoRefresh ? 'Auto Refresh' : 'Manual'}
    </div>
  ),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockSnipingStatus = {
  isActive: false,
  activeTargets: 5,
  readyTargets: 12,
  executedToday: 8,
  successRate: 75.5,
  totalProfit: 150.75,
  lastExecution: '2024-01-01T12:00:00Z',
  safetyStatus: 'safe' as const,
  patternDetectionActive: true,
};

const mockSnipingConfig = {
  enabled: true,
  maxPositionSize: 100,
  takeProfitPercentage: 10,
  stopLossPercentage: 5,
  patternConfidenceThreshold: 75,
  maxConcurrentTrades: 3,
  enableSafetyChecks: true,
  enablePatternDetection: true,
};

describe('AutoSnipingControlPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default successful fetch responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/auto-sniping/status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockSnipingStatus,
          }),
        });
      }
      if (url.includes('/api/auto-sniping/config')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockSnipingConfig,
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: {} }),
      });
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render control panel with loading state', () => {
      renderWithProviders(<AutoSnipingControlPanel />);
      
      expect(screen.getByText('Auto-Sniping Control')).toBeInTheDocument();
      expect(screen.getByText('Loading auto-sniping status...')).toBeInTheDocument();
    });

    it('should render credential and workflow status components', () => {
      renderWithProviders(<AutoSnipingControlPanel />);
      
      expect(screen.getByTestId('credential-status')).toBeInTheDocument();
      expect(screen.getByTestId('workflow-status')).toBeInTheDocument();
    });

    it('should render with custom className', () => {
      const { container } = renderWithProviders(
        <AutoSnipingControlPanel className="custom-class" />
      );
      
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Status Display', () => {
    it('should display status metrics when data is loaded', async () => {
      renderWithProviders(<AutoSnipingControlPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('5')).toBeInTheDocument(); // Active targets
        expect(screen.getByText('12')).toBeInTheDocument(); // Ready targets
        expect(screen.getByText('8')).toBeInTheDocument(); // Executed today
        expect(screen.getByText('75.5%')).toBeInTheDocument(); // Success rate
      });
    });

    it('should display correct status badge when inactive', async () => {
      renderWithProviders(<AutoSnipingControlPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Stopped')).toBeInTheDocument();
      });
    });

    it('should display correct status badge when active', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/auto-sniping/status')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: { ...mockSnipingStatus, isActive: true },
            }),
          });
        }
        if (url.includes('/api/auto-sniping/config')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: mockSnipingConfig,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: {} }),
        });
      });

      renderWithProviders(<AutoSnipingControlPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Active')).toBeInTheDocument();
      });
    });

    it('should display status description correctly', async () => {
      renderWithProviders(<AutoSnipingControlPanel />);
      
      await waitFor(() => {
        expect(screen.getByText(/5 active • 12 ready • 8 trades today/)).toBeInTheDocument();
      });
    });
  });

  describe('Safety Status', () => {
    it('should display safe status correctly', async () => {
      renderWithProviders(<AutoSnipingControlPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Safety Status: Safe')).toBeInTheDocument();
      });
    });

    it('should display warning status correctly', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/auto-sniping/status')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: { ...mockSnipingStatus, safetyStatus: 'warning' },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockSnipingConfig }),
        });
      });

      renderWithProviders(<AutoSnipingControlPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Safety Status: Warning')).toBeInTheDocument();
      });
    });

    it('should display critical status correctly', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/auto-sniping/status')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: { ...mockSnipingStatus, safetyStatus: 'critical' },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockSnipingConfig }),
        });
      });

      renderWithProviders(<AutoSnipingControlPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Safety Status: Critical')).toBeInTheDocument();
      });
    });

    it('should display emergency status correctly', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/auto-sniping/status')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: { ...mockSnipingStatus, safetyStatus: 'emergency' },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockSnipingConfig }),
        });
      });

      renderWithProviders(<AutoSnipingControlPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Safety Status: Emergency')).toBeInTheDocument();
      });
    });
  });

  describe('Control Actions', () => {
    it('should show Start Sniping button when inactive', async () => {
      renderWithProviders(<AutoSnipingControlPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Start Sniping')).toBeInTheDocument();
      });
    });

    it('should show Stop Sniping button when active', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/auto-sniping/status')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: { ...mockSnipingStatus, isActive: true },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockSnipingConfig }),
        });
      });

      renderWithProviders(<AutoSnipingControlPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Stop Sniping')).toBeInTheDocument();
      });
    });

    it('should handle start sniping action', async () => {
      let controlCallMade = false;
      mockFetch.mockImplementation((url: string, options?: any) => {
        if (url.includes('/api/auto-sniping/control') && options?.method === 'POST') {
          controlCallMade = true;
          const body = JSON.parse(options.body);
          expect(body.action).toBe('start');
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: {} }),
          });
        }
        if (url.includes('/api/auto-sniping/status')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: mockSnipingStatus,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockSnipingConfig }),
        });
      });

      renderWithProviders(<AutoSnipingControlPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Start Sniping')).toBeInTheDocument();
      });

      const startButton = screen.getByText('Start Sniping');
      fireEvent.click(startButton);
      
      await waitFor(() => {
        expect(controlCallMade).toBe(true);
      });
    });

    it('should handle stop sniping action', async () => {
      let controlCallMade = false;
      mockFetch.mockImplementation((url: string, options?: any) => {
        if (url.includes('/api/auto-sniping/control') && options?.method === 'POST') {
          controlCallMade = true;
          const body = JSON.parse(options.body);
          expect(body.action).toBe('stop');
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: {} }),
          });
        }
        if (url.includes('/api/auto-sniping/status')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: { ...mockSnipingStatus, isActive: true },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockSnipingConfig }),
        });
      });

      renderWithProviders(<AutoSnipingControlPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Stop Sniping')).toBeInTheDocument();
      });

      const stopButton = screen.getByText('Stop Sniping');
      fireEvent.click(stopButton);
      
      await waitFor(() => {
        expect(controlCallMade).toBe(true);
      });
    });

    it('should handle refresh action', async () => {
      renderWithProviders(<AutoSnipingControlPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Start Sniping')).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);
      
      // Should trigger another status fetch
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/auto-sniping/status');
      });
    });
  });

  describe('Configuration Settings', () => {
    it('should display configuration switches', async () => {
      renderWithProviders(<AutoSnipingControlPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Safety Checks')).toBeInTheDocument();
        expect(screen.getByText('Pattern Detection')).toBeInTheDocument();
      });
    });

    it('should show advanced configuration when toggled', async () => {
      renderWithProviders(<AutoSnipingControlPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Show Advanced')).toBeInTheDocument();
      });

      const showAdvancedButton = screen.getByText('Show Advanced');
      fireEvent.click(showAdvancedButton);
      
      await waitFor(() => {
        expect(screen.getByText('Hide Advanced')).toBeInTheDocument();
        expect(screen.getByText('Take Profit %')).toBeInTheDocument();
        expect(screen.getByText('Stop Loss %')).toBeInTheDocument();
        expect(screen.getByText('Confidence Threshold')).toBeInTheDocument();
        expect(screen.getByText('Max Concurrent')).toBeInTheDocument();
      });
    });

    it('should display configuration values correctly', async () => {
      renderWithProviders(<AutoSnipingControlPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Show Advanced')).toBeInTheDocument();
      });

      const showAdvancedButton = screen.getByText('Show Advanced');
      fireEvent.click(showAdvancedButton);
      
      await waitFor(() => {
        expect(screen.getByText('10%')).toBeInTheDocument(); // Take profit
        expect(screen.getByText('5%')).toBeInTheDocument(); // Stop loss
        expect(screen.getByText('75%')).toBeInTheDocument(); // Confidence threshold
        expect(screen.getByText('3')).toBeInTheDocument(); // Max concurrent
      });
    });

    it('should handle safety checks toggle', async () => {
      let configUpdateMade = false;
      mockFetch.mockImplementation((url: string, options?: any) => {
        if (url.includes('/api/auto-sniping/config') && options?.method === 'POST') {
          configUpdateMade = true;
          const body = JSON.parse(options.body);
          expect(body.enableSafetyChecks).toBeDefined();
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: {} }),
          });
        }
        if (url.includes('/api/auto-sniping/status')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: mockSnipingStatus,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockSnipingConfig }),
        });
      });

      renderWithProviders(<AutoSnipingControlPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Safety Checks')).toBeInTheDocument();
      });

      const safetyCheckSwitch = screen.getByLabelText('Safety Checks');
      fireEvent.click(safetyCheckSwitch);
      
      await waitFor(() => {
        expect(configUpdateMade).toBe(true);
      });
    });

    it('should handle pattern detection toggle', async () => {
      let configUpdateMade = false;
      mockFetch.mockImplementation((url: string, options?: any) => {
        if (url.includes('/api/auto-sniping/config') && options?.method === 'POST') {
          configUpdateMade = true;
          const body = JSON.parse(options.body);
          expect(body.enablePatternDetection).toBeDefined();
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: {} }),
          });
        }
        if (url.includes('/api/auto-sniping/status')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: mockSnipingStatus,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockSnipingConfig }),
        });
      });

      renderWithProviders(<AutoSnipingControlPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Pattern Detection')).toBeInTheDocument();
      });

      const patternDetectionSwitch = screen.getByLabelText('Pattern Detection');
      fireEvent.click(patternDetectionSwitch);
      
      await waitFor(() => {
        expect(configUpdateMade).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error when status fetch fails', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/auto-sniping/status')) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({
              success: false,
              error: 'Failed to fetch status',
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockSnipingConfig }),
        });
      });

      renderWithProviders(<AutoSnipingControlPanel />);
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to load auto-sniping status/)).toBeInTheDocument();
      });
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/auto-sniping/status')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockSnipingConfig }),
        });
      });

      renderWithProviders(<AutoSnipingControlPanel />);
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to load auto-sniping status/)).toBeInTheDocument();
      });
    });

    it('should handle invalid response data', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/auto-sniping/status')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: { invalid: 'data' }, // Invalid schema
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockSnipingConfig }),
        });
      });

      renderWithProviders(<AutoSnipingControlPanel />);
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to load auto-sniping status/)).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state for status', () => {
      // Mock fetch to never resolve
      mockFetch.mockImplementation(() => new Promise(() => {}));

      renderWithProviders(<AutoSnipingControlPanel />);
      
      expect(screen.getByText('Loading auto-sniping status...')).toBeInTheDocument();
    });

    it('should disable buttons during mutations', async () => {
      // Mock successful initial load
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/auto-sniping/status')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: mockSnipingStatus,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockSnipingConfig }),
        });
      });

      renderWithProviders(<AutoSnipingControlPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Start Sniping')).toBeInTheDocument();
      });

      // Mock control endpoint to be slow
      mockFetch.mockImplementation((url: string, options?: any) => {
        if (url.includes('/api/auto-sniping/control')) {
          return new Promise(() => {}); // Never resolves
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: {} }),
        });
      });

      const startButton = screen.getByText('Start Sniping');
      fireEvent.click(startButton);
      
      await waitFor(() => {
        expect(startButton).toBeDisabled();
      });
    });
  });

  describe('Status Descriptions', () => {
    it('should show correct description when inactive', async () => {
      renderWithProviders(<AutoSnipingControlPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Ready to start monitoring patterns and executing trades')).toBeInTheDocument();
      });
    });

    it('should show correct description when active', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/auto-sniping/status')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: { ...mockSnipingStatus, isActive: true },
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockSnipingConfig }),
        });
      });

      renderWithProviders(<AutoSnipingControlPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Actively monitoring for sniping opportunities')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', async () => {
      renderWithProviders(<AutoSnipingControlPanel />);
      
      await waitFor(() => {
        expect(screen.getByLabelText('Safety Checks')).toBeInTheDocument();
        expect(screen.getByLabelText('Pattern Detection')).toBeInTheDocument();
      });
    });

    it('should be keyboard accessible', async () => {
      renderWithProviders(<AutoSnipingControlPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Start Sniping')).toBeInTheDocument();
      });

      const startButton = screen.getByText('Start Sniping');
      startButton.focus();
      expect(startButton).toHaveFocus();
    });
  });
});