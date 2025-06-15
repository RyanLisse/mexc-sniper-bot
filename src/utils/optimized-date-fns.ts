/**
 * Optimized Date-FNS Exports
 * Tree-shakeable date utility imports to reduce bundle size
 * Part of Task 5.1: Bundle Size Optimization
 */

// Core date formatting functions
export { format } from "date-fns/format";
export { formatDistance } from "date-fns/formatDistance";
export { formatDistanceToNow } from "date-fns/formatDistanceToNow";
export { formatRelative } from "date-fns/formatRelative";

// Date parsing and validation
export { parseISO } from "date-fns/parseISO";
export { isValid } from "date-fns/isValid";
export { parse } from "date-fns/parse";

// Date arithmetic
export { addDays } from "date-fns/addDays";
export { addHours } from "date-fns/addHours";
export { addMinutes } from "date-fns/addMinutes";
export { addWeeks } from "date-fns/addWeeks";
export { addMonths } from "date-fns/addMonths";
export { subDays } from "date-fns/subDays";
export { subHours } from "date-fns/subHours";
export { subMinutes } from "date-fns/subMinutes";

// Date comparison
export { isBefore } from "date-fns/isBefore";
export { isAfter } from "date-fns/isAfter";
export { isSameDay } from "date-fns/isSameDay";
export { isSameHour } from "date-fns/isSameHour";
export { isToday } from "date-fns/isToday";
export { isTomorrow } from "date-fns/isTomorrow";
export { isYesterday } from "date-fns/isYesterday";

// Date manipulation
export { startOfDay } from "date-fns/startOfDay";
export { endOfDay } from "date-fns/endOfDay";
export { startOfWeek } from "date-fns/startOfWeek";
export { endOfWeek } from "date-fns/endOfWeek";
export { startOfMonth } from "date-fns/startOfMonth";
export { endOfMonth } from "date-fns/endOfMonth";

// Time zone utilities (if needed) - removed for now to avoid dependencies

// Commonly used date constants
export const DATE_FORMATS = {
  display: "MMM dd, yyyy",
  full: "EEEE, MMMM dd, yyyy",
  short: "MM/dd/yyyy",
  time: "HH:mm:ss",
  datetime: "MMM dd, yyyy HH:mm",
  iso: "yyyy-MM-dd",
  trading: "yyyy-MM-dd HH:mm:ss",
  calendar: "EEEE, MMMM do, yyyy",
} as const;

// Helper functions for common trading operations
import { format } from "date-fns/format";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { parseISO } from "date-fns/parseISO";

export function formatTradingTime(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, DATE_FORMATS.trading);
}

export function formatCalendarDate(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, DATE_FORMATS.calendar);
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}
