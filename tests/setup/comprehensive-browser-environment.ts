/**
 * Comprehensive Browser Environment Mocking System
 * 
 * This module provides complete browser API simulation for testing environments.
 * It mocks all DOM APIs, browser-specific features, and modern web APIs that
 * components might use, ensuring tests run reliably in Node.js environments.
 * 
 * COVERAGE:
 * - DOM APIs (Document, Element, Event handling)
 * - Storage APIs (localStorage, sessionStorage, indexedDB)
 * - Network APIs (fetch, WebSocket, XMLHttpRequest) 
 * - Media APIs (Canvas, Audio, Video, WebRTC)
 * - Device APIs (Geolocation, DeviceMotion, Permissions)
 * - Modern Web APIs (Observers, Workers, Crypto)
 * - Performance APIs (Performance, Navigation Timing)
 * - And much more...
 */

import { vi } from 'vitest'

// ============================================================================
// CORE DOM APIs
// ============================================================================

export const mockDOMAPIs = () => {
  // CRITICAL FIX: Don't override DOM APIs when jsdom is available
  // React Testing Library needs real DOM elements, not mocks
  if (typeof document !== 'undefined' && document.createElement && 
      typeof document.createElement('div').appendChild === 'function') {
    console.log('🚫 Skipping DOM API mocking - real jsdom DOM is available and required for React Testing Library')
    return
  }

  console.log('📝 Initializing DOM API mocks (jsdom not available)')
  
  // Enhanced Document Mock
  const mockDocument = {
    // Properties
    documentElement: {
      style: {},
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(() => false),
        toggle: vi.fn(),
      },
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      insertBefore: vi.fn(),
      querySelector: vi.fn(() => null),
      querySelectorAll: vi.fn(() => []),
      getBoundingClientRect: vi.fn(() => ({
        x: 0, y: 0, width: 1024, height: 768,
        top: 0, right: 1024, bottom: 768, left: 0,
        toJSON: vi.fn()
      })),
      scrollIntoView: vi.fn(),
      focus: vi.fn(),
      blur: vi.fn(),
      click: vi.fn(),
    },
    body: {
      style: {},
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(() => false),
        toggle: vi.fn(),
      },
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      insertBefore: vi.fn(),
      querySelector: vi.fn(() => null),
      querySelectorAll: vi.fn(() => []),
      getBoundingClientRect: vi.fn(() => ({
        x: 0, y: 0, width: 1024, height: 768,
        top: 0, right: 1024, bottom: 768, left: 0,
        toJSON: vi.fn()
      })),
      scrollIntoView: vi.fn(),
      focus: vi.fn(),
      blur: vi.fn(),
      click: vi.fn(),
      scrollTop: 0,
      scrollLeft: 0,
      scrollHeight: 768,
      scrollWidth: 1024,
      clientHeight: 768,
      clientWidth: 1024,
      offsetHeight: 768,
      offsetWidth: 1024,
    },
    head: {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      insertBefore: vi.fn(),
      querySelector: vi.fn(() => null),
      querySelectorAll: vi.fn(() => []),
    },
    
    // Methods
    createElement: vi.fn((tagName: string) => ({
      tagName: tagName.toUpperCase(),
      style: {},
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(() => false),
        toggle: vi.fn(),
      },
      setAttribute: vi.fn(),
      getAttribute: vi.fn(() => null),
      removeAttribute: vi.fn(),
      hasAttribute: vi.fn(() => false),
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      insertBefore: vi.fn(),
      querySelector: vi.fn(() => null),
      querySelectorAll: vi.fn(() => []),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
      getBoundingClientRect: vi.fn(() => ({
        x: 0, y: 0, width: 100, height: 50,
        top: 0, right: 100, bottom: 50, left: 0,
        toJSON: vi.fn()
      })),
      scrollIntoView: vi.fn(),
      focus: vi.fn(),
      blur: vi.fn(),
      click: vi.fn(),
      innerHTML: '',
      textContent: '',
      value: '',
      checked: false,
      disabled: false,
      hidden: false,
      id: '',
      className: '',
      dataset: {},
      parentNode: null,
      childNodes: [],
      children: [],
      firstChild: null,
      lastChild: null,
      nextSibling: null,
      previousSibling: null,
      offsetParent: null,
      offsetTop: 0,
      offsetLeft: 0,
      offsetWidth: 100,
      offsetHeight: 50,
      clientWidth: 100,
      clientHeight: 50,
      scrollWidth: 100,
      scrollHeight: 50,
      scrollTop: 0,
      scrollLeft: 0,
    })),
    
    createElementNS: vi.fn((namespace: string, tagName: string) => mockDocument.createElement(tagName)),
    createTextNode: vi.fn((text: string) => ({
      nodeType: 3,
      textContent: text,
      parentNode: null,
      nextSibling: null,
      previousSibling: null,
    })),
    createDocumentFragment: vi.fn(() => ({
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      insertBefore: vi.fn(),
      querySelector: vi.fn(() => null),
      querySelectorAll: vi.fn(() => []),
      childNodes: [],
      children: [],
    })),
    
    getElementById: vi.fn(() => null),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    getElementsByTagName: vi.fn(() => []),
    getElementsByClassName: vi.fn(() => []),
    getElementsByName: vi.fn(() => []),
    
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
    
    // Properties
    URL: 'http://localhost:3000',
    domain: 'localhost',
    referrer: '',
    title: 'Test Document',
    cookie: '',
    readyState: 'complete',
    hidden: false,
    visibilityState: 'visible',
    
    // Focus management
    activeElement: null,
    hasFocus: vi.fn(() => true),
    
    // Selection
    getSelection: vi.fn(() => ({
      toString: vi.fn(() => ''),
      rangeCount: 0,
      getRangeAt: vi.fn(),
      removeAllRanges: vi.fn(),
      addRange: vi.fn(),
    })),
    
    // Viewport
    elementFromPoint: vi.fn(() => null),
    elementsFromPoint: vi.fn(() => []),
    
    // Fullscreen
    fullscreenElement: null,
    exitFullscreen: vi.fn(() => Promise.resolve()),
    
    // Picture-in-Picture
    pictureInPictureElement: null,
    exitPictureInPicture: vi.fn(() => Promise.resolve()),
  }

  Object.defineProperty(global, 'document', {
    value: mockDocument,
    writable: true,
  })
}

