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
 */
export function useIsMobile(breakpoint = MOBILE_BREAKPOINT): MobileDetection {
  const [state, setState] = useState<MobileDetection>({
    isMobile: false,
    isTouch: false,
    screenWidth: 0,
    isTablet: false,
    isDesktop: false,
  });

  const updateState = useCallback(() => {
    if (typeof window === "undefined") return;

    const width = window.innerWidth;
    const isMobile = width < breakpoint;
    const isTablet = width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT;
    const isDesktop = width >= TABLET_BREAKPOINT;

    const isTouch = Boolean(
      "ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        (navigator as any).msMaxTouchPoints > 0
    );

    setState({
      isMobile,
      isTouch,
      screenWidth: width,
      isTablet,
      isDesktop,
    });
  }, [breakpoint]);

  useEffect(() => {
    updateState();

    const handleResize = () => updateState();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, [updateState]);

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
 */
export function useBreakpoints(): Breakpoints {
  const [breakpoints, setBreakpoints] = useState<Breakpoints>({
    sm: false,
    md: false,
    lg: false,
    xl: false,
    "2xl": false,
  });

  useEffect(() => {
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
    window.addEventListener("resize", updateBreakpoints);

    return () => window.removeEventListener("resize", updateBreakpoints);
  }, []);

  return breakpoints;
}

/**
 * Orientation Detection Hook
 */
export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>("portrait");

  useEffect(() => {
    const updateOrientation = () => {
      if (typeof window === "undefined") return;
      setOrientation(window.innerHeight > window.innerWidth ? "portrait" : "landscape");
    };

    updateOrientation();
    window.addEventListener("resize", updateOrientation);
    window.addEventListener("orientationchange", updateOrientation);

    return () => {
      window.removeEventListener("resize", updateOrientation);
      window.removeEventListener("orientationchange", updateOrientation);
    };
  }, []);

  return orientation;
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
 */
export function useTouchGestures(): TouchGesture {
  const [gesture, setGesture] = useState<TouchGesture>({ type: null });

  useEffect(() => {
    let startTime: number;
    let startX: number;
    let startY: number;
    let hasSwipe = false;

    const handleTouchStart = (e: TouchEvent) => {
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

      document.addEventListener("touchmove", handleTouchMove);
      document.addEventListener("touchend", handleTouchEnd);
    };

    document.addEventListener("touchstart", handleTouchStart);

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
    };
  }, []);

  return gesture;
}

/**
 * Viewport Height Hook
 * Handles mobile viewport height changes (keyboard, browser chrome)
 */
export function useViewportHeight(): number {
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    const updateViewportHeight = () => {
      if (typeof window === "undefined") return;

      const height = window.visualViewport?.height || window.innerHeight;
      setViewportHeight(height);

      // Set CSS custom property
      document.documentElement.style.setProperty("--vh", `${height * 0.01}px`);
    };

    updateViewportHeight();

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateViewportHeight);
    } else {
      window.addEventListener("resize", updateViewportHeight);
    }

    window.addEventListener("orientationchange", () => {
      setTimeout(updateViewportHeight, 100);
    });

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", updateViewportHeight);
      } else {
        window.removeEventListener("resize", updateViewportHeight);
      }
    };
  }, []);

  return viewportHeight;
}

/**
 * Window Size Hook (for general responsive calculations)
 */
export function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const updateSize = () => {
      if (typeof window === "undefined") return;

      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateSize();
    window.addEventListener("resize", updateSize);

    return () => window.removeEventListener("resize", updateSize);
  }, []);

  return windowSize;
}

/**
 * Touch Device Detection Hook
 */
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hasTouch = Boolean(
      "ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        (navigator as any).msMaxTouchPoints > 0
    );

    setIsTouch(hasTouch);
  }, []);

  return isTouch;
}
