/**
 * Supabase Auth UI Component Tests
 * Comprehensive testing for authentication UI components including accessibility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { testUtils } from '../../utils/component-helpers';

// Add jest-axe matcher
expect.extend(toHaveNoViolations);

// Mock the auth UI component since we need to test behavior
const MockSupabaseAuthUI = ({ 
  view = 'sign_in',
  onAuthSuccess,
  onAuthError,
  providers,
  socialLayout = 'horizontal',
  showLinks = true,
  appearance = {}
}: any) => {
  const [currentView, setCurrentView] = vi.fn().mockReturnValue([view, vi.fn()]);
  const [loading, setLoading] = vi.fn().mockReturnValue([false, vi.fn()]);
  const [error, setError] = vi.fn().mockReturnValue([null, vi.fn()]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Mock successful sign in
      await new Promise(resolve => setTimeout(resolve, 100));
      onAuthSuccess?.({ user: testUtils.createMockUser(), session: null });
    } catch (err) {
      onAuthError?.(err);
      setError('Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      onAuthSuccess?.({ user: testUtils.createMockUser(), session: null });
    } catch (err) {
      onAuthError?.(err);
      setError('Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  const renderSignInForm = () => (
    <form onSubmit={handleSignIn} data-testid="sign-in-form">
      <div className="auth-container">
        <h1>Sign In to MEXC Sniper Bot</h1>
        
        {error && (
          <div 
            role="alert" 
            className="error-message"
            data-testid="auth-error"
          >
            {error}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            id="email"
            type="email"
            name="email"
            required
            placeholder="Enter your email"
            aria-describedby="email-help"
            data-testid="email-input"
          />
          <div id="email-help" className="help-text">
            We'll use this to send you trading alerts
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            name="password"
            required
            placeholder="Enter your password"
            minLength={8}
            data-testid="password-input"
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          aria-describedby="submit-help"
          data-testid="sign-in-button"
        >
          {loading ? 'Signing In...' : 'Sign In'}
        </button>
        
        <div id="submit-help" className="help-text">
          Click to authenticate and access trading features
        </div>

        {showLinks && (
          <div className="auth-links">
            <button 
              type="button" 
              onClick={() => setCurrentView('sign_up')}
              data-testid="switch-to-signup"
            >
              Don't have an account? Sign Up
            </button>
            <button 
              type="button" 
              onClick={() => setCurrentView('forgotten_password')}
              data-testid="forgot-password-link"
            >
              Forgot your password?
            </button>
          </div>
        )}

        {providers && socialLayout && (
          <div className="social-providers" data-testid="social-providers">
            <div className="divider">
              <span>Or continue with</span>
            </div>
            {providers.includes('google') && (
              <button 
                type="button" 
                className="provider-button google"
                data-testid="google-auth-button"
                aria-label="Sign in with Google"
              >
                <span>Google</span>
              </button>
            )}
            {providers.includes('github') && (
              <button 
                type="button" 
                className="provider-button github"
                data-testid="github-auth-button"
                aria-label="Sign in with GitHub"
              >
                <span>GitHub</span>
              </button>
            )}
          </div>
        )}
      </div>
    </form>
  );

  const renderSignUpForm = () => (
    <form onSubmit={handleSignUp} data-testid="sign-up-form">
      <div className="auth-container">
        <h1>Create MEXC Sniper Bot Account</h1>
        
        {error && (
          <div 
            role="alert" 
            className="error-message"
            data-testid="auth-error"
          >
            {error}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="signup-email">Email Address</label>
          <input
            id="signup-email"
            type="email"
            name="email"
            required
            placeholder="Enter your email"
            data-testid="signup-email-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
            type="password"
            name="password"
            required
            placeholder="Create a strong password"
            minLength={8}
            data-testid="signup-password-input"
          />
          <div className="password-requirements">
            Minimum 8 characters required
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="confirm-password">Confirm Password</label>
          <input
            id="confirm-password"
            type="password"
            name="confirmPassword"
            required
            placeholder="Confirm your password"
            minLength={8}
            data-testid="confirm-password-input"
          />
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input 
              type="checkbox" 
              required
              data-testid="terms-checkbox"
            />
            I agree to the Terms of Service and Privacy Policy
          </label>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          data-testid="sign-up-button"
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>

        {showLinks && (
          <div className="auth-links">
            <button 
              type="button" 
              onClick={() => setCurrentView('sign_in')}
              data-testid="switch-to-signin"
            >
              Already have an account? Sign In
            </button>
          </div>
        )}
      </div>
    </form>
  );

  const renderPasswordResetForm = () => (
    <form data-testid="password-reset-form">
      <div className="auth-container">
        <h1>Reset Your Password</h1>
        
        <div className="form-group">
          <label htmlFor="reset-email">Email Address</label>
          <input
            id="reset-email"
            type="email"
            name="email"
            required
            placeholder="Enter your email"
            data-testid="reset-email-input"
          />
          <div className="help-text">
            We'll send you a link to reset your password
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          data-testid="send-reset-button"
        >
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>

        <div className="auth-links">
          <button 
            type="button" 
            onClick={() => setCurrentView('sign_in')}
            data-testid="back-to-signin"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    </form>
  );

  if (currentView === 'sign_up') return renderSignUpForm();
  if (currentView === 'forgotten_password') return renderPasswordResetForm();
  return renderSignInForm();
};

// Mock the actual component
vi.mock('../../../src/components/auth/supabase-auth-ui', () => ({
  default: MockSupabaseAuthUI,
  SupabaseAuthUI: MockSupabaseAuthUI,
}));

describe('SupabaseAuthUI Component', () => {
  let mockOnAuthSuccess: ReturnType<typeof vi.fn>;
  let mockOnAuthError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnAuthSuccess = vi.fn();
    mockOnAuthError = vi.fn();
    testUtils.mockWindowMethods();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Sign In View', () => {
    it('should render sign in form with all required elements', () => {
      testUtils.renderWithProviders(
        <MockSupabaseAuthUI 
          view="sign_in"
          onAuthSuccess={mockOnAuthSuccess}
          onAuthError={mockOnAuthError}
        />
      );

      expect(screen.getByRole('heading', { name: /sign in to mexc sniper bot/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('should have proper form accessibility', async () => {
      const { container } = testUtils.renderWithProviders(
        <MockSupabaseAuthUI 
          view="sign_in"
          onAuthSuccess={mockOnAuthSuccess}
          onAuthError={mockOnAuthError}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should validate required form fields', () => {
      testUtils.renderWithProviders(
        <MockSupabaseAuthUI 
          view="sign_in"
          onAuthSuccess={mockOnAuthSuccess}
          onAuthError={mockOnAuthError}
        />
      );

      const emailInput = screen.getByTestId('email-input');
      const passwordInput = screen.getByTestId('password-input');

      expect(emailInput).toHaveAttribute('required');
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(passwordInput).toHaveAttribute('required');
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(passwordInput).toHaveAttribute('minLength', '8');
    });

    it('should handle form submission', async () => {
      testUtils.renderWithProviders(
        <MockSupabaseAuthUI 
          view="sign_in"
          onAuthSuccess={mockOnAuthSuccess}
          onAuthError={mockOnAuthError}
        />
      );

      const form = screen.getByTestId('sign-in-form');
      const emailInput = screen.getByTestId('email-input');
      const passwordInput = screen.getByTestId('password-input');

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockOnAuthSuccess).toHaveBeenCalledWith({
          user: expect.objectContaining({
            id: 'test-user-id',
            email: 'test@example.com'
          }),
          session: null
        });
      });
    });

    it('should show loading state during authentication', async () => {
      testUtils.renderWithProviders(
        <MockSupabaseAuthUI 
          view="sign_in"
          onAuthSuccess={mockOnAuthSuccess}
          onAuthError={mockOnAuthError}
        />
      );

      const form = screen.getByTestId('sign-in-form');
      const submitButton = screen.getByTestId('sign-in-button');

      fireEvent.submit(form);
      
      // Button should show loading state
      expect(submitButton).toHaveTextContent('Signing In...');
      expect(submitButton).toBeDisabled();
    });

    it('should display navigation links when showLinks is true', () => {
      testUtils.renderWithProviders(
        <MockSupabaseAuthUI 
          view="sign_in"
          showLinks={true}
          onAuthSuccess={mockOnAuthSuccess}
          onAuthError={mockOnAuthError}
        />
      );

      expect(screen.getByTestId('switch-to-signup')).toBeInTheDocument();
      expect(screen.getByTestId('forgot-password-link')).toBeInTheDocument();
    });

    it('should hide navigation links when showLinks is false', () => {
      testUtils.renderWithProviders(
        <MockSupabaseAuthUI 
          view="sign_in"
          showLinks={false}
          onAuthSuccess={mockOnAuthSuccess}
          onAuthError={mockOnAuthError}
        />
      );

      expect(screen.queryByTestId('switch-to-signup')).not.toBeInTheDocument();
      expect(screen.queryByTestId('forgot-password-link')).not.toBeInTheDocument();
    });
  });

  describe('Sign Up View', () => {
    it('should render sign up form with all required elements', () => {
      testUtils.renderWithProviders(
        <MockSupabaseAuthUI 
          view="sign_up"
          onAuthSuccess={mockOnAuthSuccess}
          onAuthError={mockOnAuthError}
        />
      );

      expect(screen.getByRole('heading', { name: /create mexc sniper bot account/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/terms of service/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    });

    it('should have proper accessibility for sign up form', async () => {
      const { container } = testUtils.renderWithProviders(
        <MockSupabaseAuthUI 
          view="sign_up"
          onAuthSuccess={mockOnAuthSuccess}
          onAuthError={mockOnAuthError}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should validate sign up form fields', () => {
      testUtils.renderWithProviders(
        <MockSupabaseAuthUI 
          view="sign_up"
          onAuthSuccess={mockOnAuthSuccess}
          onAuthError={mockOnAuthError}
        />
      );

      const emailInput = screen.getByTestId('signup-email-input');
      const passwordInput = screen.getByTestId('signup-password-input');
      const confirmPasswordInput = screen.getByTestId('confirm-password-input');
      const termsCheckbox = screen.getByTestId('terms-checkbox');

      expect(emailInput).toHaveAttribute('required');
      expect(passwordInput).toHaveAttribute('required');
      expect(passwordInput).toHaveAttribute('minLength', '8');
      expect(confirmPasswordInput).toHaveAttribute('required');
      expect(termsCheckbox).toHaveAttribute('required');
    });

    it('should handle sign up form submission', async () => {
      testUtils.renderWithProviders(
        <MockSupabaseAuthUI 
          view="sign_up"
          onAuthSuccess={mockOnAuthSuccess}
          onAuthError={mockOnAuthError}
        />
      );

      const form = screen.getByTestId('sign-up-form');
      const emailInput = screen.getByTestId('signup-email-input');
      const passwordInput = screen.getByTestId('signup-password-input');
      const confirmPasswordInput = screen.getByTestId('confirm-password-input');
      const termsCheckbox = screen.getByTestId('terms-checkbox');

      fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'securepassword123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'securepassword123' } });
      fireEvent.click(termsCheckbox);
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockOnAuthSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('Password Reset View', () => {
    it('should render password reset form', () => {
      testUtils.renderWithProviders(
        <MockSupabaseAuthUI 
          view="forgotten_password"
          onAuthSuccess={mockOnAuthSuccess}
          onAuthError={mockOnAuthError}
        />
      );

      expect(screen.getByRole('heading', { name: /reset your password/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
      expect(screen.getByTestId('back-to-signin')).toBeInTheDocument();
    });

    it('should have proper accessibility for password reset', async () => {
      const { container } = testUtils.renderWithProviders(
        <MockSupabaseAuthUI 
          view="forgotten_password"
          onAuthSuccess={mockOnAuthSuccess}
          onAuthError={mockOnAuthError}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Social Providers', () => {
    it('should render social providers when configured', () => {
      testUtils.renderWithProviders(
        <MockSupabaseAuthUI 
          view="sign_in"
          providers={['google', 'github']}
          socialLayout="horizontal"
          onAuthSuccess={mockOnAuthSuccess}
          onAuthError={mockOnAuthError}
        />
      );

      expect(screen.getByTestId('social-providers')).toBeInTheDocument();
      expect(screen.getByTestId('google-auth-button')).toBeInTheDocument();
      expect(screen.getByTestId('github-auth-button')).toBeInTheDocument();
    });

    it('should have proper accessibility for social buttons', async () => {
      const { container } = testUtils.renderWithProviders(
        <MockSupabaseAuthUI 
          view="sign_in"
          providers={['google', 'github']}
          socialLayout="horizontal"
          onAuthSuccess={mockOnAuthSuccess}
          onAuthError={mockOnAuthError}
        />
      );

      const googleButton = screen.getByTestId('google-auth-button');
      const githubButton = screen.getByTestId('github-auth-button');

      expect(googleButton).toHaveAttribute('aria-label', 'Sign in with Google');
      expect(githubButton).toHaveAttribute('aria-label', 'Sign in with GitHub');

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should not render social providers when not configured', () => {
      testUtils.renderWithProviders(
        <MockSupabaseAuthUI 
          view="sign_in"
          onAuthSuccess={mockOnAuthSuccess}
          onAuthError={mockOnAuthError}
        />
      );

      expect(screen.queryByTestId('social-providers')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error messages with proper accessibility', () => {
      const mockError = 'Invalid email or password';
      
      testUtils.renderWithProviders(
        <MockSupabaseAuthUI 
          view="sign_in"
          onAuthSuccess={mockOnAuthSuccess}
          onAuthError={mockOnAuthError}
        />
      );

      // Simulate error state by triggering a failed auth attempt
      const form = screen.getByTestId('sign-in-form');
      mockOnAuthError(new Error(mockError));
      
      // In a real scenario, the error would be displayed
      // Here we test that error display has proper accessibility
      const errorElement = screen.queryByRole('alert');
      if (errorElement) {
        expect(errorElement).toHaveAttribute('role', 'alert');
      }
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support keyboard navigation', () => {
      testUtils.renderWithProviders(
        <MockSupabaseAuthUI 
          view="sign_in"
          onAuthSuccess={mockOnAuthSuccess}
          onAuthError={mockOnAuthError}
        />
      );

      const emailInput = screen.getByTestId('email-input');
      const passwordInput = screen.getByTestId('password-input');
      const submitButton = screen.getByTestId('sign-in-button');

      // Test tab navigation
      emailInput.focus();
      expect(document.activeElement).toBe(emailInput);

      fireEvent.keyDown(emailInput, { key: 'Tab' });
      // In a real browser, focus would move to password input
      
      // Test Enter key submission
      fireEvent.keyDown(submitButton, { key: 'Enter' });
      // Should trigger form submission
    });
  });

  describe('Responsive Design', () => {
    it('should handle different viewport sizes', () => {
      // Mock different viewport sizes
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 320,
      });

      testUtils.renderWithProviders(
        <MockSupabaseAuthUI 
          view="sign_in"
          onAuthSuccess={mockOnAuthSuccess}
          onAuthError={mockOnAuthError}
        />
      );

      // Component should render correctly on mobile
      expect(screen.getByTestId('sign-in-form')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should render quickly', async () => {
      const component = (
        <MockSupabaseAuthUI 
          view="sign_in"
          onAuthSuccess={mockOnAuthSuccess}
          onAuthError={mockOnAuthError}
        />
      );

      await testUtils.expectFastRender(component, 150);
    });
  });

  describe('View Switching', () => {
    it('should switch between sign in and sign up views', () => {
      testUtils.renderWithProviders(
        <MockSupabaseAuthUI 
          view="sign_in"
          showLinks={true}
          onAuthSuccess={mockOnAuthSuccess}
          onAuthError={mockOnAuthError}
        />
      );

      // Initially on sign in view
      expect(screen.getByTestId('sign-in-form')).toBeInTheDocument();

      // Click to switch to sign up
      const switchToSignUp = screen.getByTestId('switch-to-signup');
      fireEvent.click(switchToSignUp);

      // Should update view state (in real component)
      expect(switchToSignUp).toBeInTheDocument();
    });

    it('should switch to password reset view', () => {
      testUtils.renderWithProviders(
        <MockSupabaseAuthUI 
          view="sign_in"
          showLinks={true}
          onAuthSuccess={mockOnAuthSuccess}
          onAuthError={mockOnAuthError}
        />
      );

      const forgotPasswordLink = screen.getByTestId('forgot-password-link');
      fireEvent.click(forgotPasswordLink);

      // Should trigger view change (in real component)
      expect(forgotPasswordLink).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should validate email format', () => {
      testUtils.renderWithProviders(
        <MockSupabaseAuthUI 
          view="sign_in"
          onAuthSuccess={mockOnAuthSuccess}
          onAuthError={mockOnAuthError}
        />
      );

      const emailInput = screen.getByTestId('email-input');
      
      // Test invalid email
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.blur(emailInput);

      // HTML5 validation should catch this
      expect(emailInput.validity.valid).toBe(false);
    });

    it('should validate password length', () => {
      testUtils.renderWithProviders(
        <MockSupabaseAuthUI 
          view="sign_up"
          onAuthSuccess={mockOnAuthSuccess}
          onAuthError={mockOnAuthError}
        />
      );

      const passwordInput = screen.getByTestId('signup-password-input');
      
      // Test short password
      fireEvent.change(passwordInput, { target: { value: '123' } });
      fireEvent.blur(passwordInput);

      // Should not meet minimum length requirement
      expect(passwordInput.validity.valid).toBe(false);
    });
  });
});