/**
 * Unit Tests for RateLimitNotice Component
 * 
 * Tests the rate limit notice component UI behavior and interactions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RateLimitNotice } from '../../../src/components/auth/rate-limit-notice';
import { rateLimitScenarios } from '../../utils/rate-limit-test-helpers';

// Mock the UI components
vi.mock('../../../src/components/ui/alert', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div data-testid="alert">{children}</div>,
  AlertDescription: ({ children }: { children: React.ReactNode }) => <div data-testid="alert-description">{children}</div>,
  AlertTitle: ({ children }: { children: React.ReactNode }) => <div data-testid="alert-title">{children}</div>,
}));

vi.mock('../../../src/components/ui/button', () => ({
  Button: ({ children, onClick, variant, className, ...props }: any) => (
    <button 
      onClick={onClick} 
      className={className}
      data-variant={variant}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('../../../src/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div data-testid="card-title">{children}</div>,
}));

vi.mock('../../../src/components/ui/progress', () => ({
  Progress: ({ value, className }: { value: number; className?: string }) => (
    <div data-testid="progress" data-value={value} className={className} />
  ),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  AlertTriangle: ({ className }: { className?: string }) => <div data-testid="alert-triangle-icon" className={className} />,
  Clock: ({ className }: { className?: string }) => <div data-testid="clock-icon" className={className} />,
  Mail: ({ className }: { className?: string }) => <div data-testid="mail-icon" className={className} />,
  RefreshCw: ({ className }: { className?: string }) => <div data-testid="refresh-icon" className={className} />,
}));

describe('RateLimitNotice', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.useRealTimers();
  });

  describe('Component Rendering', () => {
    it('should render basic rate limit notice', () => {
      const rateLimitInfo = {
        isRateLimited: true,
        limitType: 'email' as const,
        message: 'Email rate limit exceeded. Only 2 emails per hour are allowed.',
        suggestion: 'Try using magic link sign-in or contact support.'
      };

      render(<RateLimitNotice rateLimitInfo={rateLimitInfo} />);

      expect(screen.getByTestId('card')).toBeInTheDocument();
      expect(screen.getByTestId('card-title')).toHaveTextContent('Rate Limit Exceeded');
      expect(screen.getByTestId('alert-description')).toHaveTextContent('Email rate limit exceeded. Only 2 emails per hour are allowed.');
      expect(screen.getByText('Try using magic link sign-in or contact support.')).toBeInTheDocument();
    });

    it('should show appropriate icon for different limit types', () => {
      const testCases = [
        { limitType: 'email', expectedIcon: 'mail-icon' },
        { limitType: 'mfa', expectedIcon: 'alert-triangle-icon' },
        { limitType: 'otp', expectedIcon: 'clock-icon' },
      ];

      testCases.forEach(({ limitType, expectedIcon }) => {
        const rateLimitInfo = {
          isRateLimited: true,
          limitType: limitType as any,
          message: `${limitType} rate limit exceeded`
        };

        const { unmount } = render(<RateLimitNotice rateLimitInfo={rateLimitInfo} />);
        
        expect(screen.getByTestId(expectedIcon)).toBeInTheDocument();
        
        unmount();
      });
    });

    it('should display suggestion when provided', () => {
      const rateLimitInfo = {
        isRateLimited: true,
        limitType: 'email' as const,
        message: 'Email rate limit exceeded',
        suggestion: 'Try using magic link sign-in'
      };

      render(<RateLimitNotice rateLimitInfo={rateLimitInfo} />);

      expect(screen.getByText('Try using magic link sign-in')).toBeInTheDocument();
    });

    it('should not display suggestion when not provided', () => {
      const rateLimitInfo = {
        isRateLimited: true,
        limitType: 'email' as const,
        message: 'Email rate limit exceeded'
      };

      render(<RateLimitNotice rateLimitInfo={rateLimitInfo} />);

      expect(screen.queryByText('Suggestion:')).not.toBeInTheDocument();
    });
  });

  describe('Countdown Timer', () => {
    it('should display countdown timer when retryAfter is provided', () => {
      const rateLimitInfo = {
        isRateLimited: true,
        limitType: 'email' as const,
        message: 'Email rate limit exceeded',
        retryAfter: 300 // 5 minutes
      };

      render(<RateLimitNotice rateLimitInfo={rateLimitInfo} />);

      expect(screen.getByText('Time remaining:')).toBeInTheDocument();
      expect(screen.getByText('5 minutes')).toBeInTheDocument();
      expect(screen.getByTestId('progress')).toBeInTheDocument();
    });

    it('should update countdown timer every second', async () => {
      const rateLimitInfo = {
        isRateLimited: true,
        limitType: 'email' as const,
        message: 'Email rate limit exceeded',
        retryAfter: 5
      };

      render(<RateLimitNotice rateLimitInfo={rateLimitInfo} />);

      expect(screen.getByText('5 seconds')).toBeInTheDocument();

      // Advance timer by 1 second
      vi.advanceTimersByTime(1000);
      
      await waitFor(() => {
        expect(screen.getByText('4 seconds')).toBeInTheDocument();
      });

      // Advance timer by 3 more seconds
      vi.advanceTimersByTime(3000);
      
      await waitFor(() => {
        expect(screen.getByText('1 seconds')).toBeInTheDocument();
      });
    });

    it('should enable retry button when countdown reaches zero', async () => {
      const mockOnRetry = vi.fn();
      const rateLimitInfo = {
        isRateLimited: true,
        limitType: 'otp' as const,
        message: 'OTP rate limit exceeded',
        retryAfter: 2
      };

      render(<RateLimitNotice rateLimitInfo={rateLimitInfo} onRetry={mockOnRetry} />);

      // Initially no retry button should be visible
      expect(screen.queryByText('Try Again')).not.toBeInTheDocument();

      // Advance timer to completion
      vi.advanceTimersByTime(2000);
      
      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });

      // Test retry button functionality
      fireEvent.click(screen.getByText('Try Again'));
      expect(mockOnRetry).toHaveBeenCalledOnce();
    });

    it('should update progress bar correctly', async () => {
      const rateLimitInfo = {
        isRateLimited: true,
        limitType: 'email' as const,
        message: 'Email rate limit exceeded',
        retryAfter: 10
      };

      render(<RateLimitNotice rateLimitInfo={rateLimitInfo} />);

      const progress = screen.getByTestId('progress');
      expect(progress).toHaveAttribute('data-value', '0');

      // Advance timer by 5 seconds (50% progress)
      vi.advanceTimersByTime(5000);
      
      await waitFor(() => {
        expect(progress).toHaveAttribute('data-value', '50');
      });
    });
  });

  describe('Development Mode Features', () => {
    it('should show bypass button in development mode for email rate limits', () => {
      process.env.NODE_ENV = 'development';
      
      const mockOnBypassEmail = vi.fn();
      const rateLimitInfo = {
        isRateLimited: true,
        limitType: 'email' as const,
        message: 'Email rate limit exceeded'
      };

      render(
        <RateLimitNotice 
          rateLimitInfo={rateLimitInfo} 
          onBypassEmail={mockOnBypassEmail}
          userEmail="test@example.com"
        />
      );

      expect(screen.getByText('Bypass Email Confirmation (Dev Only)')).toBeInTheDocument();
      expect(screen.getByText('Development Mode:')).toBeInTheDocument();
    });

    it('should not show bypass button in production mode', () => {
      process.env.NODE_ENV = 'production';
      
      const mockOnBypassEmail = vi.fn();
      const rateLimitInfo = {
        isRateLimited: true,
        limitType: 'email' as const,
        message: 'Email rate limit exceeded'
      };

      render(
        <RateLimitNotice 
          rateLimitInfo={rateLimitInfo} 
          onBypassEmail={mockOnBypassEmail}
          userEmail="test@example.com"
        />
      );

      expect(screen.queryByText('Bypass Email Confirmation (Dev Only)')).not.toBeInTheDocument();
      expect(screen.queryByText('Development Mode:')).not.toBeInTheDocument();
    });

    it('should not show bypass button for non-email rate limits', () => {
      process.env.NODE_ENV = 'development';
      
      const mockOnBypassEmail = vi.fn();
      const rateLimitInfo = {
        isRateLimited: true,
        limitType: 'otp' as const,
        message: 'OTP rate limit exceeded'
      };

      render(
        <RateLimitNotice 
          rateLimitInfo={rateLimitInfo} 
          onBypassEmail={mockOnBypassEmail}
          userEmail="test@example.com"
        />
      );

      expect(screen.queryByText('Bypass Email Confirmation (Dev Only)')).not.toBeInTheDocument();
    });

    it('should call onBypassEmail when bypass button is clicked', () => {
      process.env.NODE_ENV = 'development';
      
      const mockOnBypassEmail = vi.fn();
      const rateLimitInfo = {
        isRateLimited: true,
        limitType: 'email' as const,
        message: 'Email rate limit exceeded'
      };
      const userEmail = 'test@example.com';

      render(
        <RateLimitNotice 
          rateLimitInfo={rateLimitInfo} 
          onBypassEmail={mockOnBypassEmail}
          userEmail={userEmail}
        />
      );

      fireEvent.click(screen.getByText('Bypass Email Confirmation (Dev Only)'));
      expect(mockOnBypassEmail).toHaveBeenCalledWith(userEmail);
    });
  });

  describe('Rate Limit Information Display', () => {
    it('should display limit type and environment information', () => {
      process.env.NODE_ENV = 'test';
      
      const rateLimitInfo = {
        isRateLimited: true,
        limitType: 'email' as const,
        message: 'Email rate limit exceeded'
      };

      render(<RateLimitNotice rateLimitInfo={rateLimitInfo} />);

      expect(screen.getByText('email')).toBeInTheDocument();
      expect(screen.getByText('test')).toBeInTheDocument();
    });

    it('should show Supabase email limit warning for email rate limits', () => {
      const rateLimitInfo = {
        isRateLimited: true,
        limitType: 'email' as const,
        message: 'Email rate limit exceeded'
      };

      render(<RateLimitNotice rateLimitInfo={rateLimitInfo} />);

      expect(screen.getByText('⚠️ Supabase allows only 2 emails per hour without custom SMTP')).toBeInTheDocument();
    });

    it('should not show Supabase warning for non-email rate limits', () => {
      const rateLimitInfo = {
        isRateLimited: true,
        limitType: 'otp' as const,
        message: 'OTP rate limit exceeded'
      };

      render(<RateLimitNotice rateLimitInfo={rateLimitInfo} />);

      expect(screen.queryByText('⚠️ Supabase allows only 2 emails per hour without custom SMTP')).not.toBeInTheDocument();
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle email rate limit scenario from test helpers', () => {
      const scenario = rateLimitScenarios.emailRateLimit;
      const rateLimitInfo = {
        isRateLimited: true,
        limitType: 'email' as const,
        message: 'Email rate limit exceeded. Only 2 emails per hour are allowed.',
        retryAfter: 1800,
        suggestion: 'Try using magic link sign-in or contact support if you need immediate access.'
      };

      render(<RateLimitNotice rateLimitInfo={rateLimitInfo} />);

      expect(screen.getByText('Email rate limit exceeded. Only 2 emails per hour are allowed.')).toBeInTheDocument();
      expect(screen.getByText('Try using magic link sign-in or contact support if you need immediate access.')).toBeInTheDocument();
      expect(screen.getByText('30 minutes')).toBeInTheDocument();
    });

    it('should handle OTP rate limit scenario from test helpers', () => {
      const rateLimitInfo = {
        isRateLimited: true,
        limitType: 'otp' as const,
        message: 'OTP rate limit exceeded. Too many verification codes requested.',
        retryAfter: 300,
        suggestion: 'Wait before requesting another verification code, or try alternative verification methods.'
      };

      render(<RateLimitNotice rateLimitInfo={rateLimitInfo} />);

      expect(screen.getByText('OTP rate limit exceeded. Too many verification codes requested.')).toBeInTheDocument();
      expect(screen.getByText('Wait before requesting another verification code, or try alternative verification methods.')).toBeInTheDocument();
      expect(screen.getByText('5 minutes')).toBeInTheDocument();
    });

    it('should handle MFA rate limit scenario from test helpers', () => {
      const rateLimitInfo = {
        isRateLimited: true,
        limitType: 'mfa' as const,
        message: 'MFA rate limit exceeded. Please wait before trying again.',
        retryAfter: 60,
        suggestion: 'Wait before attempting multi-factor authentication again.'
      };

      render(<RateLimitNotice rateLimitInfo={rateLimitInfo} />);

      expect(screen.getByText('MFA rate limit exceeded. Please wait before trying again.')).toBeInTheDocument();
      expect(screen.getByText('Wait before attempting multi-factor authentication again.')).toBeInTheDocument();
      expect(screen.getByText('1 minute')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rate limit info without retryAfter', () => {
      const rateLimitInfo = {
        isRateLimited: true,
        limitType: 'email' as const,
        message: 'Email rate limit exceeded'
      };

      render(<RateLimitNotice rateLimitInfo={rateLimitInfo} />);

      expect(screen.queryByText('Time remaining:')).not.toBeInTheDocument();
      expect(screen.queryByTestId('progress')).not.toBeInTheDocument();
    });

    it('should handle unknown limit type', () => {
      const rateLimitInfo = {
        isRateLimited: true,
        limitType: undefined,
        message: 'Unknown rate limit exceeded'
      };

      render(<RateLimitNotice rateLimitInfo={rateLimitInfo} />);

      expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('should handle missing callbacks gracefully', () => {
      const rateLimitInfo = {
        isRateLimited: true,
        limitType: 'otp' as const,
        message: 'OTP rate limit exceeded',
        retryAfter: 1
      };

      render(<RateLimitNotice rateLimitInfo={rateLimitInfo} />);

      // Advance timer to enable retry
      vi.advanceTimersByTime(1000);
      
      // Should not show retry button when no onRetry callback
      expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
    });
  });
});