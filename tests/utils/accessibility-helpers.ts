/**
 * Accessibility Testing Utilities
 * Provides helpers for accessibility compliance testing across all components
 */

import { render, RenderResult } from '@testing-library/react';
import { ReactElement } from 'react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { renderWithProviders } from './component-helpers';

// Extend Jest matchers to include accessibility matchers
expect.extend(toHaveNoViolations);

// Accessibility testing configuration
const axeConfig = {
  rules: {
    // Enable additional accessibility rules
    'color-contrast': { enabled: true },
    'keyboard-navigation': { enabled: true },
    'focus-management': { enabled: true },
    'aria-usage': { enabled: true },
    'semantic-markup': { enabled: true },
    
    // Configure specific rules for our components
    'landmark-one-main': { enabled: false }, // May not apply to all components
    'page-has-heading-one': { enabled: false }, // May not apply to all components
    'region': { enabled: false }, // May not apply to individual components
  },
  tags: [
    'wcag2a', 
    'wcag2aa', 
    'wcag21aa', 
    'best-practice',
    'section508',
  ],
};

/**
 * Test component for accessibility violations
 */
export const testAccessibility = async (component: ReactElement): Promise<void> => {
  const { container } = renderWithProviders(component);
  const results = await axe(container, axeConfig);
  expect(results).toHaveNoViolations();
};

/**
 * Test component with custom accessibility configuration
 */
export const testAccessibilityWithConfig = async (
  component: ReactElement,
  config: any = {}
): Promise<void> => {
  const { container } = renderWithProviders(component);
  const results = await axe(container, { ...axeConfig, ...config });
  expect(results).toHaveNoViolations();
};

/**
 * Test specific accessibility rules
 */
export const testSpecificA11yRules = async (
  component: ReactElement,
  rules: string[]
): Promise<void> => {
  const { container } = renderWithProviders(component);
  const results = await axe(container, {
    ...axeConfig,
    rules: rules.reduce((acc, rule) => ({
      ...acc,
      [rule]: { enabled: true }
    }), {}),
  });
  expect(results).toHaveNoViolations();
};

/**
 * Check for keyboard navigation support
 */
export const testKeyboardNavigation = (container: HTMLElement): void => {
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  // All interactive elements should be focusable
  focusableElements.forEach((element) => {
    expect(element).not.toHaveAttribute('tabindex', '-1');
  });
};

/**
 * Check for proper ARIA attributes
 */
export const testAriaAttributes = (container: HTMLElement): void => {
  // Check for proper ARIA labeling
  const interactiveElements = container.querySelectorAll(
    'button, [role="button"], input, select, textarea'
  );
  
  interactiveElements.forEach((element) => {
    const hasAriaLabel = element.hasAttribute('aria-label');
    const hasAriaLabelledBy = element.hasAttribute('aria-labelledby');
    const hasAssociatedLabel = element.id && 
      container.querySelector(`label[for="${element.id}"]`);
    
    // Interactive elements should have accessible names
    if (!hasAriaLabel && !hasAriaLabelledBy && !hasAssociatedLabel) {
      const textContent = element.textContent?.trim();
      expect(textContent).toBeTruthy();
    }
  });
};

/**
 * Test color contrast compliance
 */
export const testColorContrast = async (component: ReactElement): Promise<void> => {
  await testSpecificA11yRules(component, ['color-contrast']);
};

/**
 * Test semantic HTML structure
 */
export const testSemanticStructure = (container: HTMLElement): void => {
  // Check for proper heading hierarchy
  const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
  let previousLevel = 0;
  
  headings.forEach((heading) => {
    const currentLevel = parseInt(heading.tagName.charAt(1));
    
    // Heading levels should not skip (h1 -> h3 without h2)
    if (previousLevel > 0) {
      expect(currentLevel).toBeLessThanOrEqual(previousLevel + 1);
    }
    
    previousLevel = currentLevel;
  });
  
  // Check for proper landmark usage
  const main = container.querySelector('main');
  const nav = container.querySelector('nav');
  const header = container.querySelector('header');
  const footer = container.querySelector('footer');
  
  // Log semantic structure for debugging
  console.debug('Semantic structure:', {
    hasMain: !!main,
    hasNav: !!nav,
    hasHeader: !!header,
    hasFooter: !!footer,
    headingCount: headings.length,
  });
};

/**
 * Test form accessibility
 */
export const testFormAccessibility = (container: HTMLElement): void => {
  const inputs = container.querySelectorAll('input, select, textarea');
  
  inputs.forEach((input) => {
    // Form controls should have labels
    const hasLabel = input.id && container.querySelector(`label[for="${input.id}"]`);
    const hasAriaLabel = input.hasAttribute('aria-label');
    const hasAriaLabelledBy = input.hasAttribute('aria-labelledby');
    
    expect(hasLabel || hasAriaLabel || hasAriaLabelledBy).toBeTruthy();
    
    // Required fields should be marked
    if (input.hasAttribute('required')) {
      expect(
        input.hasAttribute('aria-required') ||
        input.hasAttribute('aria-invalid') ||
        container.textContent?.includes('required') ||
        container.textContent?.includes('*')
      ).toBeTruthy();
    }
  });
};

