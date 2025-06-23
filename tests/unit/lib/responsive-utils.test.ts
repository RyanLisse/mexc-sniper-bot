import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { z } from "zod";
import {
  BREAKPOINTS,
  MOBILE_BREAKPOINT,
  isBreakpoint,
  getDeviceCategory,
  isMobileDevice,
  isTouchDevice,
  getOrientation,
  ResponsiveClassNames,
  RESPONSIVE_CONFIG,
  MEDIA_QUERIES,
  validateResponsiveConfig,
  createResponsiveClasses,
  parseBreakpointValue,
} from "../../../src/lib/responsive-utils-clean";

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

describe("Responsive Utils - Constants", () => {
  it("should have correct breakpoint values", () => {
    expect(BREAKPOINTS.sm).toBe(640);
    expect(BREAKPOINTS.md).toBe(768);
    expect(BREAKPOINTS.lg).toBe(1024);
    expect(BREAKPOINTS.xl).toBe(1280);
    expect(BREAKPOINTS["2xl"]).toBe(1536);
  });

  it("should have mobile breakpoint at 768px", () => {
    expect(MOBILE_BREAKPOINT).toBe(768);
  });
});

describe("Responsive Utils - Device Detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should detect breakpoint correctly", () => {
    mockWindowDimensions(800, 600);
    expect(isBreakpoint("sm")).toBe(true); // 800 >= 640
    expect(isBreakpoint("md")).toBe(true); // 800 >= 768
    expect(isBreakpoint("lg")).toBe(false); // 800 < 1024
  });

  it("should return false for breakpoint check in SSR", () => {
    // Simulate server-side rendering
    const originalWindow = global.window;
    delete (global as any).window;

    expect(isBreakpoint("md")).toBe(false);

    global.window = originalWindow;
  });

  it("should categorize devices correctly", () => {
    mockWindowDimensions(500, 800); // Mobile
    expect(getDeviceCategory()).toBe("mobile");

    mockWindowDimensions(700, 600); // Tablet  
    expect(getDeviceCategory()).toBe("tablet");

    mockWindowDimensions(1200, 800); // Desktop
    expect(getDeviceCategory()).toBe("desktop");
  });

  it("should detect mobile device correctly", () => {
    mockWindowDimensions(600, 800);
    expect(isMobileDevice()).toBe(true);

    mockWindowDimensions(900, 600);
    expect(isMobileDevice()).toBe(false);
  });

  it("should detect touch device capabilities", () => {
    // Mock touch support
    Object.defineProperty(window, "ontouchstart", {
      value: {},
      configurable: true,
    });
    Object.defineProperty(navigator, "maxTouchPoints", {
      value: 1,
      configurable: true,
    });

    expect(isTouchDevice()).toBe(true);

    // Mock no touch support
    delete (window as any).ontouchstart;
    Object.defineProperty(navigator, "maxTouchPoints", {
      value: 0,
      configurable: true,
    });

    expect(isTouchDevice()).toBe(false);
  });

  it("should detect orientation correctly", () => {
    mockWindowDimensions(400, 800); // Portrait
    expect(getOrientation()).toBe("portrait");

    mockWindowDimensions(800, 400); // Landscape
    expect(getOrientation()).toBe("landscape");
  });
});

describe("ResponsiveClassNames Utility", () => {
  it("should generate responsive spacing classes", () => {
    const classes = ResponsiveClassNames.spacing("4", "6", "8");
    expect(classes).toBe("p-4 sm:p-6 md:p-8");
  });

  it("should generate responsive margin classes", () => {
    const classes = ResponsiveClassNames.margin("2", "4");
    expect(classes).toBe("m-2 sm:m-4");
  });

  it("should generate responsive padding classes", () => {
    const classes = ResponsiveClassNames.padding("4", undefined, "8");
    expect(classes).toBe("p-4 md:p-8");
  });

  it("should generate responsive grid column classes", () => {
    const classes = ResponsiveClassNames.gridCols(1, 2, 3);
    expect(classes).toBe("grid-cols-1 sm:grid-cols-2 md:grid-cols-3");
  });

  it("should generate responsive text size classes", () => {
    const classes = ResponsiveClassNames.textSize("base", "lg", "xl");
    expect(classes).toBe("text-base sm:text-lg md:text-xl");
  });

  it("should generate responsive gap classes", () => {
    const classes = ResponsiveClassNames.gap("2", "4", "6");
    expect(classes).toBe("gap-2 sm:gap-4 md:gap-6");
  });
});

