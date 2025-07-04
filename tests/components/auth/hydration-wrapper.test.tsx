/**
 * Hydration Wrapper Component Tests
 * Tests client-side hydration prevention and fallback rendering
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { HydrationWrapper } from '@/components/auth/hydration-wrapper';

// Mock useEffect to control hydration timing
const mockUseEffect = vi.fn();
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useEffect: mockUseEffect,
  };
});

describe('HydrationWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default useEffect mock that calls the callback immediately
    mockUseEffect.mockImplementation((callback) => callback());
  });

  describe('Rendering', () => {
    it('should render fallback initially before hydration', () => {
      // Mock useEffect to not call the callback (simulating pre-hydration)
      mockUseEffect.mockImplementation(() => {});

      render(
        <HydrationWrapper fallback={<div data-testid="fallback">Loading...</div>}>
          <div data-testid="children">Hydrated content</div>
        </HydrationWrapper>
      );

      expect(screen.getByTestId('fallback')).toBeInTheDocument();
      expect(screen.queryByTestId('children')).not.toBeInTheDocument();
    });

    it('should render children after hydration', async () => {
      render(
        <HydrationWrapper fallback={<div data-testid="fallback">Loading...</div>}>
          <div data-testid="children">Hydrated content</div>
        </HydrationWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('children')).toBeInTheDocument();
        expect(screen.queryByTestId('fallback')).not.toBeInTheDocument();
      });
    });

    it('should render null fallback when no fallback provided', () => {
      // Mock useEffect to not call the callback (simulating pre-hydration)
      mockUseEffect.mockImplementation(() => {});

      const { container } = render(
        <HydrationWrapper>
          <div data-testid="children">Hydrated content</div>
        </HydrationWrapper>
      );

      // Should render empty fragment (null fallback)
      expect(container.firstChild).toBeNull();
      expect(screen.queryByTestId('children')).not.toBeInTheDocument();
    });

    it('should render children when fallback is null', async () => {
      render(
        <HydrationWrapper fallback={null}>
          <div data-testid="children">Hydrated content</div>
        </HydrationWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('children')).toBeInTheDocument();
      });
    });
  });

  describe('Hydration Timing', () => {
    it('should set hydrated state in useEffect', () => {
      const mockSetState = vi.fn();
      vi.mocked(vi.doMock('react', () => ({
        ...vi.importActual('react'),
        useState: vi.fn().mockReturnValue([false, mockSetState]),
        useEffect: vi.fn().mockImplementation((callback) => callback()),
      })));

      render(
        <HydrationWrapper>
          <div>Test content</div>
        </HydrationWrapper>
      );

      expect(mockSetState).toHaveBeenCalledWith(true);
    });

    it('should only run effect once with empty dependency array', () => {
      render(
        <HydrationWrapper>
          <div>Test content</div>
        </HydrationWrapper>
      );

      expect(mockUseEffect).toHaveBeenCalledWith(expect.any(Function), []);
    });
  });

  describe('Complex Content', () => {
    it('should handle complex children components', async () => {
      const ComplexChild = () => (
        <div data-testid="complex-child">
          <h1>Title</h1>
          <p>Paragraph</p>
          <button>Button</button>
        </div>
      );

      render(
        <HydrationWrapper fallback={<div data-testid="loading">Loading...</div>}>
          <ComplexChild />
        </HydrationWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('complex-child')).toBeInTheDocument();
        expect(screen.getByText('Title')).toBeInTheDocument();
        expect(screen.getByText('Paragraph')).toBeInTheDocument();
        expect(screen.getByText('Button')).toBeInTheDocument();
      });
    });

    it('should handle multiple children', async () => {
      render(
        <HydrationWrapper fallback={<div data-testid="loading">Loading...</div>}>
          <div data-testid="child1">Child 1</div>
          <div data-testid="child2">Child 2</div>
          <div data-testid="child3">Child 3</div>
        </HydrationWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('child1')).toBeInTheDocument();
        expect(screen.getByTestId('child2')).toBeInTheDocument();
        expect(screen.getByTestId('child3')).toBeInTheDocument();
      });
    });

    it('should handle nested components', async () => {
      const NestedComponent = () => (
        <div data-testid="nested">
          <HydrationWrapper fallback={<span data-testid="inner-fallback">Inner loading</span>}>
            <div data-testid="inner-content">Inner content</div>
          </HydrationWrapper>
        </div>
      );

      render(
        <HydrationWrapper fallback={<div data-testid="outer-fallback">Outer loading</div>}>
          <NestedComponent />
        </HydrationWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('nested')).toBeInTheDocument();
        expect(screen.getByTestId('inner-content')).toBeInTheDocument();
        expect(screen.queryByTestId('outer-fallback')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner-fallback')).not.toBeInTheDocument();
      });
    });
  });

  describe('Fallback Variations', () => {
    it('should render string fallback', () => {
      mockUseEffect.mockImplementation(() => {});

      render(
        <HydrationWrapper fallback="Loading...">
          <div>Content</div>
        </HydrationWrapper>
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should render component fallback', () => {
      mockUseEffect.mockImplementation(() => {});

      const LoadingComponent = () => <div data-testid="loading-component">Custom loading</div>;

      render(
        <HydrationWrapper fallback={<LoadingComponent />}>
          <div>Content</div>
        </HydrationWrapper>
      );

      expect(screen.getByTestId('loading-component')).toBeInTheDocument();
    });

    it('should render complex fallback', () => {
      mockUseEffect.mockImplementation(() => {});

      const fallback = (
        <div data-testid="complex-fallback">
          <div>Loading...</div>
          <div>Please wait</div>
        </div>
      );

      render(
        <HydrationWrapper fallback={fallback}>
          <div>Content</div>
        </HydrationWrapper>
      );

      expect(screen.getByTestId('complex-fallback')).toBeInTheDocument();
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.getByText('Please wait')).toBeInTheDocument();
    });
  });

  describe('State Management', () => {
    it('should maintain hydration state correctly', async () => {
      const { rerender } = render(
        <HydrationWrapper fallback={<div data-testid="fallback">Loading</div>}>
          <div data-testid="content">Content</div>
        </HydrationWrapper>
      );

      // After hydration, content should be visible
      await waitFor(() => {
        expect(screen.getByTestId('content')).toBeInTheDocument();
      });

      // Rerender should maintain hydrated state
      rerender(
        <HydrationWrapper fallback={<div data-testid="fallback">Loading</div>}>
          <div data-testid="updated-content">Updated Content</div>
        </HydrationWrapper>
      );

      expect(screen.getByTestId('updated-content')).toBeInTheDocument();
      expect(screen.queryByTestId('fallback')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty children', async () => {
      render(
        <HydrationWrapper fallback={<div data-testid="fallback">Loading</div>}>
          {null}
        </HydrationWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('fallback')).not.toBeInTheDocument();
      });
    });

    it('should handle undefined children', async () => {
      render(
        <HydrationWrapper fallback={<div data-testid="fallback">Loading</div>}>
          {undefined}
        </HydrationWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('fallback')).not.toBeInTheDocument();
      });
    });

    it('should handle false children', async () => {
      render(
        <HydrationWrapper fallback={<div data-testid="fallback">Loading</div>}>
          {false}
        </HydrationWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('fallback')).not.toBeInTheDocument();
      });
    });

    it('should handle array of children', async () => {
      const children = [
        <div key="1" data-testid="child1">Child 1</div>,
        <div key="2" data-testid="child2">Child 2</div>,
      ];

      render(
        <HydrationWrapper fallback={<div data-testid="fallback">Loading</div>}>
          {children}
        </HydrationWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('child1')).toBeInTheDocument();
        expect(screen.getByTestId('child2')).toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    it('should not cause unnecessary re-renders', async () => {
      const mockChild = vi.fn(() => <div data-testid="child">Child</div>);
      const MockChildComponent = mockChild;

      render(
        <HydrationWrapper fallback={<div data-testid="fallback">Loading</div>}>
          <MockChildComponent />
        </HydrationWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('child')).toBeInTheDocument();
      });

      // Child should only render once after hydration
      expect(mockChild).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should maintain semantic structure', async () => {
      render(
        <HydrationWrapper fallback={<div role="status">Loading content...</div>}>
          <main data-testid="main-content">
            <h1>Title</h1>
            <p>Content</p>
          </main>
        </HydrationWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('main-content')).toBeInTheDocument();
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
    });

    it('should handle loading states accessibly', () => {
      mockUseEffect.mockImplementation(() => {});

      render(
        <HydrationWrapper fallback={<div role="status" aria-live="polite">Loading...</div>}>
          <div>Content</div>
        </HydrationWrapper>
      );

      const loadingElement = screen.getByRole('status');
      expect(loadingElement).toBeInTheDocument();
      expect(loadingElement).toHaveAttribute('aria-live', 'polite');
    });
  });
});