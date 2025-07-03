"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  Breakpoints,
  DeviceType,
  MobileDetection,
  Orientation,
  TouchGesture,
} from "../schemas/mobile-schemas";

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

/**
 * Enhanced Mobile Detection Hook
 * Provides comprehensive device detection with TypeScript safety
 * SSR-safe with proper hydration handling
 */
export function useIsMobile(breakpoint = MOBILE_BREAKPOINT): MobileDetection {
  // Initialize with safe defaults for SSR
  const [state, setState] = useState<MobileDetection>({
    isMobile: false,
    isTouch: false,
    screenWidth: typeof window !== "undefined" ? window.innerWidth : 1024,
    isTablet: false,
    isDesktop: true, // Default to desktop for SSR
  });

  // Track if we're in client-side environment
  const [isClient, setIsClient] = useState(false);

  const updateState = useCallback(() => {
    if (typeof window === "undefined") return;

    const width = window.innerWidth;
    const isMobile = width < breakpoint;
    const isTablet = width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT;
    const isDesktop = width >= TABLET_BREAKPOINT;

    let isTouch = false;
    try {
      isTouch = Boolean(
        "ontouchstart" in window ||
          (navigator?.maxTouchPoints && navigator.maxTouchPoints > 0) ||
          (navigator as any)?.msMaxTouchPoints > 0
      );
    } catch {
      // Fallback if navigator is not available
      isTouch = false;
    }

    setState({
      isMobile,
      isTouch,
      screenWidth: width,
      isTablet,
      isDesktop,
    });
  }, [breakpoint]);

  useEffect(() => {
    // Set client flag to prevent hydration mismatch
    setIsClient(true);
    updateState();

    if (typeof window === "undefined") return;

    const handleResize = () => updateState();
    window.addEventListener("resize", handleResize, { passive: true });

    return () => window.removeEventListener("resize", handleResize);
  }, [updateState]);

  // Return SSR-safe state until client-side hydration
  if (!isClient) {
    return {
      isMobile: false,
      isTouch: false,
      screenWidth: 1024,
      isTablet: false,
      isDesktop: true,
    };
  }

  return state;
}

/**
 * Device Type Detection Hook
 */
export function useDeviceType(): DeviceType {
  const { isMobile, isTablet } = useIsMobile();

  if (isMobile) return "mobile";
  if (isTablet) return "tablet";
  return "desktop";
}

/**
 * Responsive Breakpoints Hook
 * SSR-safe with proper hydration handling
 */
export function useBreakpoints(): Breakpoints {
  const [breakpoints, setBreakpoints] = useState<Breakpoints>({
    sm: true, // Default to larger breakpoints for SSR
    md: true,
    lg: true,
    xl: true,
    "2xl": false,
  });

  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);

    const updateBreakpoints = () => {
      if (typeof window === "undefined") return;

      const width = window.innerWidth;
      setBreakpoints({
        sm: width >= 640,
        md: width >= 768,
        lg: width >= 1024,
        xl: width >= 1280,
        "2xl": width >= 1536,
      });
    };

    updateBreakpoints();

    if (typeof window !== "undefined") {
      window.addEventListener("resize", updateBreakpoints, { passive: true });
      return () => window.removeEventListener("resize", updateBreakpoints);
    }
    return undefined;
  }, []);

  // Return SSR-safe defaults until hydrated
  if (!isClient) {
    return {
      sm: true,
      md: true,
      lg: true,
      xl: true,
      "2xl": false,
    };
  }

  return breakpoints;
}

/**
 * Orientation Detection Hook
 * SSR-safe with proper hydration handling
 */
export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);

    const updateOrientation = () => {
      if (typeof window === "undefined") return;
      setOrientation(
        window.innerHeight > window.innerWidth ? "portrait" : "landscape"
      );
    };

    updateOrientation();

    if (typeof window !== "undefined") {
      window.addEventListener("resize", updateOrientation, { passive: true });
      window.addEventListener("orientationchange", updateOrientation, {
        passive: true,
      });

      return () => {
        window.removeEventListener("resize", updateOrientation);
        window.removeEventListener("orientationchange", updateOrientation);
      };
    }
    return undefined;
  }, []);

  // Return SSR-safe default until hydrated
  return isClient ? orientation : "portrait";
}

/**
 * Mobile Device Detection (includes both mobile size and touch)
 */
export function useMobileDevice() {
  const { isMobile, isTouch } = useIsMobile();

  return {
    isMobileDevice: isMobile,
    isTouchDevice: isTouch,
    isMobileAndTouch: isMobile && isTouch,
  };
}

