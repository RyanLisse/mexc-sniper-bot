/**
 * Date/Time Test Utilities
 * MISSION: Test Stability & Reliability Agent
 * 
 * Comprehensive date/time utilities for stable and deterministic test execution:
 * - Deterministic date/time generation for consistent test results
 * - Time zone handling and normalization
 * - Date manipulation utilities for testing edge cases
 * - Mock clock functionality with automatic cleanup
 * - Time travel capabilities for testing time-dependent logic
 */

import { vi, beforeEach, afterEach } from 'vitest'

// Type definitions for date/time utilities
export interface TimeConfig {
  baseTime?: Date | string | number
  timezone?: string
  autoAdvance?: boolean
  advanceInterval?: number
}

export interface DateRange {
  start: Date
  end: Date
}

export interface TimeTravel {
  to: (date: Date | string | number) => void
  forward: (ms: number) => void
  backward: (ms: number) => void
  reset: () => void
}

// Global time state management
let originalDateNow: typeof Date.now
let originalDateConstructor: typeof Date
let mockTimeState: {
  currentTime: number
  autoAdvance: boolean
  advanceInterval: number
  intervalId?: NodeJS.Timeout
} = {
  currentTime: Date.now(),
  autoAdvance: false,
  advanceInterval: 1000
}

/**
 * Fixed timestamps for deterministic testing
 */
export const FIXED_TIMESTAMPS = {
  // Standard test dates
  TEST_DATE_2024: new Date('2024-01-01T00:00:00.000Z'),
  TEST_DATE_2024_MID: new Date('2024-06-15T12:30:45.123Z'),
  TEST_DATE_2024_END: new Date('2024-12-31T23:59:59.999Z'),
  
  // Trading-specific dates
  MARKET_OPEN_UTC: new Date('2024-01-01T09:00:00.000Z'),
  MARKET_CLOSE_UTC: new Date('2024-01-01T17:00:00.000Z'),
  WEEKEND_DATE: new Date('2024-01-06T12:00:00.000Z'), // Saturday
  
  // Edge cases
  LEAP_YEAR_FEB_29: new Date('2024-02-29T12:00:00.000Z'),
  DST_SPRING_FORWARD: new Date('2024-03-10T07:00:00.000Z'), // US DST
  DST_FALL_BACK: new Date('2024-11-03T06:00:00.000Z'), // US DST
  
  // Cryptocurrency market specific
  CRYPTO_MARKET_HIGH: new Date('2024-03-14T18:30:00.000Z'), // Pi Day pump
  CRYPTO_MARKET_LOW: new Date('2024-08-05T14:15:00.000Z'), // August crash
  
  // Unix timestamp boundaries
  UNIX_EPOCH_START: new Date('1970-01-01T00:00:00.000Z'),
  YEAR_2038_PROBLEM: new Date('2038-01-19T03:14:07.000Z'),
  
  // Future dates for testing
  FUTURE_DATE_2030: new Date('2030-12-31T23:59:59.999Z'),
  FUTURE_DATE_2050: new Date('2050-01-01T00:00:00.000Z')
} as const

/**
 * Common time durations in milliseconds
 */
export const TIME_DURATIONS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000, // Approximate
  YEAR: 365 * 24 * 60 * 60 * 1000, // Non-leap year
  
  // Trading specific
  TRADING_SESSION: 8 * 60 * 60 * 1000, // 8 hours
  TRADING_WEEK: 5 * 24 * 60 * 60 * 1000, // Monday-Friday
  
  // Cryptocurrency specific (24/7 markets)
  CRYPTO_DAY: 24 * 60 * 60 * 1000,
  CRYPTO_WEEK: 7 * 24 * 60 * 60 * 1000
} as const

/**
 * Initialize deterministic time for testing
 */
export function setupDeterministicTime(config: TimeConfig = {}) {
  const {
    baseTime = FIXED_TIMESTAMPS.TEST_DATE_2024,
    autoAdvance = false,
    advanceInterval = 1000
  } = config
  
  // Store original implementations
  originalDateNow = Date.now
  originalDateConstructor = Date
  
  // Convert baseTime to timestamp
  const baseTimestamp = typeof baseTime === 'number' 
    ? baseTime 
    : new Date(baseTime).getTime()
  
  // Update mock state
  mockTimeState = {
    currentTime: baseTimestamp,
    autoAdvance,
    advanceInterval
  }
  
  // Setup fake timers
  vi.useFakeTimers()
  vi.setSystemTime(new Date(baseTimestamp))
  
  // Setup auto-advance if enabled
  if (autoAdvance) {
    mockTimeState.intervalId = setInterval(() => {
      mockTimeState.currentTime += advanceInterval
      vi.setSystemTime(new Date(mockTimeState.currentTime))
    }, advanceInterval)
  }
  
  console.log(`🕐 Deterministic time setup: ${new Date(baseTimestamp).toISOString()}`)
  
  return createTimeTravel()
}

