# Comprehensive Browser Environment Mocking Guide

## Overview

This project uses a comprehensive browser environment mocking system to ensure reliable testing of React components and browser-dependent code in Node.js environments. The system provides complete simulation of browser APIs and modern web features.

## Architecture

### Core System: `comprehensive-browser-environment.ts`

The main browser environment mocking system that provides:

- **Complete DOM APIs** - Document, Element, Event handling
- **Storage APIs** - localStorage, sessionStorage, indexedDB
- **Network APIs** - fetch, WebSocket, XMLHttpRequest, EventSource
- **Media APIs** - Canvas, Audio, Video, Image
- **Device APIs** - Geolocation, Permissions, Vibration
- **Modern Web APIs** - Observers, Workers, Crypto, Notifications
- **Performance APIs** - Performance timing, Navigation
- **CSS & Styling APIs** - CSS Object, MediaQuery, DOMRect
- **Event APIs** - Event constructors, Custom events
- **File & Blob APIs** - FileReader, File, Blob, FormData
- **URL APIs** - URL, URLSearchParams
- **Web Components** - Custom Elements, Shadow DOM

### Integration Points

1. **Vitest Setup (`vitest-setup.ts`)**
   - Initializes comprehensive browser environment in `beforeAll` hook
   - Cleans up in `afterAll` hook
   - Coordinates with unified mock system

2. **React Test Environment (`react-test-environment.ts`)**
   - Provides React-specific enhancements
   - Handles Next.js component mocking
   - Focuses on React Testing Library integration

3. **Component Helpers (`component-helpers.ts`)**
   - Provides legacy compatibility functions
   - Maintains backwards compatibility with existing tests
   - Component-specific testing utilities

## Usage

### Automatic Initialization

The browser environment is automatically initialized for all tests through the Vitest setup. No manual setup required.

```typescript
// Tests automatically have access to all browser APIs
describe('MyComponent', () => {
  it('should use browser APIs', () => {
    // All browser APIs are available:
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const observer = new IntersectionObserver(() => {})
    const url = new URL('https://example.com')
    // etc.
  })
})
```

### Available APIs

#### DOM APIs
- `document.*` - Complete document interface
- `window.*` - Complete window interface
- `Element.*` - All element methods and properties
- Event handling and dispatch

#### Storage
- `localStorage` - Full localStorage implementation
- `sessionStorage` - Full sessionStorage implementation
- `indexedDB` - IndexedDB mock

#### Network
- `fetch()` - Complete fetch API
- `WebSocket` - WebSocket implementation
- `XMLHttpRequest` - XHR implementation
- `EventSource` - Server-sent events

#### Observers
- `ResizeObserver` - Element resize observation
- `IntersectionObserver` - Element intersection observation
- `MutationObserver` - DOM mutation observation
- `PerformanceObserver` - Performance monitoring

#### Media & Canvas
- `HTMLCanvasElement` - Canvas element with 2D context
- `Audio` - Audio element implementation
- `Image` - Image element implementation
- Canvas 2D context with all drawing methods

#### Modern APIs
- `crypto` - Web Crypto API with subtle crypto
- `navigator.*` - Complete navigator interface
- `geolocation` - Geolocation API
- `clipboard` - Clipboard API
- `permissions` - Permissions API

#### File & Blob
- `FileReader` - File reading functionality
- `File` - File constructor and methods
- `Blob` - Blob constructor and methods
- `FormData` - Form data handling

#### URL & Navigation
- `URL` - URL constructor with all properties
- `URLSearchParams` - URL search parameters
- `history` - Browser history API
- `location` - Window location API

#### Performance
- `performance.now()` - High-resolution timing
- Navigation timing API
- Resource timing API
- Performance marks and measures

## Configuration

### Disabling Specific APIs

If you need to disable specific APIs for certain tests:

```typescript
// In your test file
beforeEach(() => {
  // Temporarily disable an API
  delete (global as any).IntersectionObserver
})

afterEach(() => {
  // Re-enable via comprehensive environment
  initializeComprehensiveBrowserEnvironment()
})
```

### Custom API Implementations

For test-specific API behavior:

```typescript
// Override specific methods
beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ test: 'data' })
  })
})
```

## Migration from Legacy Mocks

