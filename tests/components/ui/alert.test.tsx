/**
 * Alert Component Tests
 * Tests Alert, AlertTitle, and AlertDescription components with all variants and states
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { createRef } from 'react';

describe('Alert Component System', () => {
  describe('Alert Component', () => {
    describe('Basic Rendering', () => {
      it('should render alert with default props', () => {
        render(<Alert>Alert content</Alert>);
        
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveTextContent('Alert content');
      });

      it('should render alert with custom className', () => {
        render(<Alert className="custom-alert">Alert</Alert>);
        
        const alert = screen.getByRole('alert');
        expect(alert).toHaveClass('custom-alert');
      });

      it('should forward HTML attributes', () => {
        render(
          <Alert 
            id="test-alert" 
            data-testid="alert-element"
            aria-describedby="description"
          >
            Alert content
          </Alert>
        );
        
        const alert = screen.getByTestId('alert-element');
        expect(alert).toHaveAttribute('id', 'test-alert');
        expect(alert).toHaveAttribute('aria-describedby', 'description');
      });

      it('should have proper ARIA role', () => {
        render(<Alert>Alert message</Alert>);
        
        const alert = screen.getByRole('alert');
        expect(alert).toHaveAttribute('role', 'alert');
      });
    });

    describe('Variants', () => {
      it('should render default variant', () => {
        render(<Alert variant="default">Default alert</Alert>);
        
        const alert = screen.getByRole('alert');
        expect(alert).toHaveClass('bg-background', 'text-foreground');
      });

      it('should render destructive variant', () => {
        render(<Alert variant="destructive">Error alert</Alert>);
        
        const alert = screen.getByRole('alert');
        expect(alert).toHaveClass('border-destructive/50', 'text-destructive');
      });

      it('should use default variant when no variant specified', () => {
        render(<Alert>Default by default</Alert>);
        
        const alert = screen.getByRole('alert');
        expect(alert).toHaveClass('bg-background', 'text-foreground');
      });
    });

    describe('Styling', () => {
      it('should have base styles applied', () => {
        render(<Alert>Styled alert</Alert>);
        
        const alert = screen.getByRole('alert');
        expect(alert).toHaveClass(
          'relative',
          'w-full',
          'rounded-lg',
          'border',
          'p-4'
        );
      });

      it('should have icon positioning classes', () => {
        render(<Alert>Alert with icon support</Alert>);
        
        const alert = screen.getByRole('alert');
        expect(alert).toHaveClass(
          '[&>svg~*]:pl-7',
          '[&>svg+div]:translate-y-[-3px]',
          '[&>svg]:absolute',
          '[&>svg]:left-4',
          '[&>svg]:top-4',
          '[&>svg]:text-foreground'
        );
      });

      it('should combine custom className with variant classes', () => {
        render(<Alert className="custom-class" variant="destructive">Custom</Alert>);
        
        const alert = screen.getByRole('alert');
        expect(alert).toHaveClass('custom-class', 'text-destructive', 'border-destructive/50');
      });

      it('should handle dark mode classes', () => {
        render(<Alert variant="destructive">Dark mode alert</Alert>);
        
        const alert = screen.getByRole('alert');
        expect(alert).toHaveClass('dark:border-destructive');
      });
    });

    describe('Ref Forwarding', () => {
      it('should forward ref to div element', () => {
        const ref = createRef<HTMLDivElement>();
        render(<Alert ref={ref}>Ref test</Alert>);
        
        expect(ref.current).toBeInstanceOf(HTMLDivElement);
        expect(ref.current).toHaveTextContent('Ref test');
      });
    });

    describe('Icon Support', () => {
      it('should render with icon', () => {
        render(
          <Alert>
            <svg data-testid="alert-icon" />
            <div>Alert with icon</div>
          </Alert>
        );
        
        const alert = screen.getByRole('alert');
        const icon = screen.getByTestId('alert-icon');
        
        expect(alert).toContainElement(icon);
      });

      it('should position icon correctly', () => {
        render(
          <Alert>
            <svg data-testid="positioned-icon" />
            <div>Content after icon</div>
          </Alert>
        );
        
        const alert = screen.getByRole('alert');
        expect(alert).toHaveClass('[&>svg]:absolute', '[&>svg]:left-4', '[&>svg]:top-4');
      });
    });
  });

  describe('AlertTitle Component', () => {
    describe('Basic Rendering', () => {
      it('should render alert title', () => {
        render(<AlertTitle>Alert Title</AlertTitle>);
        
        const title = screen.getByRole('heading', { level: 5 });
        expect(title).toBeInTheDocument();
        expect(title).toHaveTextContent('Alert Title');
      });

      it('should render as h5 element', () => {
        render(<AlertTitle>Title</AlertTitle>);
        
        const title = screen.getByRole('heading', { level: 5 });
        expect(title.tagName).toBe('H5');
      });

      it('should render with custom className', () => {
        render(<AlertTitle className="custom-title">Title</AlertTitle>);
        
        const title = screen.getByRole('heading');
        expect(title).toHaveClass('custom-title');
      });

      it('should forward HTML attributes', () => {
        render(
          <AlertTitle 
            id="alert-title" 
            data-testid="title-element"
          >
            Title
          </AlertTitle>
        );
        
        const title = screen.getByTestId('title-element');
        expect(title).toHaveAttribute('id', 'alert-title');
      });
    });

    describe('Styling', () => {
      it('should have default styles applied', () => {
        render(<AlertTitle>Styled title</AlertTitle>);
        
        const title = screen.getByRole('heading');
        expect(title).toHaveClass(
          'mb-1',
          'font-medium',
          'leading-none',
          'tracking-tight'
        );
      });

      it('should combine custom className with default styles', () => {
        render(<AlertTitle className="custom-style">Title</AlertTitle>);
        
        const title = screen.getByRole('heading');
        expect(title).toHaveClass('custom-style', 'mb-1', 'font-medium');
      });
    });

    describe('Ref Forwarding', () => {
      it('should forward ref to h5 element', () => {
        const ref = createRef<HTMLHeadingElement>();
        render(<AlertTitle ref={ref}>Ref test</AlertTitle>);
        
        expect(ref.current).toBeInstanceOf(HTMLHeadingElement);
        expect(ref.current?.tagName).toBe('H5');
      });
    });
  });

  describe('AlertDescription Component', () => {
    describe('Basic Rendering', () => {
      it('should render alert description', () => {
        render(<AlertDescription>Alert description</AlertDescription>);
        
        const description = screen.getByText('Alert description');
        expect(description).toBeInTheDocument();
      });

      it('should render as div element', () => {
        render(<AlertDescription data-testid="description">Description</AlertDescription>);
        
        const description = screen.getByTestId('description');
        expect(description.tagName).toBe('DIV');
      });

      it('should render with custom className', () => {
        render(<AlertDescription className="custom-desc">Description</AlertDescription>);
        
        const description = screen.getByText('Description');
        expect(description).toHaveClass('custom-desc');
      });

      it('should forward HTML attributes', () => {
        render(
          <AlertDescription 
            id="alert-desc" 
            data-testid="desc-element"
          >
            Description
          </AlertDescription>
        );
        
        const description = screen.getByTestId('desc-element');
        expect(description).toHaveAttribute('id', 'alert-desc');
      });
    });

    describe('Styling', () => {
      it('should have default styles applied', () => {
        render(<AlertDescription>Styled description</AlertDescription>);
        
        const description = screen.getByText('Styled description');
        expect(description).toHaveClass('text-sm', '[&_p]:leading-relaxed');
      });

      it('should combine custom className with default styles', () => {
        render(<AlertDescription className="custom-style">Description</AlertDescription>);
        
        const description = screen.getByText('Description');
        expect(description).toHaveClass('custom-style', 'text-sm');
      });
    });

    describe('Ref Forwarding', () => {
      it('should forward ref to div element', () => {
        const ref = createRef<HTMLDivElement>();
        render(<AlertDescription ref={ref}>Ref test</AlertDescription>);
        
        expect(ref.current).toBeInstanceOf(HTMLDivElement);
        expect(ref.current).toHaveTextContent('Ref test');
      });
    });

    describe('Content Handling', () => {
      it('should render paragraph content with proper styling', () => {
        render(
          <AlertDescription>
            <p>First paragraph</p>
            <p>Second paragraph</p>
          </AlertDescription>
        );
        
        const description = screen.getByText('First paragraph').parentElement;
        expect(description).toHaveClass('[&_p]:leading-relaxed');
        expect(screen.getByText('First paragraph')).toBeInTheDocument();
        expect(screen.getByText('Second paragraph')).toBeInTheDocument();
      });

      it('should handle complex content', () => {
        render(
          <AlertDescription>
            <div>
              <p>Paragraph with <strong>bold</strong> text</p>
              <ul>
                <li>List item 1</li>
                <li>List item 2</li>
              </ul>
            </div>
          </AlertDescription>
        );
        
        expect(screen.getByText('bold')).toBeInTheDocument();
        expect(screen.getByText('List item 1')).toBeInTheDocument();
        expect(screen.getByText('List item 2')).toBeInTheDocument();
      });
    });
  });

  describe('Component Composition', () => {
    describe('Complete Alert Structure', () => {
      it('should render complete alert with all components', () => {
        render(
          <Alert variant="destructive">
            <svg data-testid="alert-icon" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Something went wrong. Please try again.
            </AlertDescription>
          </Alert>
        );
        
        const alert = screen.getByRole('alert');
        const icon = screen.getByTestId('alert-icon');
        const title = screen.getByRole('heading');
        const description = screen.getByText('Something went wrong. Please try again.');
        
        expect(alert).toContainElement(icon);
        expect(alert).toContainElement(title);
        expect(alert).toContainElement(description);
        expect(title).toHaveTextContent('Error');
      });

      it('should work with minimal structure', () => {
        render(
          <Alert>
            <AlertDescription>Simple alert message</AlertDescription>
          </Alert>
        );
        
        const alert = screen.getByRole('alert');
        const description = screen.getByText('Simple alert message');
        
        expect(alert).toContainElement(description);
      });

      it('should work with title only', () => {
        render(
          <Alert>
            <AlertTitle>Title Only</AlertTitle>
          </Alert>
        );
        
        const alert = screen.getByRole('alert');
        const title = screen.getByRole('heading');
        
        expect(alert).toContainElement(title);
        expect(title).toHaveTextContent('Title Only');
      });
    });

    describe('Accessibility', () => {
      it('should have proper ARIA structure', () => {
        render(
          <Alert>
            <AlertTitle>Accessible Alert</AlertTitle>
            <AlertDescription>
              This alert is accessible with proper ARIA roles.
            </AlertDescription>
          </Alert>
        );
        
        const alert = screen.getByRole('alert');
        const title = screen.getByRole('heading');
        
        expect(alert).toHaveAttribute('role', 'alert');
        expect(title).toBeInTheDocument();
      });

      it('should work with aria-labelledby', () => {
        render(
          <Alert aria-labelledby="alert-title">
            <AlertTitle id="alert-title">Important</AlertTitle>
            <AlertDescription>Important information</AlertDescription>
          </Alert>
        );
        
        const alert = screen.getByRole('alert');
        const title = screen.getByRole('heading');
        
        expect(alert).toHaveAttribute('aria-labelledby', 'alert-title');
        expect(title).toHaveAttribute('id', 'alert-title');
      });
    });

    describe('Responsive Design', () => {
      it('should be responsive by default', () => {
        render(<Alert>Responsive alert</Alert>);
        
        const alert = screen.getByRole('alert');
        expect(alert).toHaveClass('w-full');
      });

      it('should work with responsive classes', () => {
        render(<Alert className="md:w-1/2 lg:w-1/3">Responsive</Alert>);
        
        const alert = screen.getByRole('alert');
        expect(alert).toHaveClass('md:w-1/2', 'lg:w-1/3');
      });
    });

    describe('Display Names', () => {
      it('should have proper display names for debugging', () => {
        expect(Alert.displayName).toBe('Alert');
        expect(AlertTitle.displayName).toBe('AlertTitle');
        expect(AlertDescription.displayName).toBe('AlertDescription');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content', () => {
      render(<Alert />);
      
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('');
    });

    it('should handle null children', () => {
      render(<Alert>{null}</Alert>);
      
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
    });

    it('should handle undefined variant', () => {
      render(<Alert variant={undefined}>Undefined variant</Alert>);
      
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-background'); // Default variant
    });

    it('should handle long content', () => {
      const longContent = 'Very long content that should wrap properly and maintain readability even when the text is extremely long and spans multiple lines in the alert container.';
      
      render(
        <Alert>
          <AlertTitle>Long Content Test</AlertTitle>
          <AlertDescription>{longContent}</AlertDescription>
        </Alert>
      );
      
      const alert = screen.getByRole('alert');
      const description = screen.getByText(longContent);
      
      expect(alert).toContainElement(description);
      expect(description).toHaveTextContent(longContent);
    });
  });
});