describe("Responsive Config Validation", () => {
  it("should validate correct responsive config", () => {
    const validConfig = {
      mobile: { padding: "1rem", fontSize: "14px" },
      tablet: { padding: "1.5rem", fontSize: "16px" },
      desktop: { padding: "2rem", fontSize: "18px" },
    };

    expect(() => validateResponsiveConfig(validConfig)).not.toThrow();
  });

  it("should reject invalid responsive config", () => {
    const invalidConfig = {
      mobile: { padding: 123 }, // Invalid type
    };

    expect(() => validateResponsiveConfig(invalidConfig)).toThrow();
  });

  it("should validate RESPONSIVE_CONFIG constants", () => {
    expect(() => validateResponsiveConfig(RESPONSIVE_CONFIG.sidebar)).not.toThrow();
    expect(() => validateResponsiveConfig(RESPONSIVE_CONFIG.cards)).not.toThrow();
    expect(() => validateResponsiveConfig(RESPONSIVE_CONFIG.containers)).not.toThrow();
  });
});

describe("Media Queries", () => {
  it("should have correct media query strings", () => {
    expect(MEDIA_QUERIES.mobile).toBe("(max-width: 639px)");
    expect(MEDIA_QUERIES.tablet).toBe("(min-width: 640px) and (max-width: 767px)");
    expect(MEDIA_QUERIES.desktop).toBe("(min-width: 768px)");
    expect(MEDIA_QUERIES.lg).toBe("(min-width: 1024px)");
    expect(MEDIA_QUERIES.xl).toBe("(min-width: 1280px)");
    expect(MEDIA_QUERIES["2xl"]).toBe("(min-width: 1536px)");
  });
});

describe("Responsive Class Generation", () => {
  it("should create responsive classes with validation", () => {
    const config = {
      mobile: "text-sm p-2",
      tablet: "text-base p-4", 
      desktop: "text-lg p-6",
    };

    const classes = createResponsiveClasses(config);
    expect(classes).toBe("text-sm p-2 sm:text-base sm:p-4 md:text-lg md:p-6");
  });

  it("should handle missing breakpoints gracefully", () => {
    const config = {
      mobile: "text-sm",
      desktop: "text-lg",
    };

    const classes = createResponsiveClasses(config);
    expect(classes).toBe("text-sm md:text-lg");
  });

  it("should validate responsive class config with Zod", () => {
    const validConfig = {
      mobile: "p-4",
      tablet: "p-6", 
      desktop: "p-8",
    };

    expect(() => createResponsiveClasses(validConfig)).not.toThrow();

    const invalidConfig = {
      mobile: 123, // Invalid type
    };

    expect(() => createResponsiveClasses(invalidConfig as any)).toThrow();
  });
});

describe("Breakpoint Value Parsing", () => {
  it("should parse breakpoint values correctly", () => {
    expect(parseBreakpointValue("sm")).toBe(640);
    expect(parseBreakpointValue("md")).toBe(768);
    expect(parseBreakpointValue("lg")).toBe(1024);
    expect(parseBreakpointValue("xl")).toBe(1280);
    expect(parseBreakpointValue("2xl")).toBe(1536);
  });

  it("should handle custom breakpoint values", () => {
    expect(parseBreakpointValue(900)).toBe(900);
    expect(parseBreakpointValue("900px")).toBe(900);
  });

  it("should throw error for invalid breakpoint", () => {
    expect(() => parseBreakpointValue("invalid")).toThrow();
    expect(() => parseBreakpointValue("")).toThrow();
  });
});