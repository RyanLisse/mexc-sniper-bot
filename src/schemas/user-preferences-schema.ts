/**
 * User Preferences Schema Definitions
 * 
 * Zod schemas for user preference validation and type safety
 */

import { z } from 'zod';

// Base user preferences schema
export const UserPreferencesSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  riskTolerance: z.enum(['low', 'medium', 'high']).default('medium'),
  maxPositionSize: z.number().min(0).max(100).default(10),
  autoTradingEnabled: z.boolean().default(false),
  notificationSettings: z.object({
    email: z.boolean().default(true),
    webhook: z.boolean().default(false),
    urgentOnly: z.boolean().default(false),
  }).default({}),
  tradingPairs: z.array(z.string()).default([]),
  stopLossPercentage: z.number().min(0).max(50).default(5),
  takeProfitPercentage: z.number().min(1).max(100).default(15),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

// Risk management preferences
export const RiskPreferencesSchema = z.object({
  maxDailyLoss: z.number().min(0).default(1000),
  maxDrawdown: z.number().min(0).max(50).default(20),
  emergencyStopEnabled: z.boolean().default(true),
  riskLevel: z.enum(['conservative', 'moderate', 'aggressive']).default('moderate'),
  positionSizingMethod: z.enum(['fixed', 'percentage', 'kelly']).default('percentage'),
});

// Trading preferences  
export const TradingPreferencesSchema = z.object({
  preferredTimeframes: z.array(z.string()).default(['1h', '4h']),
  maxSimultaneousPositions: z.number().min(1).max(20).default(5),
  slippageTolerance: z.number().min(0).max(10).default(0.5),
  orderTimeoutSeconds: z.number().min(10).max(300).default(30),
  useAdvancedOrderTypes: z.boolean().default(false),
});

// Notification preferences
export const NotificationPreferencesSchema = z.object({
  email: z.boolean().default(true),
  webhook: z.boolean().default(false),
  sms: z.boolean().default(false),
  urgentOnly: z.boolean().default(false),
  tradeAlerts: z.boolean().default(true),
  riskAlerts: z.boolean().default(true),
  systemAlerts: z.boolean().default(true),
});

// Complete user preferences with all sections
export const CompleteUserPreferencesSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  general: UserPreferencesSchema.omit({ id: true, userId: true }),
  risk: RiskPreferencesSchema,
  trading: TradingPreferencesSchema,
  notifications: NotificationPreferencesSchema,
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

// Preference update schemas
export const UpdateUserPreferencesSchema = UserPreferencesSchema.partial().omit({ id: true });
export const UpdateRiskPreferencesSchema = RiskPreferencesSchema.partial();
export const UpdateTradingPreferencesSchema = TradingPreferencesSchema.partial();
export const UpdateNotificationPreferencesSchema = NotificationPreferencesSchema.partial();

// Type exports
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
export type RiskPreferences = z.infer<typeof RiskPreferencesSchema>;
export type TradingPreferences = z.infer<typeof TradingPreferencesSchema>;
export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;
export type CompleteUserPreferences = z.infer<typeof CompleteUserPreferencesSchema>;

// Validation functions
export function validateUserPreferences(data: unknown): UserPreferences {
  return UserPreferencesSchema.parse(data);
}

export function validateRiskPreferences(data: unknown): RiskPreferences {
  return RiskPreferencesSchema.parse(data);
}

export function validateTradingPreferences(data: unknown): TradingPreferences {
  return TradingPreferencesSchema.parse(data);
}

export function validateNotificationPreferences(data: unknown): NotificationPreferences {
  return NotificationPreferencesSchema.parse(data);
}

// Default preferences factory
export function createDefaultUserPreferences(userId: string): UserPreferences {
  return UserPreferencesSchema.parse({
    id: `pref_${userId}`,
    userId,
  });
}