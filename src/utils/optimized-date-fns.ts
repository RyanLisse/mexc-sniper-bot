/**
 * Simple Date Utilities
 */

export { format } from "date-fns/format";
export { formatDistanceToNow } from "date-fns/formatDistanceToNow";
export { parseISO } from "date-fns/parseISO";

export function formatTradingTime(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "yyyy-MM-dd HH:mm:ss");
}
