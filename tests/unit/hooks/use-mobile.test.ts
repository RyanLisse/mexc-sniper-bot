import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useIsMobile, useViewportHeight, useTouchGestures } from "../../../src/hooks/use-mobile-clean";

// Ensure window and document objects are available for tests
if (typeof global.window === 'undefined') {
  global.window = {
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    location: { href: 'http://localhost:3000' },
    navigator: {
      maxTouchPoints: 0,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  } as any;
}

if (typeof global.document === 'undefined') {
  global.document = {
    body: {
      appendChild: vi.fn((child) => child)
    },
    documentElement: {
      style: {
        setProperty: vi.fn(),
        getPropertyValue: vi.fn(() => '6.67px')
      }
    },
    createElement: vi.fn((tagName) => ({
      tagName: tagName.toUpperCase(),
      appendChild: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      style: {}
    })),
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  } as any;
}

if (typeof global.navigator === 'undefined') {
  global.navigator = {
    maxTouchPoints: 0,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  } as any;
}

// Mock window dimensions
const mockWindowDimensions = (width: number, height: number) => {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    writable: true,
    configurable: true,
    value: height,
  });
};

// Mock touch capabilities
const mockTouchCapabilities = (hasTouch: boolean) => {
  if (hasTouch) {
    Object.defineProperty(window, "ontouchstart", {
      writable: true,
      configurable: true,
      value: {},
    });
    Object.defineProperty(navigator, "maxTouchPoints", {
      writable: true,
      configurable: true,
      value: 1,
    });
  } else {
    // Delete the property entirely instead of setting to undefined
    try {
      delete (window as any).ontouchstart;
    } catch {
      // If deletion fails, set to undefined and mark as non-enumerable
      Object.defineProperty(window, "ontouchstart", {
        writable: true,
        configurable: true,
        value: undefined,
        enumerable: false
      });
    }
    Object.defineProperty(navigator, "maxTouchPoints", {
      writable: true,
      configurable: true,
      value: 0,
    });
  }
};

describe("useIsMobile Hook", () => {
  beforeEach(() => {
    // Setup DOM and window mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup mocks and global state
    vi.restoreAllMocks();
    
    // Restore window dimensions if they were modified
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'innerWidth', {
        value: 1024,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, 'innerHeight', {
        value: 768,
        writable: true,
        configurable: true,
      });
    }
  });

  it("should detect mobile device when width < 768px", () => {
    mockWindowDimensions(375, 667); // iPhone size
    mockTouchCapabilities(true);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current.isMobile).toBe(true);
    expect(result.current.isTouch).toBe(true);
    expect(result.current.screenWidth).toBe(375);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(false);
  });

  it("should detect desktop device when width >= 768px", () => {
    mockWindowDimensions(1024, 768); // Desktop size
    mockTouchCapabilities(false);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTouch).toBe(false);
    expect(result.current.screenWidth).toBe(1024);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(true);
  });

  it("should detect tablet device when width between 768px and 1024px", () => {
    mockWindowDimensions(800, 600); // Tablet size
    mockTouchCapabilities(true);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTouch).toBe(true);
    expect(result.current.screenWidth).toBe(800);
    expect(result.current.isTablet).toBe(true);
    expect(result.current.isDesktop).toBe(false);
  });

  it("should use custom breakpoint when provided", () => {
    mockWindowDimensions(600, 400);
    mockTouchCapabilities(false);

    const { result } = renderHook(() => useIsMobile(640)); // Custom breakpoint

    expect(result.current.isMobile).toBe(true); // 600 < 640
  });

  it("should update on window resize", () => {
    mockWindowDimensions(375, 667); // Start mobile
    mockTouchCapabilities(true);

    const { result } = renderHook(() => useIsMobile());
    
    expect(result.current.isMobile).toBe(true);

    // Simulate resize to desktop
    act(() => {
      mockWindowDimensions(1024, 768);
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current.isMobile).toBe(false);
    expect(result.current.screenWidth).toBe(1024);
  });
});

describe("useViewportHeight Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return current viewport height", () => {
    mockWindowDimensions(375, 667);

    const { result } = renderHook(() => useViewportHeight());

    expect(result.current).toBe(667);
  });

  it("should update viewport height on resize", () => {
    mockWindowDimensions(375, 667);

    const { result } = renderHook(() => useViewportHeight());
    
    expect(result.current).toBe(667);

    // Simulate viewport change (e.g., mobile keyboard)
    act(() => {
      mockWindowDimensions(375, 500);
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current).toBe(500);
  });

  it("should set CSS custom property --vh", () => {
    mockWindowDimensions(375, 667);

    renderHook(() => useViewportHeight());

    const vhValue = document.documentElement.style.getPropertyValue("--vh");
    expect(vhValue).toBe("6.67px"); // 667 * 0.01
  });
});

describe("useTouchGestures Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with null gesture", () => {
    const { result } = renderHook(() => useTouchGestures());

    expect(result.current.type).toBe(null);
  });

  it("should detect tap gesture", async () => {
    const { result } = renderHook(() => useTouchGestures());

    // Simulate quick touch
    act(() => {
      const touchStartEvent = new TouchEvent("touchstart", {
        touches: [{ clientX: 100, clientY: 100 } as Touch],
      });
      document.dispatchEvent(touchStartEvent);
    });

    // Immediately trigger touch end for tap
    await act(async () => {
      const touchEndEvent = new TouchEvent("touchend", { touches: [] });
      document.dispatchEvent(touchEndEvent);
      
      // Wait for the gesture to be processed
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(result.current.type).toBe("tap");
  });

  it("should detect swipe left gesture", async () => {
    const { result } = renderHook(() => useTouchGestures());

    await act(async () => {
      // Start touch
      const touchStartEvent = new TouchEvent("touchstart", {
        touches: [{ clientX: 200, clientY: 100 } as Touch],
      });
      document.dispatchEvent(touchStartEvent);

      // Move left significantly  
      const touchMoveEvent = new TouchEvent("touchmove", {
        touches: [{ clientX: 100, clientY: 100 } as Touch],
      });
      document.dispatchEvent(touchMoveEvent);

      // End touch
      const touchEndEvent = new TouchEvent("touchend", { touches: [] });
      document.dispatchEvent(touchEndEvent);
      
      // Wait for gesture processing
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(result.current.type).toBe("swipe");
    expect(result.current.direction).toBe("left");
    expect(result.current.distance).toBeGreaterThan(50);
  });
});