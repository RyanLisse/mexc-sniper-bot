/**
 * Button Component Accessibility Tests
 * Comprehensive accessibility compliance testing for Button component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/button';
import { accessibilityUtils } from '@/tests/utils/accessibility-helpers';

describe('Button Accessibility Tests', () => {
  describe('Basic Accessibility Compliance', () => {
    it('should have no accessibility violations (default button)', async () => {
      await accessibilityUtils.testAccessibility(
        <Button>Accessible Button</Button>
      );
    });

    it('should have no accessibility violations (all variants)', async () => {
      const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const;
      
      for (const variant of variants) {
        await accessibilityUtils.testAccessibility(
          <Button variant={variant}>Button {variant}</Button>
        );
      }
    });

    it('should have no accessibility violations (all sizes)', async () => {
      const sizes = ['default', 'sm', 'lg', 'icon'] as const;
      
      for (const size of sizes) {
        await accessibilityUtils.testAccessibility(
          <Button size={size}>Button {size}</Button>
        );
      }
    });

    it('should have no accessibility violations (disabled state)', async () => {
      await accessibilityUtils.testAccessibility(
        <Button disabled>Disabled Button</Button>
      );
    });
  });

  describe('Keyboard Navigation', () => {
    it('should be focusable via keyboard', () => {
      render(<Button>Keyboard Button</Button>);
      
      const button = screen.getByRole('button');
      button.focus();
      
      expect(button).toHaveFocus();
    });

    it('should respond to Enter key', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Enter Button</Button>);
      
      const button = screen.getByRole('button');
      button.focus();
      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
      
      expect(handleClick).toHaveBeenCalled();
    });

    it('should respond to Space key', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Space Button</Button>);
      
      const button = screen.getByRole('button');
      button.focus();
      fireEvent.keyDown(button, { key: ' ', code: 'Space' });
      
      expect(handleClick).toHaveBeenCalled();
    });

    it('should not be focusable when disabled', () => {
      render(<Button disabled>Disabled Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('tabindex', '-1');
    });

    it('should have visible focus indicator', () => {
      render(<Button>Focus Indicator</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('focus-visible:ring-ring/50');
    });
  });

  describe('ARIA Attributes', () => {
    it('should have proper role attribute', () => {
      render(<Button>Role Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'button');
    });

    it('should support aria-label', () => {
      render(<Button aria-label="Custom Label">🎯</Button>);
      
      const button = screen.getByLabelText('Custom Label');
      expect(button).toBeInTheDocument();
    });

    it('should support aria-describedby', () => {
      render(
        <div>
          <Button aria-describedby="help-text">Help Button</Button>
          <div id="help-text">This button provides help</div>
        </div>
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-describedby', 'help-text');
    });

    it('should support aria-pressed for toggle buttons', () => {
      render(<Button aria-pressed="false">Toggle Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });

    it('should support aria-expanded for expandable buttons', () => {
      render(<Button aria-expanded="false">Expandable Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('should indicate disabled state to assistive technology', () => {
      render(<Button disabled>Disabled Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('Screen Reader Support', () => {
    it('should provide accessible name from text content', () => {
      render(<Button>Save Changes</Button>);
      
      const button = screen.getByRole('button', { name: 'Save Changes' });
      expect(button).toBeInTheDocument();
    });

    it('should provide accessible name from aria-label', () => {
      render(<Button aria-label="Close dialog">×</Button>);
      
      const button = screen.getByRole('button', { name: 'Close dialog' });
      expect(button).toBeInTheDocument();
    });

    it('should work with icon-only buttons', () => {
      render(
        <Button size="icon" aria-label="Settings">
          <svg data-testid="settings-icon" />
        </Button>
      );
      
      const button = screen.getByRole('button', { name: 'Settings' });
      expect(button).toBeInTheDocument();
    });

    it('should handle complex content', () => {
      render(
        <Button>
          <svg data-testid="icon" />
          <span>Button with icon and text</span>
        </Button>
      );
      
      const button = screen.getByRole('button', { name: /Button with icon and text/ });
      expect(button).toBeInTheDocument();
    });
  });

  describe('Color Contrast', () => {
    it('should meet color contrast requirements (default)', async () => {
      await accessibilityUtils.testColorContrast(
        <Button>Default Button</Button>
      );
    });

    it('should meet color contrast requirements (destructive)', async () => {
      await accessibilityUtils.testColorContrast(
        <Button variant="destructive">Delete</Button>
      );
    });

    it('should meet color contrast requirements (outline)', async () => {
      await accessibilityUtils.testColorContrast(
        <Button variant="outline">Outline Button</Button>
      );
    });

    it('should meet color contrast requirements (disabled)', async () => {
      await accessibilityUtils.testColorContrast(
        <Button disabled>Disabled Button</Button>
      );
    });
  });

  describe('Form Integration Accessibility', () => {
    it('should work as submit button with screen readers', () => {
      render(
        <form>
          <Button type="submit">Submit Form</Button>
        </form>
      );
      
      const button = screen.getByRole('button', { name: 'Submit Form' });
      expect(button).toHaveAttribute('type', 'submit');
    });

    it('should associate with form errors', () => {
      render(
        <form>
          <Button aria-describedby="form-error">Submit</Button>
          <div id="form-error" role="alert">Please fix errors before submitting</div>
        </form>
      );
      
      const button = screen.getByRole('button');
      const errorMessage = screen.getByRole('alert');
      
      expect(button).toHaveAttribute('aria-describedby', 'form-error');
      expect(errorMessage).toBeInTheDocument();
    });
  });

  describe('AsChild Accessibility', () => {
    it('should maintain accessibility when used as child', () => {
      render(
        <Button asChild>
          <a href="/test">Link Button</a>
        </Button>
      );
      
      const link = screen.getByRole('link', { name: 'Link Button' });
      expect(link).toHaveAttribute('href', '/test');
    });

    it('should preserve ARIA attributes with asChild', () => {
      render(
        <Button asChild aria-label="External link">
          <a href="https://example.com" target="_blank" rel="noopener noreferrer">
            Visit Site
          </a>
        </Button>
      );
      
      const link = screen.getByRole('link', { name: 'External link' });
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('Responsive Accessibility', () => {
    it('should remain accessible at different viewport sizes', async () => {
      // Test mobile viewport
      global.innerWidth = 375;
      global.innerHeight = 667;
      global.dispatchEvent(new Event('resize'));
      
      await accessibilityUtils.testAccessibility(
        <Button>Mobile Button</Button>
      );
      
      // Test tablet viewport
      global.innerWidth = 768;
      global.innerHeight = 1024;
      global.dispatchEvent(new Event('resize'));
      
      await accessibilityUtils.testAccessibility(
        <Button>Tablet Button</Button>
      );
      
      // Test desktop viewport
      global.innerWidth = 1920;
      global.innerHeight = 1080;
      global.dispatchEvent(new Event('resize'));
      
      await accessibilityUtils.testAccessibility(
        <Button>Desktop Button</Button>
      );
    });
  });

  describe('Reduced Motion Support', () => {
    it('should respect prefers-reduced-motion', async () => {
      await accessibilityUtils.testAccessibilityScenarios(
        <Button>Motion Button</Button>,
        { withReducedMotion: true }
      );
    });
  });

  describe('High Contrast Mode', () => {
    it('should be accessible in high contrast mode', async () => {
      await accessibilityUtils.testAccessibilityScenarios(
        <Button>High Contrast Button</Button>,
        { withHighContrast: true }
      );
    });

    it('should maintain visibility in high contrast (all variants)', async () => {
      const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost'] as const;
      
      for (const variant of variants) {
        await accessibilityUtils.testAccessibilityScenarios(
          <Button variant={variant}>High Contrast {variant}</Button>,
          { withHighContrast: true }
        );
      }
    });
  });

  describe('Large Text Support', () => {
    it('should remain accessible with large text', async () => {
      await accessibilityUtils.testAccessibilityScenarios(
        <Button>Large Text Button</Button>,
        { withLargeText: true }
      );
    });
  });

  describe('Comprehensive Accessibility Test', () => {
    it('should pass full accessibility test suite', async () => {
      await accessibilityUtils.runFullAccessibilityTests(
        <Button>Comprehensive Test Button</Button>
      );
    });

    it('should pass full accessibility test suite (complex button)', async () => {
      await accessibilityUtils.runFullAccessibilityTests(
        <div>
          <Button 
            variant="destructive"
            aria-label="Delete item"
            aria-describedby="delete-help"
          >
            <svg aria-hidden="true" />
            Delete
          </Button>
          <div id="delete-help">This action cannot be undone</div>
        </div>
      );
    });
  });

  describe('Accessibility Report Generation', () => {
    it('should generate accessibility report', async () => {
      const report = await accessibilityUtils.generateAccessibilityReport(
        <Button>Report Button</Button>,
        'Button Component'
      );
      
      expect(report).toHaveProperty('componentName', 'Button Component');
      expect(report).toHaveProperty('violationCount');
      expect(report).toHaveProperty('passes');
      expect(report).toHaveProperty('timestamp');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty button gracefully', async () => {
      render(<Button aria-label="Empty button" />);
      
      const button = screen.getByRole('button', { name: 'Empty button' });
      expect(button).toBeInTheDocument();
      
      // Should still pass accessibility tests with proper labeling
      await accessibilityUtils.testAccessibility(
        <Button aria-label="Empty button" />
      );
    });

    it('should handle button with only whitespace', async () => {
      await accessibilityUtils.testAccessibility(
        <Button aria-label="Whitespace button">   </Button>
      );
    });

    it('should handle button with complex nested content', async () => {
      await accessibilityUtils.testAccessibility(
        <Button>
          <div>
            <span>Complex</span>
            <strong>Nested</strong>
            <em>Content</em>
          </div>
        </Button>
      );
    });
  });
});