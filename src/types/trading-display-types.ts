/**
 * Unified Trading Target Types
 * 
 * This file resolves the core TypeScript compilation issue by creating
 * a unified interface that combines Calendar/Symbol data (UI layer) 
 * with Database SnipeTarget data (service layer).
 * 
 * Root Cause: Components expect Calendar/Symbol properties but services
 * return Database SnipeTarget properties, causing 400+ TypeScript errors.
 */

import type { z } from 'zod';

/**
 * Unified interface for trading targets that combines:
 * - Calendar/Symbol data (from UI layer)
 * - Database SnipeTarget properties (from service layer)
 */
export interface TradingTargetDisplay {
  // Core identification
  vcoinId: string | number; // Support both string (calendar) and number (database)
  
  // Symbol information
  symbol: string;
  symbolName?: string; // Alias for backward compatibility
  projectName: string;
  
  // Timing information
  launchTime: Date;
  discoveredAt: Date;
  
  // Trading parameters
  confidence: number;
  hoursAdvanceNotice: number;
  priceDecimalPlaces: number;
  quantityDecimalPlaces: number;
  
  // Order configuration
  orderParameters?: Record<string, unknown>;
  
  // Database fields (when available)
  id?: number;
  createdAt?: Date;
  updatedAt?: Date;
  positionSizeUsdt?: number;
  stopLossPercent?: number;
  status?: "pending" | "ready" | "executing" | "completed" | "failed" | "cancelled";
  
  // Additional fields for flexibility
  [key: string]: unknown;
}

/**
 * Legacy type alias for backward compatibility
 * TODO: Remove after migration is complete
 */
export type LegacySnipeTarget = TradingTargetDisplay;

/**
 * Calendar data structure (from MEXC API)
 */
export interface CalendarEntry {
  vcoinId: string;
  symbol: string;
  projectName: string;
  firstOpenTime: string;
  [key: string]: unknown;
}

/**
 * Symbol data structure (from MEXC API)
 */
export interface SymbolEntry {
  symbol: string;
  ps: number; // price decimal places
  qs: number; // quantity decimal places
  [key: string]: unknown;
}

/**
 * Database SnipeTarget structure (from database schema)
 */
export interface AutoSnipeTarget {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  vcoinId: number;
  symbolName: string;
  positionSizeUsdt: number;
  stopLossPercent: number;
  status: "pending" | "ready" | "executing" | "completed" | "failed" | "cancelled";
  [key: string]: unknown;
}

/**
 * Order parameters for trading execution
 */
export interface OrderParameters {
  orderType: 'market' | 'limit';
  timeInForce?: 'IOC' | 'FOK' | 'GTC';
  reduceOnly?: boolean;
  [key: string]: unknown;
}

/**
 * Type guards for runtime type checking
 */
export function isCalendarEntry(data: unknown): data is CalendarEntry {
  return (
    typeof data === 'object' &&
    data !== null &&
    'vcoinId' in data &&
    'symbol' in data &&
    'projectName' in data &&
    'firstOpenTime' in data
  );
}

export function isAutoSnipeTarget(data: unknown): data is AutoSnipeTarget {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'symbolName' in data &&
    'status' in data
  );
}

export function isTradingTargetDisplay(data: unknown): data is TradingTargetDisplay {
  return (
    typeof data === 'object' &&
    data !== null &&
    ('vcoinId' in data) &&
    ('symbol' in data || 'symbolName' in data)
  );
}