### Before (Legacy System)
```typescript
import { mockWindowMethods, mockIntersectionObserver } from '../utils/component-helpers'

beforeEach(() => {
  mockWindowMethods()
  mockIntersectionObserver()
  // Manual setup for each API
})
```

### After (Comprehensive System)
```typescript
// No setup needed - everything is automatically available
describe('MyComponent', () => {
  it('works with all browser APIs', () => {
    // All APIs available automatically
  })
})
```

## Recent Fixes and Improvements

### ✅ FIXED: React Testing Library DOM Container Issues

**Problem Resolved**: The comprehensive browser environment was previously overriding real jsdom DOM APIs with mock implementations, causing React Testing Library to fail with "Target container is not a DOM element" errors.

**Solution Implemented**: 
- Modified `mockDOMAPIs()` and `mockWindowAPIs()` to detect when real jsdom environment is available
- Skips DOM API mocking when React Testing Library needs real DOM elements
- Preserves jsdom functionality while adding missing browser APIs

**Result**: React Testing Library now works correctly with all browser APIs available.

### ✅ FIXED: Function Iteration Errors

**Problem Resolved**: Mock React state hooks were incorrectly returning functions instead of actual values, causing "function is not iterable" errors.

**Solution Implemented**: 
- Fixed React state hook mocking in test components
- Changed from `vi.fn().mockReturnValue([...])` to actual values
- Proper separation of state values and setter functions

**Result**: Components can now properly iterate over data structures.

## Troubleshooting

### Common Issues

1. **API Not Available**
   - Check if the API is included in the comprehensive system
   - Verify the vitest setup is loading properly
   - Look for console logs indicating successful initialization

2. **Mock Conflicts**
   - Ensure legacy mock functions aren't overriding the comprehensive system
   - Check for duplicate API mocking in test files

3. **Performance Issues**
   - The comprehensive system is optimized for performance
   - If you notice slowdowns, check for infinite loops in mock functions

4. **React Testing Library Issues** ✅ RESOLVED
   - ~~DOM container errors~~ - **FIXED**: jsdom compatibility implemented
   - ~~Function iteration errors~~ - **FIXED**: Proper state hook mocking

### Debug Mode

Enable debug logging:

```typescript
// In your test
beforeAll(() => {
  console.log('Browser APIs available:', {
    fetch: !!global.fetch,
    ResizeObserver: !!global.ResizeObserver,
    crypto: !!global.crypto,
    // etc.
  })
})
```

## API Coverage

### ✅ Fully Implemented
- DOM APIs (Document, Element, Event)
- Storage APIs (localStorage, sessionStorage, indexedDB)  
- Network APIs (fetch, WebSocket, XMLHttpRequest)
- Observer APIs (Resize, Intersection, Mutation, Performance)
- Media APIs (Canvas, Audio, Image)
- Crypto APIs (WebCrypto, random functions)
- File APIs (FileReader, File, Blob, FormData)
- URL APIs (URL, URLSearchParams)
- Performance APIs (timing, navigation)
- Event APIs (Event, CustomEvent, Mouse, Keyboard, Touch)
- CSS APIs (CSS object, MediaQuery, DOMRect)

### 🚧 Partially Implemented  
- Web Components (basic Shadow DOM)
- Worker APIs (basic implementation)
- Notification APIs (basic implementation)

### ❌ Not Yet Implemented
- WebRTC APIs
- Payment Request API
- Web Authentication API
- Background Sync

## Contributing

To add new browser APIs:

1. Add the mock implementation to `comprehensive-browser-environment.ts`
2. Group by functionality (DOM, Network, Media, etc.)
3. Include comprehensive method coverage
4. Add JSDoc documentation
5. Update this guide with the new APIs

## Performance Considerations

The comprehensive system is designed for optimal performance:

- Lazy initialization of complex objects
- Efficient memory usage with proper cleanup
- Minimal overhead for unused APIs
- Optimized for test speed and reliability

## Best Practices

1. **Don't Override Unless Necessary** - The comprehensive system should handle most use cases
2. **Clean Up Test-Specific Mocks** - Use `afterEach` to reset any custom mocks
3. **Use Specific Assertions** - Test against the actual API behavior, not mock implementation details
4. **Report Missing APIs** - If you need an API that's not implemented, create an issue or PR