/**
 * Create time travel utilities
 */
function createTimeTravel(): TimeTravel {
  return {
    to: (date: Date | string | number) => {
      const timestamp = typeof date === 'number' 
        ? date 
        : new Date(date).getTime()
      
      mockTimeState.currentTime = timestamp
      vi.setSystemTime(new Date(timestamp))
      console.log(`🕐 Time traveled to: ${new Date(timestamp).toISOString()}`)
    },
    
    forward: (ms: number) => {
      mockTimeState.currentTime += ms
      vi.setSystemTime(new Date(mockTimeState.currentTime))
      console.log(`🕐 Time advanced by: ${ms}ms to ${new Date(mockTimeState.currentTime).toISOString()}`)
    },
    
    backward: (ms: number) => {
      mockTimeState.currentTime -= ms
      vi.setSystemTime(new Date(mockTimeState.currentTime))
      console.log(`🕐 Time reversed by: ${ms}ms to ${new Date(mockTimeState.currentTime).toISOString()}`)
    },
    
    reset: () => {
      const baseTime = FIXED_TIMESTAMPS.TEST_DATE_2024.getTime()
      mockTimeState.currentTime = baseTime
      vi.setSystemTime(new Date(baseTime))
      console.log(`🕐 Time reset to: ${new Date(baseTime).toISOString()}`)
    }
  }
}

/**
 * Cleanup deterministic time
 */
export function cleanupDeterministicTime() {
  // Clear auto-advance interval
  if (mockTimeState.intervalId) {
    clearInterval(mockTimeState.intervalId)
    mockTimeState.intervalId = undefined
  }
  
  // Restore real timers
  vi.useRealTimers()
  
  console.log('🕐 Deterministic time cleaned up')
}

/**
 * Generate a date range for testing
 */
export function createDateRange(
  start: Date | string | number,
  end: Date | string | number
): DateRange {
  return {
    start: new Date(start),
    end: new Date(end)
  }
}

/**
 * Generate dates within a specific range
 */
export function generateDatesInRange(
  range: DateRange,
  count: number,
  distribution: 'even' | 'random' = 'even'
): Date[] {
  const { start, end } = range
  const startTime = start.getTime()
  const endTime = end.getTime()
  const dates: Date[] = []
  
  if (distribution === 'even') {
    const interval = (endTime - startTime) / (count - 1)
    for (let i = 0; i < count; i++) {
      dates.push(new Date(startTime + (interval * i)))
    }
  } else {
    // Random distribution using seeded random for determinism
    for (let i = 0; i < count; i++) {
      const randomFactor = Math.sin(i * 12345) // Deterministic "random"
      const timestamp = startTime + (Math.abs(randomFactor) * (endTime - startTime))
      dates.push(new Date(timestamp))
    }
  }
  
  return dates.sort((a, b) => a.getTime() - b.getTime())
}

/**
 * Create test dates for specific scenarios
 */
export function createTestDates() {
  return {
    // Market scenarios
    marketOpen: () => FIXED_TIMESTAMPS.MARKET_OPEN_UTC,
    marketClose: () => FIXED_TIMESTAMPS.MARKET_CLOSE_UTC,
    weekend: () => FIXED_TIMESTAMPS.WEEKEND_DATE,
    
    // Time boundaries
    startOfDay: (date = FIXED_TIMESTAMPS.TEST_DATE_2024) => {
      const d = new Date(date)
      d.setUTCHours(0, 0, 0, 0)
      return d
    },
    
    endOfDay: (date = FIXED_TIMESTAMPS.TEST_DATE_2024) => {
      const d = new Date(date)
      d.setUTCHours(23, 59, 59, 999)
      return d
    },
    
    startOfWeek: (date = FIXED_TIMESTAMPS.TEST_DATE_2024) => {
      const d = new Date(date)
      const day = d.getUTCDay()
      const diff = d.getUTCDate() - day
      d.setUTCDate(diff)
      d.setUTCHours(0, 0, 0, 0)
      return d
    },
    
    endOfWeek: (date = FIXED_TIMESTAMPS.TEST_DATE_2024) => {
      const d = new Date(date)
      const day = d.getUTCDay()
      const diff = d.getUTCDate() - day + 6
      d.setUTCDate(diff)
      d.setUTCHours(23, 59, 59, 999)
      return d
    },
    
    // Relative dates
    daysAgo: (days: number, from = FIXED_TIMESTAMPS.TEST_DATE_2024) => {
      return new Date(new Date(from).getTime() - (days * TIME_DURATIONS.DAY))
    },
    
    daysFromNow: (days: number, from = FIXED_TIMESTAMPS.TEST_DATE_2024) => {
      return new Date(new Date(from).getTime() + (days * TIME_DURATIONS.DAY))
    },
    
    hoursAgo: (hours: number, from = FIXED_TIMESTAMPS.TEST_DATE_2024) => {
      return new Date(new Date(from).getTime() - (hours * TIME_DURATIONS.HOUR))
    },
    
    hoursFromNow: (hours: number, from = FIXED_TIMESTAMPS.TEST_DATE_2024) => {
      return new Date(new Date(from).getTime() + (hours * TIME_DURATIONS.HOUR))
    }
  }
}