/**
 * Test component focus management
 */
export const testFocusManagement = (container: HTMLElement): void => {
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"], [role="tab"]'
  );
  
  // Should have at least one focusable element if interactive
  if (focusableElements.length > 0) {
    // First focusable element should be reachable
    const firstFocusable = focusableElements[0] as HTMLElement;
    firstFocusable.focus();
    expect(document.activeElement).toBe(firstFocusable);
  }
};

/**
 * Test screen reader support
 */
export const testScreenReaderSupport = (container: HTMLElement): void => {
  // Check for appropriate ARIA roles
  const elementsWithRoles = container.querySelectorAll('[role]');
  
  elementsWithRoles.forEach((element) => {
    const role = element.getAttribute('role');
    
    // Common valid ARIA roles
    const validRoles = [
      'button', 'link', 'textbox', 'checkbox', 'radio', 'combobox',
      'listbox', 'option', 'tab', 'tabpanel', 'dialog', 'alertdialog',
      'alert', 'status', 'progressbar', 'slider', 'spinbutton',
      'menu', 'menuitem', 'menubar', 'tree', 'treeitem', 'grid',
      'gridcell', 'rowheader', 'columnheader', 'row', 'table',
      'navigation', 'main', 'banner', 'contentinfo', 'complementary',
      'region', 'article', 'section', 'search', 'form', 'group'
    ];
    
    expect(validRoles).toContain(role);
  });
  
  // Check for proper live regions
  const liveRegions = container.querySelectorAll('[aria-live]');
  liveRegions.forEach((region) => {
    const liveValue = region.getAttribute('aria-live');
    expect(['polite', 'assertive', 'off']).toContain(liveValue);
  });
};

/**
 * Comprehensive accessibility test suite
 */
export const runFullAccessibilityTests = async (
  component: ReactElement,
  options: {
    skipAxe?: boolean;
    skipKeyboard?: boolean;
    skipAria?: boolean;
    skipSemantic?: boolean;
    skipForm?: boolean;
    skipFocus?: boolean;
    skipScreenReader?: boolean;
  } = {}
): Promise<void> => {
  const { container } = renderWithProviders(component);
  
  if (!options.skipAxe) {
    await testAccessibility(component);
  }
  
  if (!options.skipKeyboard) {
    testKeyboardNavigation(container);
  }
  
  if (!options.skipAria) {
    testAriaAttributes(container);
  }
  
  if (!options.skipSemantic) {
    testSemanticStructure(container);
  }
  
  if (!options.skipForm) {
    testFormAccessibility(container);
  }
  
  if (!options.skipFocus) {
    testFocusManagement(container);
  }
  
  if (!options.skipScreenReader) {
    testScreenReaderSupport(container);
  }
};

/**
 * Test component with various accessibility scenarios
 */
export const testAccessibilityScenarios = async (
  component: ReactElement,
  scenarios: {
    withKeyboard?: boolean;
    withScreenReader?: boolean;
    withReducedMotion?: boolean;
    withHighContrast?: boolean;
    withLargeText?: boolean;
  } = {}
): Promise<void> => {
  const { container } = renderWithProviders(component);
  
  // Test with reduced motion preference
  if (scenarios.withReducedMotion) {
    // Mock prefers-reduced-motion
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => {
        if (query.includes('prefers-reduced-motion')) {
          return {
            matches: true,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => {},
          };
        }
        return {
          matches: false,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => {},
        };
      },
    });
  }
  
  // Test with high contrast mode
  if (scenarios.withHighContrast) {
    // Mock high contrast preferences
    document.body.classList.add('high-contrast');
  }
  
  // Test with large text
  if (scenarios.withLargeText) {
    document.body.style.fontSize = '20px';
  }
  
  // Run accessibility tests
  await testAccessibility(component);
  
  // Cleanup
  if (scenarios.withHighContrast) {
    document.body.classList.remove('high-contrast');
  }
  
  if (scenarios.withLargeText) {
    document.body.style.fontSize = '';
  }
};

/**
 * Generate accessibility report
 */
export const generateAccessibilityReport = async (
  component: ReactElement,
  componentName: string
): Promise<any> => {
  const { container } = renderWithProviders(component);
  const results = await axe(container, axeConfig);
  
  return {
    componentName,
    violationCount: results.violations.length,
    violations: results.violations,
    passes: results.passes.length,
    incomplete: results.incomplete.length,
    timestamp: new Date().toISOString(),
    testedRules: Object.keys(axeConfig.rules),
  };
};

// Export all accessibility testing utilities
export const accessibilityUtils = {
  testAccessibility,
  testAccessibilityWithConfig,
  testSpecificA11yRules,
  testKeyboardNavigation,
  testAriaAttributes,
  testColorContrast,
  testSemanticStructure,
  testFormAccessibility,
  testFocusManagement,
  testScreenReaderSupport,
  runFullAccessibilityTests,
  testAccessibilityScenarios,
  generateAccessibilityReport,
  axeConfig,
};

export default accessibilityUtils;