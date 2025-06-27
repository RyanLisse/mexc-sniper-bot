/**
 * User Preferences Service
 * 
 * Manages user configuration and preferences for trading operations
 */

import { z } from 'zod';

// User Preferences Schema
export const UserPreferencesSchema = z.object({
  id: z.string(),
  userId: z.string(),
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

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

export class UserPreferencesService {
  private static instance: UserPreferencesService;
  private preferences: Map<string, UserPreferences> = new Map();

  static getInstance(): UserPreferencesService {
    if (!UserPreferencesService.instance) {
      UserPreferencesService.instance = new UserPreferencesService();
    }
    return UserPreferencesService.instance;
  }

  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    return this.preferences.get(userId) || null;
  }

  async updateUserPreferences(userId: string, updates: Partial<UserPreferences>): Promise<UserPreferences> {
    const existing = this.preferences.get(userId);
    const updated = {
      ...existing,
      ...updates,
      id: existing?.id || `pref_${userId}`,
      userId,
      updatedAt: new Date(),
    };

    const validated = UserPreferencesSchema.parse(updated);
    this.preferences.set(userId, validated);
    return validated;
  }

  async createUserPreferences(userId: string, preferences: Partial<UserPreferences> = {}): Promise<UserPreferences> {
    const newPreferences = UserPreferencesSchema.parse({
      ...preferences,
      id: `pref_${userId}`,
      userId,
    });

    this.preferences.set(userId, newPreferences);
    return newPreferences;
  }

  async deleteUserPreferences(userId: string): Promise<boolean> {
    return this.preferences.delete(userId);
  }

  async validatePreferences(preferences: unknown): Promise<UserPreferences> {
    return UserPreferencesSchema.parse(preferences);
  }
}

// Export singleton instance
export const userPreferencesService = UserPreferencesService.getInstance();