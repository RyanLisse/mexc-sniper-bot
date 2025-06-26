/**
 * Safety Monitoring API Schemas
 * 
 * Zod validation schemas for safety monitoring API requests
 */

import { z } from "zod";

// Request validation schemas
export const PostActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start_monitoring"),
  }),
  z.object({
    action: z.literal("stop_monitoring"),
  }),
  z.object({
    action: z.literal("update_configuration"),
    configuration: z.record(z.unknown()).optional(),
  }),
  z.object({
    action: z.literal("update_thresholds"),
    thresholds: z.record(z.unknown()).optional(),
  }),
  z.object({
    action: z.literal("emergency_response"),
    reason: z.string().min(1),
  }),
  z.object({
    action: z.literal("acknowledge_alert"),
    alertId: z.string().min(1),
  }),
  z.object({
    action: z.literal("clear_acknowledged_alerts"),
  }),
  z.object({
    action: z.literal("force_risk_assessment"),
  }),
]);

export const GetQuerySchema = z.object({
  action: z.enum([
    "status",
    "report", 
    "risk-metrics",
    "alerts",
    "system-health",
    "configuration",
    "timer-status",
    "check-safety"
  ]).optional().default("status"),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  category: z.enum(["portfolio", "system", "performance", "pattern", "api"]).optional(),
  limit: z.string().optional().default("50"),
});

export type PostActionRequest = z.infer<typeof PostActionSchema>;
export type GetQueryRequest = z.infer<typeof GetQuerySchema>;
