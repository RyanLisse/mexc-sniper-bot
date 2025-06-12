export interface UserPreferences {
  userId: string;
  defaultBuyAmountUsdt: number;
  maxConcurrentSnipes: number;
  takeProfitLevels: {
    level1: number;
    level2: number;
    level3: number;
    level4: number;
    custom?: number;
  };
  defaultTakeProfitLevel: number;
  stopLossPercent: number;
  riskTolerance: "low" | "medium" | "high";
  readyStatePattern: [number, number, number];
  targetAdvanceHours: number;
  calendarPollIntervalSeconds: number;
  symbolsPollIntervalSeconds: number;
  selectedExitStrategy: string;
  customExitStrategy?: unknown;
  autoBuyEnabled: boolean;
  autoSellEnabled: boolean;
  autoSnipeEnabled: boolean;
}

export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  try {
    const response = await fetch(`/api/user-preferences?userId=${encodeURIComponent(userId)}`);
    if (!response.ok) {
      return null;
    }
    const prefs = await response.json();
    return prefs as UserPreferences;
  } catch (error) {
    console.error("[getUserPreferences] Failed to fetch preferences:", error);
    return null;
  }
}
