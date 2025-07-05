/**
 * React Test Environment Setup
 * 
 * This file configures the DOM environment for React component testing.
 * It ensures that jsdom is properly initialized and DOM APIs are available
 * before React Testing Library attempts to render components.
 */

import '@testing-library/jest-dom'
import { configure } from '@testing-library/react'
import { vi } from 'vitest'

// Configure React Testing Library
configure({
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 15000, // Increased for stability
  computedStyleSupportsPseudoElements: true,
  defaultHidden: false,
  showOriginalStackTrace: false,
})

// Ensure DOM APIs are available - work with vitest's jsdom environment
// Instead of overriding vitest's jsdom, enhance it if needed
if (typeof document === 'undefined' || typeof window === 'undefined') {
  console.error('❌ DOM environment not available! Vitest jsdom environment may not be properly initialized.')
  throw new Error('DOM environment required for React component tests')
}

// Enhance the existing DOM environment with missing APIs
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  // Ensure document.body exists
  if (!document.body) {
    document.body = document.createElement('body')
    document.documentElement.appendChild(document.body)
  }
  
  // Ensure we have a proper HTML structure
  if (!document.documentElement.querySelector('head')) {
    const head = document.createElement('head')
    document.documentElement.insertBefore(head, document.body)
  }
}

// Enhanced DOM polyfills for React components
// Note: Core browser APIs are now handled by comprehensive-browser-environment.ts
// This section now only handles React-specific enhancements that may need customization

if (typeof window !== 'undefined') {
  console.log('✅ React test environment: Browser APIs available via comprehensive environment')
  
  // React-specific enhancements can be added here if needed
  // Most browser APIs are now handled by the comprehensive system
}

// Mock Next.js router for component tests
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  pathname: '/',
  route: '/',
  query: {},
  asPath: '/',
  basePath: '',
  isLocaleDomain: false,
  isReady: true,
  locale: 'en',
  locales: ['en'],
  defaultLocale: 'en',
  domainLocales: [],
  isPreview: false,
  events: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  },
  beforePopState: vi.fn(),
  reload: vi.fn(),
}

// Mock next/router
vi.mock('next/router', () => ({
  useRouter: () => mockRouter,
  withRouter: (component: any) => component,
  Router: mockRouter,
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  redirect: vi.fn(),
  permanentRedirect: vi.fn(),
  notFound: vi.fn(),
}))

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => {
    // Use React.createElement to avoid JSX syntax issues in .ts file
    const React = require('react')
    return React.createElement('img', { src, alt, ...props })
  },
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => {
    // Use React.createElement to avoid JSX syntax issues in .ts file
    const React = require('react')
    return React.createElement('a', { href, ...props }, children)
  },
}))

// Cleanup function to reset DOM state between tests
export const cleanupDOMState = () => {
  if (typeof document !== 'undefined') {
    document.body.innerHTML = ''
    
    // Clear any timers
    if (typeof window !== 'undefined') {
      // Clear all timeouts/intervals (be careful not to clear vitest's timers)
      const highestTimeoutId = setTimeout(() => {}, 0)
      for (let i = 0; i < highestTimeoutId; i++) {
        clearTimeout(i)
        clearInterval(i)
      }
      clearTimeout(highestTimeoutId)
    }
  }
}

// Export useful testing utilities
export const testingUtilities = {
  // Wait for DOM updates
  waitForDOMUpdate: () => new Promise(resolve => setTimeout(resolve, 0)),
  
  // Trigger a React render cycle
  triggerRerender: () => new Promise(resolve => setTimeout(resolve, 16)),
  
  // Mock a component ref
  createMockRef: <T = any>(initialValue?: T) => ({
    current: initialValue || null,
  }),
  
  // Create mock event
  createMockEvent: (type: string, properties = {}) => ({
    type,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    target: document.createElement('div'),
    currentTarget: document.createElement('div'),
    ...properties,
  }),
}

console.log('✅ React test environment initialized successfully')