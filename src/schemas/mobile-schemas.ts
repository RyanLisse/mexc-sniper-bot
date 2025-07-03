import { z } from "zod";

/**
 * Mobile Detection Schemas
 * Type-safe validation for mobile device detection and responsive breakpoints
 */

export const BreakpointSchema = z.object({
  sm: z.boolean(),
  md: z.boolean(),
  lg: z.boolean(),
  xl: z.boolean(),
  "2xl": z.boolean(),
});

export const DeviceTypeSchema = z.enum(["mobile", "tablet", "desktop"]);

export const OrientationSchema = z.enum(["portrait", "landscape"]);

export const GestureTypeSchema = z.enum([
  "swipe",
  "pinch",
  "tap",
  "long-press",
]);

export const GestureDirectionSchema = z.enum(["left", "right", "up", "down"]);

export const TouchGestureSchema = z.object({
  type: GestureTypeSchema.nullable(),
  direction: GestureDirectionSchema.optional(),
  distance: z.number().positive().optional(),
  scale: z.number().positive().optional(),
});

export const MobileDetectionSchema = z.object({
  isMobile: z.boolean(),
  isTouch: z.boolean(),
  screenWidth: z.number().min(0),
  isTablet: z.boolean(),
  isDesktop: z.boolean(),
});

export const ViewportDimensionsSchema = z.object({
  width: z.number().min(0),
  height: z.number().min(0),
});

// Type exports
export type Breakpoints = z.infer<typeof BreakpointSchema>;
export type DeviceType = z.infer<typeof DeviceTypeSchema>;
export type Orientation = z.infer<typeof OrientationSchema>;
export type GestureType = z.infer<typeof GestureTypeSchema>;
export type GestureDirection = z.infer<typeof GestureDirectionSchema>;
export type TouchGesture = z.infer<typeof TouchGestureSchema>;
export type MobileDetection = z.infer<typeof MobileDetectionSchema>;
export type ViewportDimensions = z.infer<typeof ViewportDimensionsSchema>;
