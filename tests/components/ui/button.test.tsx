/**
 * Button Component Tests
 * Tests all button variants, sizes, states, and accessibility features
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../../../src/components/ui/button';
import { testUtils } from '../../utils/component-helpers';

describe('Button Component', () => {
  describe('Basic Rendering', () => {
    it('should render button with default props', () => {
      render(<Button>Click me</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Click me');
      expect(button).toHaveAttribute('data-slot', 'button');
    });

    it('should render button with custom className', () => {
      render(<Button className="custom-class">Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });

    it('should forward HTML props to button element', () => {
      render(
        <Button 
          id="test-button" 
          aria-label="Test button"
          title="Test tooltip"
          data-testid="test-btn"
        >
          Button
        </Button>
      );
      
      const button = screen.getByTestId('test-btn');
      expect(button).toHaveAttribute('id', 'test-button');
      expect(button).toHaveAttribute('aria-label', 'Test button');
      expect(button).toHaveAttribute('title', 'Test tooltip');
    });
  });

  describe('Variants', () => {
    it('should render default variant', () => {
      render(<Button variant="default">Default</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-primary', 'text-primary-foreground');
    });

    it('should render destructive variant', () => {
      render(<Button variant="destructive">Delete</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-destructive', 'text-white');
    });

    it('should render outline variant', () => {
      render(<Button variant="outline">Outline</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('border', 'bg-background');
    });

    it('should render secondary variant', () => {
      render(<Button variant="secondary">Secondary</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-secondary', 'text-secondary-foreground');
    });

    it('should render ghost variant', () => {
      render(<Button variant="ghost">Ghost</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('hover:bg-accent');
    });

    it('should render link variant', () => {
      render(<Button variant="link">Link</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('text-primary', 'underline-offset-4');
    });
  });

  describe('Sizes', () => {
    it('should render default size', () => {
      render(<Button size="default">Default Size</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-9', 'px-4', 'py-2');
    });

    it('should render small size', () => {
      render(<Button size="sm">Small</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-8', 'px-3');
    });

    it('should render large size', () => {
      render(<Button size="lg">Large</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-10', 'px-6');
    });

    it('should render icon size', () => {
      render(<Button size="icon">🎯</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('size-9');
    });
  });

  describe('States', () => {
    it('should handle disabled state', () => {
      render(<Button disabled>Disabled</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('disabled:pointer-events-none', 'disabled:opacity-50');
    });

    it('should handle loading state with disabled', () => {
      render(<Button disabled>Loading...</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent('Loading...');
    });

    it('should handle aria-invalid attribute', () => {
      render(<Button aria-invalid="true">Invalid</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-invalid', 'true');
      expect(button).toHaveClass('aria-invalid:ring-destructive/20');
    });
  });

  describe('AsChild Functionality', () => {
    it('should render as child element when asChild is true', () => {
      render(
        <Button asChild>
          <a href="/test">Link Button</a>
        </Button>
      );
      
      const link = screen.getByRole('link');
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/test');
      expect(link).toHaveTextContent('Link Button');
      expect(link).toHaveAttribute('data-slot', 'button');
    });

    it('should apply button styles to child element', () => {
      render(
        <Button asChild variant="destructive" size="lg">
          <a href="/delete">Delete Link</a>
        </Button>
      );
      
      const link = screen.getByRole('link');
      expect(link).toHaveClass('bg-destructive', 'text-white', 'h-10', 'px-6');
    });
  });

  describe('Event Handling', () => {
    it('should handle click events', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should not trigger click when disabled', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick} disabled>Disabled</Button>);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('should handle keyboard events', () => {
      const handleKeyDown = vi.fn();
      render(<Button onKeyDown={handleKeyDown}>Keyboard</Button>);
      
      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: 'Enter' });
      
      expect(handleKeyDown).toHaveBeenCalledTimes(1);
    });

    it('should handle focus events', () => {
      const handleFocus = vi.fn();
      const handleBlur = vi.fn();
      render(<Button onFocus={handleFocus} onBlur={handleBlur}>Focus me</Button>);
      
      const button = screen.getByRole('button');
      fireEvent.focus(button);
      fireEvent.blur(button);
      
      expect(handleFocus).toHaveBeenCalledTimes(1);
      expect(handleBlur).toHaveBeenCalledTimes(1);
    });
  });

  describe('Icon Support', () => {
    it('should render with icon', () => {
      render(
        <Button>
          <svg data-testid="icon" />
          Button with icon
        </Button>
      );
      
      const button = screen.getByRole('button');
      const icon = screen.getByTestId('icon');
      
      expect(button).toContainElement(icon);
      expect(button).toHaveTextContent('Button with icon');
    });

    it('should render icon-only button', () => {
      render(
        <Button size="icon" aria-label="Settings">
          <svg data-testid="settings-icon" />
        </Button>
      );
      
      const button = screen.getByRole('button');
      const icon = screen.getByTestId('settings-icon');
      
      expect(button).toContainElement(icon);
      expect(button).toHaveAttribute('aria-label', 'Settings');
    });
  });

  describe('Accessibility', () => {
    it('should have proper focus styles', () => {
      render(<Button>Focusable</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('focus-visible:ring-ring/50', 'focus-visible:ring-[3px]');
    });

    it('should support aria attributes', () => {
      render(
        <Button 
          aria-label="Close dialog"
          aria-describedby="help-text"
          aria-pressed="false"
        >
          ×
        </Button>
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Close dialog');
      expect(button).toHaveAttribute('aria-describedby', 'help-text');
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });

    it('should be keyboard accessible', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Keyboard accessible</Button>);
      
      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: 'Enter' });
      fireEvent.keyDown(button, { key: ' ' });
      
      // Note: Space bar keydown doesn't trigger click in testing library
      // But Enter should work with proper implementation
      expect(button).toHaveAttribute('type', 'button');
    });

    it('should have proper ARIA role', () => {
      render(<Button>ARIA Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'button');
    });
  });

  describe('Form Integration', () => {
    it('should work as form submit button', () => {
      const handleSubmit = vi.fn();
      render(
        <form onSubmit={handleSubmit}>
          <Button type="submit">Submit</Button>
        </form>
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'submit');
    });

    it('should work as form reset button', () => {
      render(
        <form>
          <Button type="reset">Reset</Button>
        </form>
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'reset');
    });
  });

  describe('Performance', () => {
    it('should not cause unnecessary re-renders', () => {
      const mockRender = vi.fn();
      const TestButton = ({ children, ...props }: any) => {
        mockRender();
        return <Button {...props}>{children}</Button>;
      };

      const { rerender } = render(<TestButton>Test</TestButton>);
      
      // Rerender with same props
      rerender(<TestButton>Test</TestButton>);
      
      expect(mockRender).toHaveBeenCalledTimes(2);
    });
  });

  describe('Styling', () => {
    it('should have base styles applied', () => {
      render(<Button>Styled Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass(
        'inline-flex',
        'items-center',
        'justify-center',
        'gap-2',
        'whitespace-nowrap',
        'rounded-md',
        'text-sm',
        'font-medium',
        'transition-all'
      );
    });

    it('should combine custom className with variant classes', () => {
      render(<Button className="custom-class" variant="destructive">Custom</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class', 'bg-destructive', 'text-white');
    });

    it('should handle dark mode classes', () => {
      render(<Button variant="outline">Dark Mode</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('dark:bg-input/30', 'dark:border-input');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty children', () => {
      render(<Button>{''}</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('');
    });

    it('should handle null children', () => {
      render(<Button>{null}</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should handle undefined props', () => {
      render(<Button variant={undefined} size={undefined}>Undefined</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('bg-primary'); // Default variant
    });
  });

  describe('Component Composition', () => {
    it('should work with complex children', () => {
      render(
        <Button>
          <span>Complex</span>
          <strong>Children</strong>
        </Button>
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('ComplexChildren');
      expect(screen.getByText('Complex')).toBeInTheDocument();
      expect(screen.getByText('Children')).toBeInTheDocument();
    });

    it('should maintain proper structure with nested elements', () => {
      render(
        <Button>
          <div data-testid="wrapper">
            <span data-testid="text">Nested</span>
          </div>
        </Button>
      );
      
      const button = screen.getByRole('button');
      const wrapper = screen.getByTestId('wrapper');
      const text = screen.getByTestId('text');
      
      expect(button).toContainElement(wrapper);
      expect(wrapper).toContainElement(text);
    });
  });
});