/**
 * Format date for consistent test output
 */
export function formatTestDate(date: Date, format: 'iso' | 'unix' | 'readable' = 'iso'): string {
  switch (format) {
    case 'iso':
      return date.toISOString()
    case 'unix':
      return Math.floor(date.getTime() / 1000).toString()
    case 'readable':
      return date.toUTCString()
    default:
      return date.toISOString()
  }
}

/**
 * Validate date ranges and relationships
 */
export function validateDateRange(start: Date, end: Date): {
  valid: boolean
  duration: number
  errors: string[]
} {
  const errors: string[] = []
  
  if (!(start instanceof Date) || isNaN(start.getTime())) {
    errors.push('Start date is invalid')
  }
  
  if (!(end instanceof Date) || isNaN(end.getTime())) {
    errors.push('End date is invalid')
  }
  
  if (start.getTime() >= end.getTime()) {
    errors.push('Start date must be before end date')
  }
  
  const duration = end.getTime() - start.getTime()
  
  return {
    valid: errors.length === 0,
    duration,
    errors
  }
}

/**
 * Create mock for Date constructor with deterministic behavior
 */
export function createMockDate(baseTime: Date = FIXED_TIMESTAMPS.TEST_DATE_2024) {
  let currentMockTime = baseTime.getTime()
  
  const MockedDate = class extends Date {
    constructor(...args: any[]) {
      if (args.length === 0) {
        super(currentMockTime)
      } else if (args.length === 1) {
        super(args[0])
      } else {
        super(args[0], args[1], args[2], args[3], args[4], args[5], args[6])
      }
    }
    
    static now() {
      return currentMockTime
    }
    
    static setMockTime(time: Date | string | number) {
      currentMockTime = typeof time === 'number' ? time : new Date(time).getTime()
    }
    
    static advanceMockTime(ms: number) {
      currentMockTime += ms
    }
  } as any
  
  // Copy static methods from original Date
  Object.getOwnPropertyNames(Date).forEach(name => {
    if (name !== 'length' && name !== 'name' && name !== 'prototype') {
      MockedDate[name] = (Date as any)[name]
    }
  })
  
  return MockedDate
}

/**
 * Test timezone handling
 */
export function testTimezoneHandling() {
  const testDate = FIXED_TIMESTAMPS.TEST_DATE_2024
  
  return {
    utc: testDate.toISOString(),
    localString: testDate.toString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    
    // Common timezone conversions for testing
    toTimezone: (timezone: string) => {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      }).format(testDate)
    }
  }
}

/**
 * Auto-cleanup setup for test hooks
 */
export function setupDateTimeTestHooks(config: TimeConfig = {}) {
  let timeTravel: TimeTravel
  
  beforeEach(() => {
    timeTravel = setupDeterministicTime(config)
  })
  
  afterEach(() => {
    cleanupDeterministicTime()
  })
  
  return () => timeTravel
}

/**
 * Performance testing for date operations
 */
export function measureDateOperationPerformance<T>(
  operation: () => T,
  iterations: number = 1000
): { result: T; averageTime: number; totalTime: number } {
  const startTime = Date.now()
  let result: T
  
  for (let i = 0; i < iterations; i++) {
    result = operation()
  }
  
  const totalTime = Date.now() - startTime
  const averageTime = totalTime / iterations
  
  return {
    result: result!,
    averageTime,
    totalTime
  }
}

// Export all utilities as default
export default {
  FIXED_TIMESTAMPS,
  TIME_DURATIONS,
  setupDeterministicTime,
  cleanupDeterministicTime,
  createDateRange,
  generateDatesInRange,
  createTestDates,
  formatTestDate,
  validateDateRange,
  createMockDate,
  testTimezoneHandling,
  setupDateTimeTestHooks,
  measureDateOperationPerformance
}