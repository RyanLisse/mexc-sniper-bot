import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Simple logger implementation for the MEXC Sniper Bot
interface LogLevel {
  ERROR: "error";
  WARN: "warn";
  INFO: "info";
  DEBUG: "debug";
}

class Logger {
  private logLevel: keyof LogLevel = "INFO";

  setLevel(level: keyof LogLevel) {
    this.logLevel = level;
  }

  private shouldLog(level: keyof LogLevel): boolean {
    const _levels: LogLevel = { ERROR: "error", WARN: "warn", INFO: "info", DEBUG: "debug" };
    const logLevels = ["ERROR", "WARN", "INFO", "DEBUG"];
    const currentLevelIndex = logLevels.indexOf(this.logLevel);
    const messageLevelIndex = logLevels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  error(message: string, ...args: unknown[]) {
    if (this.shouldLog("ERROR")) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]) {
    if (this.shouldLog("WARN")) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]) {
    if (this.shouldLog("INFO")) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  debug(message: string, ...args: unknown[]) {
    if (this.shouldLog("DEBUG")) {
      console.info(`[DEBUG] ${message}`, ...args);
    }
  }
}

export const logger = new Logger();
