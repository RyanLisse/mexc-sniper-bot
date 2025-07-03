import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Add missing export aliases for compatibility
export const logger = {
  info: (message: string, ...args: any[]) =>
    console.log(`[INFO] ${message}`, ...args),
  warn: (message: string, ...args: any[]) =>
    console.warn(`[WARN] ${message}`, ...args),
  error: (message: string, ...args: any[]) =>
    console.error(`[ERROR] ${message}`, ...args),
  debug: (message: string, ...args: any[]) =>
    console.debug(`[DEBUG] ${message}`, ...args),
};
