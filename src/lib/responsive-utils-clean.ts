"use client";

import { z } from "zod";

/**
 * Responsive Utilities with Type Safety and Zod Validation
 * Clean, minimal implementation following mobile-first principles
 */

// Breakpoint definitions (min-width values)
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

export const MOBILE_BREAKPOINT = BREAKPOINTS.md;

// Zod schemas for validation
const BreakpointKeySchema = z.enum(["sm", "md", "lg", "xl", "2xl"]);
const ResponsiveValueSchema = z.string().min(1);

const ResponsiveConfigItemSchema = z.record(z.string(), z.union([z.string(), z.record(z.string(), z.string())]));

const ResponsiveClassConfigSchema = z.object({
  mobile: ResponsiveValueSchema,
  tablet: ResponsiveValueSchema.optional(),
  desktop: ResponsiveValueSchema.optional(),
});

// Type definitions
export type BreakpointKey = z.infer<typeof BreakpointKeySchema>;
export type ResponsiveValue = z.infer<typeof ResponsiveValueSchema>;
export type ResponsiveConfigItem = z.infer<typeof ResponsiveConfigItemSchema>;
export type ResponsiveClassConfig = z.infer<typeof ResponsiveClassConfigSchema>;

/**
 * Check if current screen width matches a breakpoint
 */
export function isBreakpoint(breakpoint: BreakpointKey): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth >= BREAKPOINTS[breakpoint];
}

/**
 * Get current device category based on screen width
 */
export function getDeviceCategory(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";

  const width = window.innerWidth;
  if (width < BREAKPOINTS.sm) return "mobile";
  if (width < BREAKPOINTS.md) return "tablet"; 
  return "desktop";
}

/**
 * Check if device is mobile (< tablet breakpoint)
 */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < MOBILE_BREAKPOINT;
}

/**
 * Check if device has touch capability
 */
export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;

  return Boolean(
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0
  );
}

/**
 * Get screen orientation
 */
export function getOrientation(): "portrait" | "landscape" {
  if (typeof window === "undefined") return "portrait";
  return window.innerHeight > window.innerWidth ? "portrait" : "landscape";
}

/**
 * Responsive class name utilities
 */
export class ResponsiveClassNames {
  static spacing(mobile: string, tablet?: string, desktop?: string): string {
    let classes = `p-${mobile}`;
    if (tablet) classes += ` sm:p-${tablet}`;
    if (desktop) classes += ` md:p-${desktop}`;
    return classes;
  }

  static margin(mobile: string, tablet?: string, desktop?: string): string {
    let classes = `m-${mobile}`;
    if (tablet) classes += ` sm:m-${tablet}`;
    if (desktop) classes += ` md:m-${desktop}`;
    return classes;
  }

  static padding(mobile: string, tablet?: string, desktop?: string): string {
    let classes = `p-${mobile}`;
    if (tablet) classes += ` sm:p-${tablet}`;
    if (desktop) classes += ` md:p-${desktop}`;
    return classes;
  }

  static gridCols(mobile: number, tablet?: number, desktop?: number): string {
    let classes = `grid-cols-${mobile}`;
    if (tablet) classes += ` sm:grid-cols-${tablet}`;
    if (desktop) classes += ` md:grid-cols-${desktop}`;
    return classes;
  }

  static textSize(mobile: string, tablet?: string, desktop?: string): string {
    let classes = `text-${mobile}`;
    if (tablet) classes += ` sm:text-${tablet}`;
    if (desktop) classes += ` md:text-${desktop}`;
    return classes;
  }

  static gap(mobile: string, tablet?: string, desktop?: string): string {
    let classes = `gap-${mobile}`;
    if (tablet) classes += ` sm:gap-${tablet}`;
    if (desktop) classes += ` md:gap-${desktop}`;
    return classes;
  }
}

/**
 * Responsive configuration constants
 */
export const RESPONSIVE_CONFIG = {
  sidebar: {
    widthMobile: "18rem",
    widthDesktop: "16rem",
    widthIcon: "3rem",
  },
  cards: {
    paddingMobile: "1rem",
    paddingTablet: "1.5rem",
    paddingDesktop: "2rem",
    gapMobile: "0.75rem",
    gapTablet: "1rem",
    gapDesktop: "1.5rem",
  },
  containers: {
    paddingMobile: "1rem",
    paddingTablet: "1.5rem",
    paddingDesktop: "2rem",
    maxWidth: "1200px",
  },
  navigation: {
    heightMobile: "3.5rem",
    heightDesktop: "4rem",
  },
} as const;

/**
 * Media query strings for CSS-in-JS
 */
export const MEDIA_QUERIES = {
  mobile: `(max-width: ${BREAKPOINTS.sm - 1}px)`,
  tablet: `(min-width: ${BREAKPOINTS.sm}px) and (max-width: ${BREAKPOINTS.md - 1}px)`,
  desktop: `(min-width: ${BREAKPOINTS.md}px)`,
  lg: `(min-width: ${BREAKPOINTS.lg}px)`,
  xl: `(min-width: ${BREAKPOINTS.xl}px)`,
  "2xl": `(min-width: ${BREAKPOINTS["2xl"]}px)`,
} as const;

/**
 * Validate responsive configuration with Zod
 */
export function validateResponsiveConfig(config: unknown): ResponsiveConfigItem {
  return ResponsiveConfigItemSchema.parse(config);
}

/**
 * Create responsive classes with validation
 */
export function createResponsiveClasses(config: ResponsiveClassConfig): string {
  const validatedConfig = ResponsiveClassConfigSchema.parse(config);
  
  // Split the classes and add prefixes properly
  const mobileClasses = validatedConfig.mobile;
  const tabletClasses = validatedConfig.tablet 
    ? validatedConfig.tablet.split(' ').map(cls => `sm:${cls}`).join(' ')
    : '';
  const desktopClasses = validatedConfig.desktop 
    ? validatedConfig.desktop.split(' ').map(cls => `md:${cls}`).join(' ')
    : '';
  
  return [mobileClasses, tabletClasses, desktopClasses]
    .filter(Boolean)
    .join(' ');
}

/**
 * Parse breakpoint value from string or number
 */
export function parseBreakpointValue(value: BreakpointKey | number | string): number {
  if (typeof value === "number") return value;
  
  if (typeof value === "string") {
    // Handle px values
    if (value.endsWith("px")) {
      const parsed = parseInt(value.replace("px", ""), 10);
      if (isNaN(parsed)) throw new Error(`Invalid breakpoint value: ${value}`);
      return parsed;
    }
    
    // Handle predefined breakpoints
    if (value in BREAKPOINTS) {
      return BREAKPOINTS[value as BreakpointKey];
    }
  }
  
  throw new Error(`Invalid breakpoint value: ${value}`);
}