/**
 * React Testing Library Setup for Vitest
 * 
 * This file configures React Testing Library to work properly with vitest's jsdom environment.
 * It ensures the DOM container is available and properly configured before any tests run.
 */

import '@testing-library/jest-dom'
import { configure } from '@testing-library/react'
import { vi, beforeEach, afterEach } from 'vitest'

// Configure React Testing Library
configure({
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 15000,
  computedStyleSupportsPseudoElements: true,
  defaultHidden: false,
  showOriginalStackTrace: false,
})

// Ensure DOM container is properly set up before each test
beforeEach(() => {
  // Ensure we have a proper document structure
  if (!document.body) {
    document.body = document.createElement('body')
    document.documentElement.appendChild(document.body)
  }
  
  // Clear the body for each test
  document.body.innerHTML = ''
  
  // Create a root container div for React Testing Library
  const container = document.createElement('div')
  container.setAttribute('id', 'root')
  document.body.appendChild(container)
  
  // Ensure head element exists
  if (!document.head) {
    const head = document.createElement('head')
    document.documentElement.insertBefore(head, document.body)
  }
})

// Clean up after each test
afterEach(() => {
  // Clear the DOM
  if (document.body) {
    document.body.innerHTML = ''
  }
  
  // Clear all timers
  vi.clearAllTimers()
})

// Add essential DOM polyfills that React components might need
if (typeof window !== 'undefined') {
  // Mock matchMedia if not available
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  }

  // Mock scrollTo if not available
  if (!window.scrollTo) {
    window.scrollTo = vi.fn()
  }

  // Mock ResizeObserver
  if (!global.ResizeObserver) {
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }))
  }

  // Mock IntersectionObserver
  if (!global.IntersectionObserver) {
    global.IntersectionObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }))
  }

  // Mock requestAnimationFrame
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = vi.fn().mockImplementation((callback) => 
      setTimeout(callback, 16)
    )
  }

  if (!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = vi.fn().mockImplementation((id) => 
      clearTimeout(id)
    )
  }

  // Mock getComputedStyle
  if (!window.getComputedStyle) {
    window.getComputedStyle = vi.fn().mockImplementation(() => ({
      getPropertyValue: vi.fn().mockReturnValue(''),
      setProperty: vi.fn(),
      removeProperty: vi.fn(),
    }))
  }
}

// Add essential Element polyfills
if (typeof Element !== 'undefined') {
  // Mock getBoundingClientRect
  if (!Element.prototype.getBoundingClientRect) {
    Element.prototype.getBoundingClientRect = vi.fn().mockImplementation(() => ({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      toJSON: vi.fn(),
    }))
  }

  // Mock scrollIntoView
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn()
  }
}

// Mock HTMLElement methods if needed
if (typeof HTMLElement !== 'undefined') {
  if (!HTMLElement.prototype.click) {
    HTMLElement.prototype.click = vi.fn()
  }
  
  if (!HTMLElement.prototype.focus) {
    HTMLElement.prototype.focus = vi.fn()
  }
  
  if (!HTMLElement.prototype.blur) {
    HTMLElement.prototype.blur = vi.fn()
  }
}

console.log('✅ React Testing Library setup completed successfully')