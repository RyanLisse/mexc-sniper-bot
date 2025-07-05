/**
 * Minimal React Test Setup
 * 
 * This file provides the minimal setup needed for React component testing with vitest and jsdom.
 * It focuses solely on fixing the "document is not defined" and "appendChild" errors.
 */

import '@testing-library/jest-dom'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

// Configure React Testing Library before anything else
configure({
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 15000,
  // This is the key fix - configure a custom container function
  getElementError: (message, container) => {
    const error = new Error(message)
    error.name = 'TestingLibraryElementError'
    error.stack = undefined
    return error
  },
})

// Ensure DOM is properly set up before each test
beforeEach(() => {
  // Ensure we have a proper document structure
  if (typeof document !== 'undefined') {
    // Make sure document.body exists
    if (!document.body) {
      document.body = document.createElement('body')
      document.documentElement.appendChild(document.body)
    }
    
    // Clear body content
    document.body.innerHTML = ''
    
    // Create a div to serve as React Testing Library's container
    const testContainer = document.createElement('div')
    testContainer.setAttribute('id', 'test-container')
    document.body.appendChild(testContainer)
    
    // Ensure document.head exists
    if (!document.head) {
      const head = document.createElement('head')
      document.documentElement.insertBefore(head, document.body)
    }
  }
})

// Essential DOM APIs that React components might need
if (typeof window !== 'undefined') {
  // Mock matchMedia
  window.matchMedia = window.matchMedia || vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))

  // Mock ResizeObserver
  global.ResizeObserver = global.ResizeObserver || class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  // Mock IntersectionObserver
  global.IntersectionObserver = global.IntersectionObserver || class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// Clean up after each test
afterEach(() => {
  cleanup()
  // Clean up DOM state safely
  if (typeof document !== 'undefined' && document.body) {
    document.body.innerHTML = ''
  }
})

console.log('✅ Minimal React test setup loaded')