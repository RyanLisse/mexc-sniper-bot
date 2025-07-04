/**
 * Unit tests for use-time-formatting hook
 * Tests time formatting utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTimeFormatting } from '../../../src/hooks/use-time-formatting';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../utils/timeout-elimination-helpers';

describe('useTimeFormatting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    // TIMEOUT ELIMINATION: Ensure all promises are flushed before cleanup
    await flushPromises();
    vi.useRealTimers();
  
  });

  it('should return all formatting functions', () => {
    const { result } = renderHook(() => useTimeFormatting());
    
    expect(result.current).toHaveProperty('formatTimeAgo');
    expect(result.current).toHaveProperty('formatTimeRemaining');
    expect(result.current).toHaveProperty('formatUptime');
    
    expect(typeof result.current.formatTimeAgo).toBe('function');
    expect(typeof result.current.formatTimeRemaining).toBe('function');
    expect(typeof result.current.formatUptime).toBe('function');
  });

  describe('formatTimeAgo', () => {
    it('should return "Just now" for very recent times', () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);
      
      const { result } = renderHook(() => useTimeFormatting());
      
      const recent = new Date('2024-01-01T11:59:30Z'); // 30 seconds ago
      expect(result.current.formatTimeAgo(recent)).toBe('Just now');
    });

    it('should format minutes ago correctly', () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);
      
      const { result } = renderHook(() => useTimeFormatting());
      
      const oneMinAgo = new Date('2024-01-01T11:59:00Z');
      const fiveMinsAgo = new Date('2024-01-01T11:55:00Z');
      
      expect(result.current.formatTimeAgo(oneMinAgo)).toBe('1 minute ago');
      expect(result.current.formatTimeAgo(fiveMinsAgo)).toBe('5 minutes ago');
    });

    it('should format hours ago correctly', () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);
      
      const { result } = renderHook(() => useTimeFormatting());
      
      const oneHourAgo = new Date('2024-01-01T11:00:00Z');
      const fiveHoursAgo = new Date('2024-01-01T07:00:00Z');
      
      expect(result.current.formatTimeAgo(oneHourAgo)).toBe('1 hour ago');
      expect(result.current.formatTimeAgo(fiveHoursAgo)).toBe('5 hours ago');
    });

    it('should format days ago correctly', () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);
      
      const { result } = renderHook(() => useTimeFormatting());
      
      const oneDayAgo = new Date('2023-12-31T12:00:00Z');
      const threeDaysAgo = new Date('2023-12-29T12:00:00Z');
      
      expect(result.current.formatTimeAgo(oneDayAgo)).toBe('1 day ago');
      expect(result.current.formatTimeAgo(threeDaysAgo)).toBe('3 days ago');
    });

    it('should handle string timestamps', () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);
      
      const { result } = renderHook(() => useTimeFormatting());
      
      const timestamp = '2024-01-01T11:30:00Z';
      expect(result.current.formatTimeAgo(timestamp)).toBe('30 minutes ago');
    });

    it('should handle Date objects', () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);
      
      const { result } = renderHook(() => useTimeFormatting());
      
      const date = new Date('2024-01-01T10:00:00Z');
      expect(result.current.formatTimeAgo(date)).toBe('2 hours ago');
    });

    it('should handle boundary cases', () => {
      const now = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);
      
      const { result } = renderHook(() => useTimeFormatting());
      
      const exactlyOneMinute = new Date('2024-01-01T11:59:00Z');
      const exactlyOneHour = new Date('2024-01-01T11:00:00Z');
      const exactlyOneDay = new Date('2023-12-31T12:00:00Z');
      
      expect(result.current.formatTimeAgo(exactlyOneMinute)).toBe('1 minute ago');
      expect(result.current.formatTimeAgo(exactlyOneHour)).toBe('1 hour ago');
      expect(result.current.formatTimeAgo(exactlyOneDay)).toBe('1 day ago');
    });
  });

  describe('formatTimeRemaining', () => {
    it('should return "Launched" for past times', () => {
      const now = Date.parse('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);
      
      const { result } = renderHook(() => useTimeFormatting());
      
      const pastTime = new Date('2024-01-01T11:00:00Z');
      expect(result.current.formatTimeRemaining(pastTime)).toBe('Launched');
    });

    it('should format minutes remaining for times less than 1 hour', () => {
      const now = Date.parse('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);
      
      const { result } = renderHook(() => useTimeFormatting());
      
      const in30mins = new Date('2024-01-01T12:30:00Z');
      const in45mins = new Date('2024-01-01T12:45:00Z');
      
      expect(result.current.formatTimeRemaining(in30mins)).toBe('30m');
      expect(result.current.formatTimeRemaining(in45mins)).toBe('45m');
    });

    it('should format hours remaining for times less than 24 hours', () => {
      const now = Date.parse('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);
      
      const { result } = renderHook(() => useTimeFormatting());
      
      const in2hours = new Date('2024-01-01T14:00:00Z');
      const in5_5hours = new Date('2024-01-01T17:30:00Z');
      
      expect(result.current.formatTimeRemaining(in2hours)).toBe('2.0h');
      expect(result.current.formatTimeRemaining(in5_5hours)).toBe('5.5h');
    });

    it('should format days and hours for times more than 24 hours', () => {
      const now = Date.parse('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);
      
      const { result } = renderHook(() => useTimeFormatting());
      
      const in25hours = new Date('2024-01-02T13:00:00Z'); // 1 day 1 hour
      const in50hours = new Date('2024-01-03T14:00:00Z'); // 2 days 2 hours
      
      expect(result.current.formatTimeRemaining(in25hours)).toBe('1d 1h');
      expect(result.current.formatTimeRemaining(in50hours)).toBe('2d 2h');
    });

    it('should handle timestamp numbers', () => {
      const now = Date.parse('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);
      
      const { result } = renderHook(() => useTimeFormatting());
      
      const futureTimestamp = Date.parse('2024-01-01T14:00:00Z');
      expect(result.current.formatTimeRemaining(futureTimestamp)).toBe('2.0h');
    });

    it('should handle exact boundary times', () => {
      const now = Date.parse('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);
      
      const { result } = renderHook(() => useTimeFormatting());
      
      const exactlyOneHour = new Date('2024-01-01T13:00:00Z');
      const exactly24Hours = new Date('2024-01-02T12:00:00Z');
      
      expect(result.current.formatTimeRemaining(exactlyOneHour)).toBe('1.0h');
      expect(result.current.formatTimeRemaining(exactly24Hours)).toBe('1d 0h');
    });

    it('should handle very small time differences', () => {
      const now = Date.parse('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);
      
      const { result } = renderHook(() => useTimeFormatting());
      
      const in30seconds = new Date('2024-01-01T12:00:30Z');
      expect(result.current.formatTimeRemaining(in30seconds)).toBe('0m');
    });
  });

  describe('formatUptime', () => {
    it('should format seconds only for times less than 1 minute', () => {
      const { result } = renderHook(() => useTimeFormatting());
      
      expect(result.current.formatUptime(0)).toBe('0s');
      expect(result.current.formatUptime(30)).toBe('30s');
      expect(result.current.formatUptime(59)).toBe('59s');
    });

    it('should format minutes and seconds for times less than 1 hour', () => {
      const { result } = renderHook(() => useTimeFormatting());
      
      expect(result.current.formatUptime(60)).toBe('1m 0s');
      expect(result.current.formatUptime(90)).toBe('1m 30s');
      expect(result.current.formatUptime(3599)).toBe('59m 59s');
    });

    it('should format hours, minutes, and seconds for times 1 hour or more', () => {
      const { result } = renderHook(() => useTimeFormatting());
      
      expect(result.current.formatUptime(3600)).toBe('1h 0m 0s');
      expect(result.current.formatUptime(3661)).toBe('1h 1m 1s');
      expect(result.current.formatUptime(7323)).toBe('2h 2m 3s');
      expect(result.current.formatUptime(86400)).toBe('24h 0m 0s');
    });

    it('should handle decimal seconds by flooring', () => {
      const { result } = renderHook(() => useTimeFormatting());
      
      expect(result.current.formatUptime(30.9)).toBe('30s');
      expect(result.current.formatUptime(90.7)).toBe('1m 30s');
      expect(result.current.formatUptime(3661.8)).toBe('1h 1m 1s');
    });

    it('should handle large uptimes', () => {
      const { result } = renderHook(() => useTimeFormatting());
      
      const oneWeek = 7 * 24 * 3600; // 1 week in seconds
      expect(result.current.formatUptime(oneWeek)).toBe('168h 0m 0s');
    });
  });

  describe('memoization', () => {
    it('should return the same function references on re-renders', () => {
      const { result, rerender } = renderHook(() => useTimeFormatting());
      
      const firstResult = result.current;
      
      rerender();
      
      const secondResult = result.current;
      
      // Functions should be the same reference due to useCallback
      expect(firstResult.formatTimeAgo).toBe(secondResult.formatTimeAgo);
      expect(firstResult.formatTimeRemaining).toBe(secondResult.formatTimeRemaining);
      expect(firstResult.formatUptime).toBe(secondResult.formatUptime);
      
      // The returned object should also be the same reference due to useMemo
      expect(firstResult).toBe(secondResult);
    });
  });

  describe('integration tests', () => {
    it('should work together for comprehensive time formatting', () => {
      const now = Date.parse('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);
      
      const { result } = renderHook(() => useTimeFormatting());
      
      // Past time for formatTimeAgo
      const pastTime = new Date('2024-01-01T10:30:00Z');
      expect(result.current.formatTimeAgo(pastTime)).toBe('1 hour ago');
      
      // Future time for formatTimeRemaining
      const futureTime = new Date('2024-01-01T15:30:00Z');
      expect(result.current.formatTimeRemaining(futureTime)).toBe('3.5h');
      
      // Uptime in seconds
      const uptime = 3665; // 1 hour, 1 minute, 5 seconds
      expect(result.current.formatUptime(uptime)).toBe('1h 1m 5s');
    });

    it('should handle edge cases consistently', () => {
      const now = Date.parse('2024-01-01T12:00:00Z');
      vi.setSystemTime(now);
      
      const { result } = renderHook(() => useTimeFormatting());
      
      // Exactly now
      const exactlyNow = new Date('2024-01-01T12:00:00Z');
      expect(result.current.formatTimeAgo(exactlyNow)).toBe('Just now');
      expect(result.current.formatTimeRemaining(exactlyNow)).toBe('Launched');
      
      // Zero uptime
      expect(result.current.formatUptime(0)).toBe('0s');
    });
  });
});