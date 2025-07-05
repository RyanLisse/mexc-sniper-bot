/**
 * React DOM Fix for Vitest
 * 
 * This is the definitive fix for React component testing in vitest.
 * It ensures the DOM environment is properly set up for React Testing Library.
 */

import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { vi, beforeEach, afterEach } from 'vitest'

// Fix 1: Ensure document.body exists before React Testing Library tries to use it
beforeEach(() => {
  // Make sure we have a proper DOM structure
  if (!document.body) {
    const body = document.createElement('body')
    document.documentElement.appendChild(body)
  }
  
  // Clear body for clean test state
  document.body.innerHTML = ''
  
  // Add a root container that React Testing Library can use
  const container = document.createElement('div')
  container.id = 'root'
  document.body.appendChild(container)
})

// Fix 2: Clean up after each test
afterEach(() => {
  cleanup()
  if (document.body) {
    document.body.innerHTML = ''
  }
})

// Fix 3: Add essential polyfills for React components
if (typeof window !== 'undefined') {
  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}