/**
 * Touch Gesture Detection Hook
 * SSR-safe with proper hydration handling
 */
export function useTouchGestures(): TouchGesture {
  const [gesture, setGesture] = useState<TouchGesture>({ type: null });
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);

    if (typeof document === "undefined") return;

    let startTime: number;
    let startX: number;
    let startY: number;
    let hasSwipe = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (!e.touches?.[0]) return;

      const touch = e.touches[0];
      startTime = Date.now();
      startX = touch.clientX;
      startY = touch.clientY;
      hasSwipe = false;

      const handleTouchMove = (moveEvent: TouchEvent) => {
        if (moveEvent.touches.length === 0) return;

        const moveTouch = moveEvent.touches[0];
        const deltaX = moveTouch.clientX - startX;
        const deltaY = moveTouch.clientY - startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (distance > 50 && !hasSwipe) {
          hasSwipe = true;
          let direction: "left" | "right" | "up" | "down";
          if (Math.abs(deltaX) > Math.abs(deltaY)) {
            direction = deltaX > 0 ? "right" : "left";
          } else {
            direction = deltaY > 0 ? "down" : "up";
          }

          setGesture({
            type: "swipe",
            direction,
            distance,
          });
        }
      };

      const handleTouchEnd = () => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        // Only set tap/long-press if no swipe was detected
        if (!hasSwipe) {
          if (duration > 500) {
            setGesture({ type: "long-press" });
          } else if (duration < 200) {
            setGesture({ type: "tap" });
          }
        }

        // Clear gesture after delay
        setTimeout(() => setGesture({ type: null }), 100);

        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("touchend", handleTouchEnd);
      };

      document.addEventListener("touchmove", handleTouchMove, {
        passive: true,
      });
      document.addEventListener("touchend", handleTouchEnd, { passive: true });
    };

    document.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
    };
  }, []);

  // Return null gesture state for SSR
  return isClient ? gesture : { type: null };
}

/**
 * Viewport Height Hook
 * Handles mobile viewport height changes (keyboard, browser chrome)
 * SSR-safe with proper hydration handling
 */
export function useViewportHeight(): number {
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== "undefined" ? window.innerHeight : 800
  );
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);

    const updateViewportHeight = () => {
      if (typeof window === "undefined") return;

      const height = window.visualViewport?.height || window.innerHeight;
      setViewportHeight(height);

      // Set CSS custom property safely
      if (typeof document !== "undefined") {
        document.documentElement.style.setProperty(
          "--vh",
          `${height * 0.01}px`
        );
      }
    };

    updateViewportHeight();

    if (typeof window !== "undefined") {
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", updateViewportHeight, {
          passive: true,
        });
      } else {
        window.addEventListener("resize", updateViewportHeight, {
          passive: true,
        });
      }

      window.addEventListener(
        "orientationchange",
        () => {
          setTimeout(updateViewportHeight, 100);
        },
        { passive: true }
      );

      return () => {
        if (window.visualViewport) {
          window.visualViewport.removeEventListener(
            "resize",
            updateViewportHeight
          );
        } else {
          window.removeEventListener("resize", updateViewportHeight);
        }
      };
    }
    return undefined;
  }, []);

  // Return SSR-safe default until hydrated
  return isClient ? viewportHeight : 800;
}

/**
 * Window Size Hook (for general responsive calculations)
 * SSR-safe with proper hydration handling
 */
export function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 1024,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
  });
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);

    const updateSize = () => {
      if (typeof window === "undefined") return;

      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateSize();

    if (typeof window !== "undefined") {
      window.addEventListener("resize", updateSize, { passive: true });
      return () => window.removeEventListener("resize", updateSize);
    }
    return undefined;
  }, []);

  // Return SSR-safe defaults until hydrated
  return isClient ? windowSize : { width: 1024, height: 800 };
}

/**
 * Touch Device Detection Hook
 * SSR-safe with proper hydration handling
 */
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);

    if (typeof window === "undefined") return;

    try {
      const hasTouch = Boolean(
        "ontouchstart" in window ||
          (navigator?.maxTouchPoints && navigator.maxTouchPoints > 0) ||
          (navigator as any)?.msMaxTouchPoints > 0
      );

      setIsTouch(hasTouch);
    } catch {
      // Fallback if navigator is not available
      setIsTouch(false);
    }
  }, []);

  // Return SSR-safe default until hydrated
  return isClient ? isTouch : false;
}
