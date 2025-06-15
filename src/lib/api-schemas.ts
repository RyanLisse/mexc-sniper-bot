/**
 * API Validation Schemas
 * 
 * This module provides validation schemas for common API request patterns.
 * These schemas work with the api-middleware system to provide consistent validation.
 */

import { Validators } from './validators';
import type { ValidationSchema, ValidationFunction } from './api-middleware';

// =======================
// User Preferences Schemas
// =======================

export const UserPreferencesQuerySchema: ValidationSchema = {
  userId: 'required',
};

export const UserPreferencesUpdateSchema: ValidationSchema = {
  userId: 'required',
  defaultBuyAmountUsdt: (value: any) => value !== undefined ? Validators.buyAmountUsdt(Number(value)) : undefined,
  maxConcurrentSnipes: (value: any) => value !== undefined ? Validators.maxConcurrentSnipes(Number(value)) : undefined,
  takeProfitLevel1: (value: any) => value !== undefined ? Validators.takeProfitLevel(Number(value), 'Take profit level 1') : undefined,
  takeProfitLevel2: (value: any) => value !== undefined ? Validators.takeProfitLevel(Number(value), 'Take profit level 2') : undefined,
  takeProfitLevel3: (value: any) => value !== undefined ? Validators.takeProfitLevel(Number(value), 'Take profit level 3') : undefined,
  takeProfitLevel4: (value: any) => value !== undefined ? Validators.takeProfitLevel(Number(value), 'Take profit level 4') : undefined,
  takeProfitCustom: (value: any) => value !== undefined ? Validators.takeProfitLevel(Number(value), 'Custom take profit level') : undefined,
  stopLossPercent: (value: any) => value !== undefined ? Validators.stopLossPercent(Number(value)) : undefined,
  riskTolerance: (value: any) => value !== undefined ? Validators.riskTolerance(String(value)) : undefined,
  readyStatePattern: (value: any) => value !== undefined ? Validators.readyStatePattern(value) : undefined,
  targetAdvanceHours: (value: any) => value !== undefined ? Validators.targetAdvanceHours(Number(value)) : undefined,
  calendarPollIntervalSeconds: (value: any) => value !== undefined ? Validators.pollInterval(Number(value), 60, 3600) : undefined,
  symbolsPollIntervalSeconds: (value: any) => value !== undefined ? Validators.pollInterval(Number(value), 10, 300) : undefined,
};

// =======================
// API Credentials Schemas
// =======================

export const ApiCredentialsQuerySchema: ValidationSchema = {
  userId: 'required',
  provider: (value: any) => value || 'mexc',
};

export const ApiCredentialsCreateSchema: ValidationSchema = {
  userId: 'required',
  provider: (value: any) => value || 'mexc',
  apiKey: (value: any, field: string) => {
    if (!value || typeof value !== 'string') {
      throw new Error(`${field} is required and must be a string`);
    }
    if (value.length < 10) {
      throw new Error(`${field} must be at least 10 characters`);
    }
    if (value.includes(' ')) {
      throw new Error(`${field} cannot contain spaces`);
    }
    return value;
  },
  secretKey: (value: any, field: string) => {
    if (!value || typeof value !== 'string') {
      throw new Error(`${field} is required and must be a string`);
    }
    if (value.length < 10) {
      throw new Error(`${field} must be at least 10 characters`);
    }
    if (value.includes(' ')) {
      throw new Error(`${field} cannot contain spaces`);
    }
    return value;
  },
  passphrase: (value: any) => value || undefined,
};

// =======================
// Snipe Targets Schemas
// =======================

export const SnipeTargetsQuerySchema: ValidationSchema = {
  userId: 'required',
  status: (value: any) => {
    if (value && !['pending', 'active', 'completed', 'failed', 'cancelled'].includes(value)) {
      throw new Error('Status must be one of: pending, active, completed, failed, cancelled');
    }
    return value;
  },
};

export const SnipeTargetCreateSchema: ValidationSchema = {
  userId: 'required',
  vcoinId: 'required',
  symbolName: 'required',
  entryStrategy: (value: any) => value || 'market',
  entryPrice: 'number',
  positionSizeUsdt: (value: any) => {
    const num = Number(value);
    if (isNaN(num) || num <= 0) {
      throw new Error('Position size must be a positive number');
    }
    return num;
  },
  takeProfitLevel: (value: any) => {
    const level = Number(value) || 2;
    if (level < 1 || level > 4) {
      throw new Error('Take profit level must be between 1 and 4');
    }
    return level;
  },
  takeProfitCustom: 'number',
  stopLossPercent: (value: any) => value !== undefined ? Validators.stopLossPercent(Number(value)) : 5.0,
  priority: (value: any) => {
    const priority = Number(value) || 1;
    if (priority < 1 || priority > 10) {
      throw new Error('Priority must be between 1 and 10');
    }
    return priority;
  },
  confidenceScore: (value: any) => {
    const score = Number(value) || 0.0;
    if (score < 0 || score > 1) {
      throw new Error('Confidence score must be between 0 and 1');
    }
    return score;
  },
  riskLevel: (value: any) => {
    const level = value || 'medium';
    if (!['low', 'medium', 'high'].includes(level)) {
      throw new Error('Risk level must be low, medium, or high');
    }
    return level;
  },
};