// ============================================================================
// WINDOW & GLOBAL APIs
// ============================================================================

export const mockWindowAPIs = () => {
  // CRITICAL FIX: Don't override window when jsdom is available
  // React Testing Library needs real window object, not mocks
  if (typeof window !== 'undefined' && window.document && 
      typeof window.document.createElement === 'function') {
    console.log('🚫 Skipping window API mocking - real jsdom window is available and required for React Testing Library')
    
    // Only add missing APIs that jsdom might not have
    if (!window.matchMedia) {
      window.matchMedia = vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
      }))
    }
    
    return
  }

  console.log('📝 Initializing window API mocks (jsdom not available)')
  
  const mockLocation = {
    href: 'http://localhost:3000/',
    protocol: 'http:',
    host: 'localhost:3000',
    hostname: 'localhost',
    port: '3000',
    pathname: '/',
    search: '',
    hash: '',
    origin: 'http://localhost:3000',
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
    toString: vi.fn(() => 'http://localhost:3000/'),
  }

  const mockHistory = {
    length: 1,
    state: null,
    pushState: vi.fn(),
    replaceState: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    go: vi.fn(),
  }

  const mockNavigator = {
    userAgent: 'Mozilla/5.0 (Test Environment) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    language: 'en-US',
    languages: ['en-US', 'en'],
    platform: 'Test',
    cookieEnabled: true,
    onLine: true,
    hardwareConcurrency: 4,
    maxTouchPoints: 0,
    vendor: 'Test',
    vendorSub: '',
    product: 'Gecko',
    productSub: '20030107',
    appName: 'Netscape',
    appVersion: '5.0 (Test Environment)',
    appCodeName: 'Mozilla',
    doNotTrack: null,
    
    // Permissions API
    permissions: {
      query: vi.fn(() => Promise.resolve({
        state: 'granted',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    },
    
    // Geolocation API
    geolocation: {
      getCurrentPosition: vi.fn((success, error) => {
        success({
          coords: {
            latitude: 40.7128,
            longitude: -74.0060,
            accuracy: 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        })
      }),
      watchPosition: vi.fn(() => 1),
      clearWatch: vi.fn(),
    },
    
    // Clipboard API
    clipboard: {
      readText: vi.fn(() => Promise.resolve('')),
      writeText: vi.fn(() => Promise.resolve()),
      read: vi.fn(() => Promise.resolve([])),
      write: vi.fn(() => Promise.resolve()),
    },
    
    // Share API
    share: vi.fn(() => Promise.resolve()),
    canShare: vi.fn(() => true),
    
    // Service Worker
    serviceWorker: {
      register: vi.fn(() => Promise.resolve({
        installing: null,
        waiting: null,
        active: null,
        scope: '/',
        update: vi.fn(() => Promise.resolve()),
        unregister: vi.fn(() => Promise.resolve(true)),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
      ready: Promise.resolve({
        installing: null,
        waiting: null,
        active: null,
        scope: '/',
        update: vi.fn(() => Promise.resolve()),
        unregister: vi.fn(() => Promise.resolve(true)),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
      controller: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    
    // Media Devices
    mediaDevices: {
      getUserMedia: vi.fn(() => Promise.resolve({
        getTracks: vi.fn(() => []),
        getAudioTracks: vi.fn(() => []),
        getVideoTracks: vi.fn(() => []),
        addTrack: vi.fn(),
        removeTrack: vi.fn(),
        clone: vi.fn(() => ({})),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
      enumerateDevices: vi.fn(() => Promise.resolve([])),
      getDisplayMedia: vi.fn(() => Promise.resolve({})),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  }

  const mockScreen = {
    width: 1920,
    height: 1080,
    availWidth: 1920,
    availHeight: 1080,
    colorDepth: 24,
    pixelDepth: 24,
    orientation: {
      angle: 0,
      type: 'landscape-primary',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  }

  const mockWindow = {
    // Basic properties
    innerWidth: 1024,
    innerHeight: 768,
    outerWidth: 1024,
    outerHeight: 768,
    screenX: 0,
    screenY: 0,
    scrollX: 0,
    scrollY: 0,
    pageXOffset: 0,
    pageYOffset: 0,
    
    // Objects
    location: mockLocation,
    history: mockHistory,
    navigator: mockNavigator,
    screen: mockScreen,
    
    // Methods
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
    
    // Timers
    setTimeout: global.setTimeout,
    clearTimeout: global.clearTimeout,
    setInterval: global.setInterval,
    clearInterval: global.clearInterval,
    
    // Animation
    requestAnimationFrame: vi.fn((callback) => {
      return setTimeout(() => callback(Date.now()), 16)
    }),
    cancelAnimationFrame: vi.fn((id) => clearTimeout(id)),
    
    // Idle
    requestIdleCallback: vi.fn((callback) => {
      return setTimeout(() => callback({
        timeRemaining: () => 16,
        didTimeout: false,
      }), 16)
    }),
    cancelIdleCallback: vi.fn((id) => clearTimeout(id)),
    
    // Scrolling
    scroll: vi.fn(),
    scrollTo: vi.fn(),
    scrollBy: vi.fn(),
    
    // Focus
    focus: vi.fn(),
    blur: vi.fn(),
    
    // Sizing and positioning
    open: vi.fn(() => mockWindow),
    close: vi.fn(),
    resizeTo: vi.fn(),
    resizeBy: vi.fn(),
    moveTo: vi.fn(),
    moveBy: vi.fn(),
    
    // Dialogs
    alert: vi.fn(),
    confirm: vi.fn(() => true),
    prompt: vi.fn(() => ''),
    
    // Base64
    btoa: (str: string) => Buffer.from(str, 'binary').toString('base64'),
    atob: (str: string) => Buffer.from(str, 'base64').toString('binary'),
    
    // Post message
    postMessage: vi.fn(),
    
    // Print
    print: vi.fn(),
    
    // Selection
    getSelection: vi.fn(() => ({
      toString: vi.fn(() => ''),
      rangeCount: 0,
      getRangeAt: vi.fn(),
      removeAllRanges: vi.fn(),
      addRange: vi.fn(),
    })),
    
    // Computed styles
    getComputedStyle: vi.fn(() => ({
      getPropertyValue: vi.fn(() => ''),
      setProperty: vi.fn(),
      removeProperty: vi.fn(),
      cssText: '',
      length: 0,
      item: vi.fn(() => ''),
    })),
    
    // Media queries
    matchMedia: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    })),
  }

  Object.defineProperty(global, 'window', {
    value: mockWindow,
    writable: true,
  })

  // Also set global references
  Object.defineProperty(global, 'location', { value: mockLocation, writable: true })
  Object.defineProperty(global, 'history', { value: mockHistory, writable: true })
  Object.defineProperty(global, 'navigator', { value: mockNavigator, writable: true })
  Object.defineProperty(global, 'screen', { value: mockScreen, writable: true })
}

// ============================================================================
// STORAGE APIs
// ============================================================================

export const mockStorageAPIs = () => {
  // Enhanced localStorage/sessionStorage
  const createStorage = () => {
    const storage = new Map<string, string>()
    
    return {
      length: 0,
      key: vi.fn((index: number) => Array.from(storage.keys())[index] || null),
      getItem: vi.fn((key: string) => storage.get(key) || null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, String(value))
        this.length = storage.size
      }),
      removeItem: vi.fn((key: string) => {
        storage.delete(key)
        this.length = storage.size
      }),
      clear: vi.fn(() => {
        storage.clear()
        this.length = 0
      }),
    }
  }

  Object.defineProperty(global, 'localStorage', {
    value: createStorage(),
    writable: true,
  })

  Object.defineProperty(global, 'sessionStorage', {
    value: createStorage(),
    writable: true,
  })

  // IndexedDB Mock
  const mockIndexedDB = {
    open: vi.fn(() => ({
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      result: {
        createObjectStore: vi.fn(() => ({
          add: vi.fn(),
          put: vi.fn(),
          get: vi.fn(),
          delete: vi.fn(),
          clear: vi.fn(),
          openCursor: vi.fn(),
          createIndex: vi.fn(),
          deleteIndex: vi.fn(),
        })),
        deleteObjectStore: vi.fn(),
        transaction: vi.fn(() => ({
          objectStore: vi.fn(() => ({})),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
        close: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    })),
    deleteDatabase: vi.fn(() => Promise.resolve()),
    databases: vi.fn(() => Promise.resolve([])),
    cmp: vi.fn(() => 0),
  }

  Object.defineProperty(global, 'indexedDB', {
    value: mockIndexedDB,
    writable: true,
  })
}

// ============================================================================
// NETWORK APIs
// ============================================================================

export const mockNetworkAPIs = () => {
  console.log('📡 Initializing network API mocks...')
  
  // Fetch API (if not already available)
  if (!global.fetch) {
    console.log('📝 Adding fetch API mock')
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      blob: () => Promise.resolve(new Blob()),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      formData: () => Promise.resolve(new FormData()),
      clone: vi.fn(),
    })) as any
  } else {
    console.log('✅ fetch API already available')
  }

  // WebSocket (if not already available)
  if (!global.WebSocket) {
    console.log('📝 Adding WebSocket API mock')
    global.WebSocket = vi.fn().mockImplementation(() => ({
      readyState: 1, // OPEN
      url: 'ws://localhost:3000',
      protocol: '',
      extensions: '',
      bufferedAmount: 0,
      binaryType: 'blob',
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
      onopen: null,
      onclose: null,
      onmessage: null,
      onerror: null,
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
    })) as any
  } else {
    console.log('✅ WebSocket API already available')
  }

  // XMLHttpRequest (if not already available)
  if (!global.XMLHttpRequest) {
    console.log('📝 Adding XMLHttpRequest API mock')
    global.XMLHttpRequest = vi.fn().mockImplementation(() => ({
    readyState: 0,
    status: 0,
    statusText: '',
    responseType: '',
    response: '',
    responseText: '',
    responseXML: null,
    timeout: 0,
    withCredentials: false,
    upload: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    },
    open: vi.fn(),
    send: vi.fn(),
    abort: vi.fn(),
    setRequestHeader: vi.fn(),
    getResponseHeader: vi.fn(() => null),
    getAllResponseHeaders: vi.fn(() => ''),
    overrideMimeType: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
    onreadystatechange: null,
    onload: null,
    onerror: null,
    onabort: null,
    ontimeout: null,
    onprogress: null,
    UNSENT: 0,
    OPENED: 1,
    HEADERS_RECEIVED: 2,
    LOADING: 3,
    DONE: 4,
  })) as any
  } else {
    console.log('✅ XMLHttpRequest API already available')
  }

  // EventSource (Server-Sent Events)
  if (!global.EventSource) {
    console.log('📝 Adding EventSource API mock')
    global.EventSource = vi.fn().mockImplementation(() => ({
    url: '',
    readyState: 1, // OPEN
    withCredentials: false,
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
    onopen: null,
    onmessage: null,
    onerror: null,
    CONNECTING: 0,
    OPEN: 1,
    CLOSED: 2,
  })) as any
  } else {
    console.log('✅ EventSource API already available')
  }
}

// ============================================================================
// CRYPTO & SECURITY APIs
// ============================================================================

export const mockCryptoAPIs = () => {
  const mockCrypto = {
    randomUUID: vi.fn(() => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`),
    getRandomValues: vi.fn((array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256)
      }
      return array
    }),
    
    subtle: {
      encrypt: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
      decrypt: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
      sign: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
      verify: vi.fn(() => Promise.resolve(true)),
      digest: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
      generateKey: vi.fn(() => Promise.resolve({})),
      deriveKey: vi.fn(() => Promise.resolve({})),
      deriveBits: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
      importKey: vi.fn(() => Promise.resolve({})),
      exportKey: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
      wrapKey: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
      unwrapKey: vi.fn(() => Promise.resolve({})),
    },
  }

  Object.defineProperty(global, 'crypto', {
    value: mockCrypto,
    writable: true,
  })
}

// ============================================================================
// OBSERVER APIs
// ============================================================================

export const mockObserverAPIs = () => {
  console.log('👁️ Initializing Observer API mocks...')
  
  // ResizeObserver (if not already available)
  if (!global.ResizeObserver) {
    console.log('📝 Adding ResizeObserver API mock')
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    })) as any
  } else {
    console.log('✅ ResizeObserver API already available')
  }

  // IntersectionObserver (if not already available)
  if (!global.IntersectionObserver) {
    console.log('📝 Adding IntersectionObserver API mock')
    global.IntersectionObserver = vi.fn().mockImplementation(() => ({
      root: null,
      rootMargin: '0px',
      thresholds: [0],
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
      takeRecords: vi.fn(() => []),
    })) as any
  } else {
    console.log('✅ IntersectionObserver API already available')
  }

  // MutationObserver (if not already available)
  if (!global.MutationObserver) {
    console.log('📝 Adding MutationObserver API mock')
    global.MutationObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
      takeRecords: vi.fn(() => []),
    })) as any
  } else {
    console.log('✅ MutationObserver API already available')
  }

  // PerformanceObserver (if not already available)
  if (!global.PerformanceObserver) {
    console.log('📝 Adding PerformanceObserver API mock')
    global.PerformanceObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
      takeRecords: vi.fn(() => []),
    })) as any
  } else {
    console.log('✅ PerformanceObserver API already available')
  }
}

// ============================================================================
// MEDIA APIs
// ============================================================================

export const mockMediaAPIs = () => {
  // Canvas API
  const createMockCanvas = () => ({
    width: 300,
    height: 150,
    getContext: vi.fn((type: string) => {
      if (type === '2d') {
        return {
          fillStyle: '#000000',
          strokeStyle: '#000000',
          lineWidth: 1,
          font: '10px sans-serif',
          textAlign: 'start',
          textBaseline: 'alphabetic',
          globalAlpha: 1,
          globalCompositeOperation: 'source-over',
          
          save: vi.fn(),
          restore: vi.fn(),
          beginPath: vi.fn(),
          closePath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          arc: vi.fn(),
          arcTo: vi.fn(),
          bezierCurveTo: vi.fn(),
          quadraticCurveTo: vi.fn(),
          rect: vi.fn(),
          
          fill: vi.fn(),
          stroke: vi.fn(),
          clip: vi.fn(),
          
          fillRect: vi.fn(),
          strokeRect: vi.fn(),
          clearRect: vi.fn(),
          
          fillText: vi.fn(),
          strokeText: vi.fn(),
          measureText: vi.fn(() => ({ width: 0 })),
          
          drawImage: vi.fn(),
          putImageData: vi.fn(),
          getImageData: vi.fn(() => ({
            data: new Uint8ClampedArray(4),
            width: 1,
            height: 1,
          })),
          createImageData: vi.fn(() => ({
            data: new Uint8ClampedArray(4),
            width: 1,
            height: 1,
          })),
          
          scale: vi.fn(),
          rotate: vi.fn(),
          translate: vi.fn(),
          transform: vi.fn(),
          setTransform: vi.fn(),
          resetTransform: vi.fn(),
          
          createLinearGradient: vi.fn(() => ({
            addColorStop: vi.fn(),
          })),
          createRadialGradient: vi.fn(() => ({
            addColorStop: vi.fn(),
          })),
          createPattern: vi.fn(() => ({})),
        }
      }
      return null
    }),
    toDataURL: vi.fn(() => 'data:image/png;base64,'),
    toBlob: vi.fn((callback) => callback(new Blob())),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })

  // HTMLCanvasElement
  Object.defineProperty(global, 'HTMLCanvasElement', {
    value: vi.fn().mockImplementation(createMockCanvas),
    writable: true,
  })

  // Audio API
  global.Audio = vi.fn().mockImplementation(() => ({
    src: '',
    volume: 1,
    paused: true,
    duration: 0,
    currentTime: 0,
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
    load: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  })) as any

  // Image API
  global.Image = vi.fn().mockImplementation(() => ({
    src: '',
    width: 0,
    height: 0,
    naturalWidth: 0,
    naturalHeight: 0,
    complete: false,
    crossOrigin: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  })) as any
}

// ============================================================================
// FILE & BLOB APIs
// ============================================================================

export const mockFileAPIs = () => {
  // FileReader
  global.FileReader = vi.fn().mockImplementation(() => ({
    readyState: 0, // EMPTY
    result: null,
    error: null,
    readAsText: vi.fn(),
    readAsDataURL: vi.fn(),
    readAsArrayBuffer: vi.fn(),
    readAsBinaryString: vi.fn(),
    abort: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
    onload: null,
    onerror: null,
    onabort: null,
    onloadstart: null,
    onloadend: null,
    onprogress: null,
    EMPTY: 0,
    LOADING: 1,
    DONE: 2,
  })) as any

  // File
  global.File = vi.fn().mockImplementation((fileBits, fileName, options = {}) => ({
    name: fileName,
    size: 0,
    type: options.type || '',
    lastModified: Date.now(),
    slice: vi.fn(() => new Blob()),
    stream: vi.fn(),
    text: vi.fn(() => Promise.resolve('')),
    arrayBuffer: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
  })) as any

  // Blob
  global.Blob = vi.fn().mockImplementation((blobParts = [], options = {}) => ({
    size: 0,
    type: options.type || '',
    slice: vi.fn(() => new Blob()),
    stream: vi.fn(),
    text: vi.fn(() => Promise.resolve('')),
    arrayBuffer: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
  })) as any

  // FormData
  global.FormData = vi.fn().mockImplementation(() => ({
    append: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(() => null),
    getAll: vi.fn(() => []),
    has: vi.fn(() => false),
    set: vi.fn(),
    keys: vi.fn(() => [][Symbol.iterator]()),
    values: vi.fn(() => [][Symbol.iterator]()),
    entries: vi.fn(() => [][Symbol.iterator]()),
    forEach: vi.fn(),
  })) as any
}

// ============================================================================
// URL & NAVIGATION APIs
// ============================================================================

export const mockURLAPIs = () => {
  // URL
  global.URL = vi.fn().mockImplementation((url, base) => {
    const mockUrl = new URL(url, base || 'http://localhost:3000')
    return {
      href: mockUrl.href,
      origin: mockUrl.origin,
      protocol: mockUrl.protocol,
      host: mockUrl.host,
      hostname: mockUrl.hostname,
      port: mockUrl.port,
      pathname: mockUrl.pathname,
      search: mockUrl.search,
      hash: mockUrl.hash,
      username: mockUrl.username,
      password: mockUrl.password,
      searchParams: new URLSearchParams(mockUrl.search),
      toString: () => mockUrl.href,
      toJSON: () => mockUrl.href,
    }
  }) as any

  // Add static methods
  Object.assign(global.URL, {
    createObjectURL: vi.fn(() => 'blob:http://localhost:3000/test'),
    revokeObjectURL: vi.fn(),
  })

  // URLSearchParams
  global.URLSearchParams = vi.fn().mockImplementation((init) => {
    const params = new Map<string, string[]>()
    
    if (typeof init === 'string') {
      // Parse string
      const pairs = init.replace(/^\?/, '').split('&')
      pairs.forEach(pair => {
        const [key, value] = pair.split('=').map(decodeURIComponent)
        if (key) {
          if (!params.has(key)) params.set(key, [])
          params.get(key)!.push(value || '')
        }
      })
    }
    
    return {
      append: vi.fn((name: string, value: string) => {
        if (!params.has(name)) params.set(name, [])
        params.get(name)!.push(value)
      }),
      delete: vi.fn((name: string) => params.delete(name)),
      get: vi.fn((name: string) => params.get(name)?.[0] || null),
      getAll: vi.fn((name: string) => params.get(name) || []),
      has: vi.fn((name: string) => params.has(name)),
      set: vi.fn((name: string, value: string) => params.set(name, [value])),
      sort: vi.fn(),
      toString: vi.fn(() => Array.from(params.entries())
        .flatMap(([key, values]) => values.map(value => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`))
        .join('&')),
      keys: vi.fn(() => Array.from(params.keys())[Symbol.iterator]()),
      values: vi.fn(() => Array.from(params.values()).flat()[Symbol.iterator]()),
      entries: vi.fn(() => Array.from(params.entries()).flatMap(([key, values]) => 
        values.map(value => [key, value])
      )[Symbol.iterator]()),
      forEach: vi.fn((callback) => {
        params.forEach((values, key) => {
          values.forEach(value => callback(value, key, this))
        })
      }),
    }
  }) as any
}

// ============================================================================
// PERFORMANCE & TIMING APIs
// ============================================================================

export const mockPerformanceAPIs = () => {
  const mockPerformance = {
    now: vi.fn(() => Date.now()),
    timeOrigin: Date.now(),
    
    // Navigation Timing
    navigation: {
      type: 'navigate',
      redirectCount: 0,
    },
    
    timing: {
      navigationStart: Date.now(),
      unloadEventStart: 0,
      unloadEventEnd: 0,
      redirectStart: 0,
      redirectEnd: 0,
      fetchStart: Date.now(),
      domainLookupStart: Date.now(),
      domainLookupEnd: Date.now(),
      connectStart: Date.now(),
      connectEnd: Date.now(),
      secureConnectionStart: 0,
      requestStart: Date.now(),
      responseStart: Date.now(),
      responseEnd: Date.now(),
      domLoading: Date.now(),
      domInteractive: Date.now(),
      domContentLoadedEventStart: Date.now(),
      domContentLoadedEventEnd: Date.now(),
      domComplete: Date.now(),
      loadEventStart: Date.now(),
      loadEventEnd: Date.now(),
    },
    
    // Resource Timing
    getEntries: vi.fn(() => []),
    getEntriesByType: vi.fn(() => []),
    getEntriesByName: vi.fn(() => []),
    
    // Performance Marks and Measures
    mark: vi.fn(),
    measure: vi.fn(),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
    
    // Memory (if available)
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 2000000,
      jsHeapSizeLimit: 4000000,
    },
    
    // Observer
    observe: vi.fn(),
    disconnect: vi.fn(),
    takeRecords: vi.fn(() => []),
  }

  Object.defineProperty(global, 'performance', {
    value: mockPerformance,
    writable: true,
  })
}

// ============================================================================
// EVENT APIS
// ============================================================================

export const mockEventAPIs = () => {
  // Event
  global.Event = vi.fn().mockImplementation((type, options = {}) => ({
    type,
    bubbles: options.bubbles || false,
    cancelable: options.cancelable || false,
    composed: options.composed || false,
    target: null,
    currentTarget: null,
    eventPhase: 0,
    timeStamp: Date.now(),
    defaultPrevented: false,
    isTrusted: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    stopImmediatePropagation: vi.fn(),
    NONE: 0,
    CAPTURING_PHASE: 1,
    AT_TARGET: 2,
    BUBBLING_PHASE: 3,
  })) as any

  // CustomEvent
  global.CustomEvent = vi.fn().mockImplementation((type, options = {}) => ({
    ...new Event(type, options),
    detail: options.detail || null,
  })) as any

  // MouseEvent
  global.MouseEvent = vi.fn().mockImplementation((type, options = {}) => ({
    ...new Event(type, options),
    clientX: options.clientX || 0,
    clientY: options.clientY || 0,
    screenX: options.screenX || 0,
    screenY: options.screenY || 0,
    pageX: options.pageX || 0,
    pageY: options.pageY || 0,
    offsetX: options.offsetX || 0,
    offsetY: options.offsetY || 0,
    button: options.button || 0,
    buttons: options.buttons || 0,
    altKey: options.altKey || false,
    ctrlKey: options.ctrlKey || false,
    metaKey: options.metaKey || false,
    shiftKey: options.shiftKey || false,
    relatedTarget: options.relatedTarget || null,
  })) as any

  // KeyboardEvent
  global.KeyboardEvent = vi.fn().mockImplementation((type, options = {}) => ({
    ...new Event(type, options),
    key: options.key || '',
    code: options.code || '',
    location: options.location || 0,
    repeat: options.repeat || false,
    altKey: options.altKey || false,
    ctrlKey: options.ctrlKey || false,
    metaKey: options.metaKey || false,
    shiftKey: options.shiftKey || false,
  })) as any

  // TouchEvent
  global.TouchEvent = vi.fn().mockImplementation((type, options = {}) => ({
    ...new Event(type, options),
    touches: options.touches || [],
    targetTouches: options.targetTouches || [],
    changedTouches: options.changedTouches || [],
    altKey: options.altKey || false,
    ctrlKey: options.ctrlKey || false,
    metaKey: options.metaKey || false,
    shiftKey: options.shiftKey || false,
  })) as any

  // FocusEvent
  global.FocusEvent = vi.fn().mockImplementation((type, options = {}) => ({
    ...new Event(type, options),
    relatedTarget: options.relatedTarget || null,
  })) as any
}

// ============================================================================
// CSS & STYLING APIs
// ============================================================================

export const mockCSSAPIs = () => {
  // CSS Object
  global.CSS = {
    supports: vi.fn((property: string, value?: string) => {
      // Mock support for common properties
      const supportedProperties = [
        'display', 'position', 'color', 'background', 'border',
        'margin', 'padding', 'width', 'height', 'font-size',
        'flex', 'grid', 'transform', 'transition', 'animation'
      ]
      return supportedProperties.some(prop => property.includes(prop))
    }),
    escape: vi.fn((value: string) => value.replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~]/g, '\\$&')),
    
    // Paint Worklet
    paintWorklet: {
      addModule: vi.fn(() => Promise.resolve()),
    },
  }

  // CSSStyleSheet
  global.CSSStyleSheet = vi.fn().mockImplementation(() => ({
    cssRules: [],
    ownerRule: null,
    insertRule: vi.fn(() => 0),
    deleteRule: vi.fn(),
    replace: vi.fn(() => Promise.resolve()),
    replaceSync: vi.fn(),
  })) as any

  // DOMRect
  global.DOMRect = vi.fn().mockImplementation((x = 0, y = 0, width = 0, height = 0) => ({
    x,
    y,
    width,
    height,
    top: y,
    right: x + width,
    bottom: y + height,
    left: x,
    toJSON: () => ({ x, y, width, height, top: y, right: x + width, bottom: y + height, left: x }),
  })) as any

  // DOMRectReadOnly
  global.DOMRectReadOnly = global.DOMRect

  // MediaQueryList (enhanced)
  global.MediaQueryList = vi.fn().mockImplementation((media: string) => ({
    media,
    matches: false,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  })) as any
}

// ============================================================================
// WEB COMPONENTS & SHADOW DOM
// ============================================================================

export const mockWebComponentAPIs = () => {
  // Custom Elements
  global.customElements = {
    define: vi.fn(),
    get: vi.fn(() => undefined),
    upgrade: vi.fn(),
    whenDefined: vi.fn(() => Promise.resolve()),
  }

  // Shadow DOM
  Object.defineProperty(Element.prototype, 'attachShadow', {
    value: vi.fn(() => ({
      mode: 'open',
      host: null,
      innerHTML: '',
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      querySelector: vi.fn(() => null),
      querySelectorAll: vi.fn(() => []),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
    writable: true,
  })
}

// ============================================================================
// WORKER APIs
// ============================================================================

export const mockWorkerAPIs = () => {
  // Web Worker
  global.Worker = vi.fn().mockImplementation(() => ({
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
    onmessage: null,
    onerror: null,
    onmessageerror: null,
  })) as any

  // Shared Worker
  global.SharedWorker = vi.fn().mockImplementation(() => ({
    port: {
      postMessage: vi.fn(),
      start: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onmessage: null,
      onmessageerror: null,
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    onerror: null,
  })) as any
}

// ============================================================================
// NOTIFICATION & VIBRATION APIs
// ============================================================================

export const mockNotificationAPIs = () => {
  // Notification API
  global.Notification = vi.fn().mockImplementation((title, options = {}) => ({
    title,
    body: options.body || '',
    icon: options.icon || '',
    tag: options.tag || '',
    data: options.data || null,
    permission: 'granted',
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    onclick: null,
    onerror: null,
    onclose: null,
    onshow: null,
  })) as any

  // Static methods
  Object.assign(global.Notification, {
    permission: 'default',
    requestPermission: vi.fn(() => Promise.resolve('granted')),
  })

  // Vibration API
  Object.defineProperty(navigator, 'vibrate', {
    value: vi.fn(() => true),
    writable: true,
  })
}

// ============================================================================
// MAIN INITIALIZATION FUNCTION
// ============================================================================

export const initializeComprehensiveBrowserEnvironment = () => {
  console.log('🌐 Initializing comprehensive browser environment mocking...')

  // Initialize all browser API mocks
  mockDOMAPIs()
  mockWindowAPIs()
  mockStorageAPIs()
  mockNetworkAPIs()
  mockCryptoAPIs()
  mockObserverAPIs()
  mockMediaAPIs()
  mockFileAPIs()
  mockURLAPIs()
  mockPerformanceAPIs()
  mockEventAPIs()
  mockCSSAPIs()
  mockWebComponentAPIs()
  mockWorkerAPIs()
  mockNotificationAPIs()

  console.log('✅ Comprehensive browser environment mocking complete')
}

// Cleanup function
export const cleanupComprehensiveBrowserEnvironment = () => {
  console.log('🧹 Cleaning up comprehensive browser environment...')
  
  // Reset global objects
  const globalsToReset = [
    'document', 'window', 'location', 'history', 'navigator', 'screen',
    'localStorage', 'sessionStorage', 'indexedDB',
    'fetch', 'WebSocket', 'XMLHttpRequest', 'EventSource',
    'crypto', 'ResizeObserver', 'IntersectionObserver', 'MutationObserver', 'PerformanceObserver',
    'HTMLCanvasElement', 'Audio', 'Image', 'FileReader', 'File', 'Blob', 'FormData',
    'URL', 'URLSearchParams', 'performance',
    'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'TouchEvent', 'FocusEvent',
    'CSS', 'CSSStyleSheet', 'DOMRect', 'DOMRectReadOnly', 'MediaQueryList',
    'customElements', 'Worker', 'SharedWorker', 'Notification'
  ]

  globalsToReset.forEach(globalName => {
    try {
      delete (global as any)[globalName]
    } catch (error) {
      // Some globals can't be deleted, that's ok
    }
  })

  console.log('✅ Comprehensive browser environment cleanup complete')
}

export default {
  initializeComprehensiveBrowserEnvironment,
  cleanupComprehensiveBrowserEnvironment,
  mockDOMAPIs,
  mockWindowAPIs,
  mockStorageAPIs,
  mockNetworkAPIs,
  mockCryptoAPIs,
  mockObserverAPIs,
  mockMediaAPIs,
  mockFileAPIs,
  mockURLAPIs,
  mockPerformanceAPIs,
  mockEventAPIs,
  mockCSSAPIs,
  mockWebComponentAPIs,
  mockWorkerAPIs,
  mockNotificationAPIs,
}