// =======================
// Trading Schemas
// =======================

export const TradingOrderSchema: ValidationSchema = {
  userId: 'required',
  symbol: 'required',
  side: (value: any) => {
    if (!['buy', 'sell', 'BUY', 'SELL'].includes(value)) {
      throw new Error('Side must be buy or sell');
    }
    return value.toUpperCase();
  },
  type: (value: any) => {
    if (!['market', 'limit', 'MARKET', 'LIMIT'].includes(value)) {
      throw new Error('Type must be market or limit');
    }
    return value.toUpperCase();
  },
  quantity: (value: any) => {
    const qty = Number(value);
    if (isNaN(qty) || qty <= 0) {
      throw new Error('Quantity must be a positive number');
    }
    return qty;
  },
  price: (value: any) => {
    if (value === undefined || value === null) return undefined;
    const price = Number(value);
    if (isNaN(price) || price <= 0) {
      throw new Error('Price must be a positive number');
    }
    return price;
  },
  snipeTargetId: 'string',
  skipLock: (value: any) => Boolean(value),
};

// =======================
// Account and Balance Schemas
// =======================

export const AccountBalanceQuerySchema: ValidationSchema = {
  userId: (value: any) => value || undefined, // Optional for fallback to env credentials
};

// =======================
// Health Check Schemas
// =======================

export const HealthCheckQuerySchema: ValidationSchema = {
  includeDetails: (value: any) => Boolean(value),
};

// =======================
// Pagination Schemas
// =======================

export const PaginationSchema: ValidationSchema = {
  page: (value: any) => {
    const page = Number(value) || 1;
    if (page < 1) {
      throw new Error('Page must be at least 1');
    }
    return page;
  },
  limit: (value: any) => {
    const limit = Number(value) || 20;
    if (limit < 1 || limit > 100) {
      throw new Error('Limit must be between 1 and 100');
    }
    return limit;
  },
};

// =======================
// Custom Validation Functions
// =======================

/**
 * Validates that take profit levels are in ascending order
 */
export const validateTakeProfitLevelsOrder: ValidationFunction = (value: any, field: string, data: any) => {
  const levels = [
    data.takeProfitLevel1,
    data.takeProfitLevel2,
    data.takeProfitLevel3,
    data.takeProfitLevel4,
  ].filter(level => level !== undefined);

  for (let i = 1; i < levels.length; i++) {
    if (levels[i] <= levels[i - 1]) {
      throw new Error('Take profit levels must be in ascending order');
    }
  }
  
  return value;
};

/**
 * Validates trading parameters are consistent (price required for limit orders)
 */
export const validateTradingParameters: ValidationFunction = (value: any, field: string, data: any) => {
  if (data.type === 'LIMIT' && !data.price) {
    throw new Error('Price is required for limit orders');
  }
  return value;
};

/**
 * Validates user ID matches authenticated user
 */
export const validateUserIdMatch = (authenticatedUserId: string): ValidationFunction => {
  return (value: any, field: string) => {
    if (value !== authenticatedUserId) {
      throw new Error('You can only access your own data');
    }
    return value;
  };
};

/**
 * Validates MEXC symbol format
 */
export const validateMexcSymbol: ValidationFunction = (value: any, field: string) => {
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string`);
  }
  
  // MEXC symbols are typically in format BTCUSDT, ETHUSDT, etc.
  if (!/^[A-Z0-9]+USDT?$/.test(value)) {
    throw new Error(`${field} must be a valid MEXC trading symbol (e.g., BTCUSDT)`);
  }
  
  return value.toUpperCase();
};

/**
 * Validates ISO date string
 */
export const validateISODate: ValidationFunction = (value: any, field: string) => {
  if (!value) return undefined;
  
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new Error(`${field} must be a valid ISO date string`);
  }
  
  return date.toISOString();
};

/**
 * Validates that a date is in the future
 */
export const validateFutureDate: ValidationFunction = (value: any, field: string) => {
  if (!value) return undefined;
  
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new Error(`${field} must be a valid date`);
  }
  
  if (date.getTime() <= Date.now()) {
    throw new Error(`${field} must be in the future`);
  }
  
  return date.toISOString();
};

// =======================
// Composite Schemas
// =======================

/**
 * Schema for user preferences with cross-field validation
 */
export const CompleteUserPreferencesSchema: ValidationFunction = (data: any) => {
  // First apply individual field validation
  const schema = UserPreferencesUpdateSchema;
  for (const [field, rule] of Object.entries(schema)) {
    if (data[field] !== undefined && typeof rule === 'function') {
      data[field] = rule(data[field], field, data);
    }
  }
  
  // Then apply cross-field validation
  validateTakeProfitLevelsOrder(null, '', data);
  
  return data;
};

/**
 * Schema for trading orders with parameter consistency validation
 */
export const CompleteTradingOrderSchema: ValidationFunction = (data: any) => {
  // First apply individual field validation
  const schema = TradingOrderSchema;
  for (const [field, rule] of Object.entries(schema)) {
    if (data[field] !== undefined && typeof rule === 'function') {
      data[field] = rule(data[field], field, data);
    }
  }
  
  // Then apply cross-field validation
  validateTradingParameters(null, '', data);
  
  return data;
};